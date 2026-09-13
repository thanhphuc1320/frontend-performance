DROP TRIGGER IF EXISTS store_memberships_final_owner ON store_memberships;
DROP TRIGGER IF EXISTS store_memberships_final_owner_delete ON store_memberships;
DROP FUNCTION IF EXISTS prevent_final_owner_change();
DROP TRIGGER IF EXISTS stores_no_hard_delete ON stores;
DROP FUNCTION IF EXISTS prevent_store_hard_delete();
DROP TABLE IF EXISTS invitations, store_memberships, role_permissions, permissions, roles, stores, email_tokens, sessions, users CASCADE;
DROP EXTENSION IF EXISTS pgcrypto;
