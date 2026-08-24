CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL UNIQUE CHECK (email_normalized = lower(btrim(email_normalized))),
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('UNVERIFIED', 'ACTIVE', 'TEMPORARILY_LOCKED', 'DISABLED')),
  email_verified_at timestamptz,
  failed_login_attempts integer NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  lock_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash text NOT NULL UNIQUE CHECK (session_hash ~ '^[0-9a-fA-F]{64}$'),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (idle_expires_at <= absolute_expires_at)
);
CREATE INDEX sessions_user_active_idx ON sessions (user_id, revoked_at, idle_expires_at);

CREATE TABLE email_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_type text NOT NULL CHECK (token_type IN ('VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE', 'INVITATION')),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-fA-F]{64}$'),
  email_normalized text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_lookup_idx ON email_tokens (user_id, token_type, expires_at) WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  currency text NOT NULL DEFAULT 'VND',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEACTIVATED')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stores_creator_idx ON stores (created_by, status);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  is_system boolean NOT NULL DEFAULT true CHECK (is_system)
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE store_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT', 'REMOVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);
CREATE INDEX store_memberships_user_idx ON store_memberships (user_id, status);
CREATE INDEX store_memberships_store_idx ON store_memberships (store_id, status);

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL REFERENCES users(id),
  email_normalized text NOT NULL CHECK (email_normalized = lower(btrim(email_normalized))),
  role_id uuid NOT NULL REFERENCES roles(id),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-fA-F]{64}$'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_store_idx ON invitations (store_id, status, expires_at);
CREATE INDEX invitations_token_idx ON invitations (token_hash, status, expires_at);

CREATE OR REPLACE FUNCTION prevent_final_owner_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role_id = (SELECT id FROM roles WHERE code = 'OWNER')
     AND (TG_OP = 'DELETE' OR NEW.role_id <> OLD.role_id OR NEW.status IN ('LEFT', 'REMOVED', 'SUSPENDED'))
     AND NOT EXISTS (
       SELECT 1 FROM store_memberships m
       JOIN roles r ON r.id = m.role_id
       WHERE m.store_id = OLD.store_id AND m.id <> OLD.id AND m.status = 'ACTIVE' AND r.code = 'OWNER'
     ) THEN
    RAISE EXCEPTION 'cannot change the final Owner membership';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER store_memberships_final_owner
  BEFORE UPDATE ON store_memberships FOR EACH ROW EXECUTE FUNCTION prevent_final_owner_change();
CREATE TRIGGER store_memberships_final_owner_delete
  BEFORE DELETE ON store_memberships FOR EACH ROW EXECUTE FUNCTION prevent_final_owner_change();

INSERT INTO roles (code, name) VALUES
  ('OWNER', 'Owner'), ('ADMIN', 'Admin'), ('STAFF', 'Staff'), ('WAREHOUSE', 'Warehouse'), ('CUSTOMER_SUPPORT', 'Customer Support'), ('ANALYST', 'Analyst')
ON CONFLICT (code) DO NOTHING;
INSERT INTO permissions (code, name) VALUES
  ('dashboard.read', 'Dashboard read'), ('dashboard.financial.read', 'Financial dashboard read'), ('dashboard.livestream.read', 'Livestream dashboard read'), ('analytics.read', 'Analytics read'),
  ('orders.read', 'Orders read'), ('orders.update', 'Orders update'), ('orders.cancel', 'Orders cancel'), ('customers.read', 'Customers read'), ('customers.merge', 'Customers merge'),
  ('products.read', 'Products read'), ('products.manage', 'Products manage'), ('inventory.read', 'Inventory read'), ('inventory.adjust', 'Inventory adjust'),
  ('channels.read', 'Channels read'), ('channels.connect', 'Channels connect'), ('channels.sync', 'Channels sync'), ('livestream.read', 'Livestream read'), ('livestream.control', 'Livestream control'),
  ('members.read', 'Members read'), ('members.invite', 'Members invite'), ('members.manage', 'Members manage'), ('roles.read', 'Roles read'), ('audit.read', 'Audit read'), ('store.settings', 'Store settings'), ('store.deactivate', 'Store deactivate')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'OWNER'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN (VALUES
  ('ADMIN', 'dashboard.read'), ('ADMIN', 'dashboard.livestream.read'), ('ADMIN', 'analytics.read'), ('ADMIN', 'orders.read'), ('ADMIN', 'orders.update'), ('ADMIN', 'orders.cancel'), ('ADMIN', 'customers.read'), ('ADMIN', 'customers.merge'), ('ADMIN', 'products.read'), ('ADMIN', 'products.manage'), ('ADMIN', 'inventory.read'), ('ADMIN', 'inventory.adjust'), ('ADMIN', 'channels.read'), ('ADMIN', 'channels.connect'), ('ADMIN', 'channels.sync'), ('ADMIN', 'livestream.read'), ('ADMIN', 'livestream.control'), ('ADMIN', 'members.read'), ('ADMIN', 'members.invite'), ('ADMIN', 'members.manage'), ('ADMIN', 'roles.read'), ('ADMIN', 'audit.read'), ('ADMIN', 'store.settings'),
  ('STAFF', 'dashboard.read'), ('STAFF', 'orders.read'), ('STAFF', 'orders.update'), ('STAFF', 'products.read'), ('STAFF', 'customers.read'),
  ('WAREHOUSE', 'orders.read'), ('WAREHOUSE', 'orders.update'), ('WAREHOUSE', 'inventory.read'), ('WAREHOUSE', 'inventory.adjust'),
  ('CUSTOMER_SUPPORT', 'orders.read'), ('CUSTOMER_SUPPORT', 'orders.update'), ('CUSTOMER_SUPPORT', 'customers.read'),
  ('ANALYST', 'dashboard.read'), ('ANALYST', 'dashboard.financial.read'), ('ANALYST', 'analytics.read')
) AS seeded(role_code, permission_code) ON seeded.role_code = r.code JOIN permissions p ON p.code = seeded.permission_code
ON CONFLICT DO NOTHING;
