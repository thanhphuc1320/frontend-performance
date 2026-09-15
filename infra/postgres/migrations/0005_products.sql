CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- NOTE: updated_at columns in this migration are managed by the application layer.

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  slug text NOT NULL,
  description text,
  base_price numeric(15,2) NOT NULL CHECK (base_price >= 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, slug)
);
CREATE INDEX products_store_status_idx ON products (store_id, status);
CREATE INDEX products_store_slug_idx ON products (store_id, slug);

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE CHECK (length(btrim(sku)) > 0),
  name text,
  price_delta numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_idx ON product_variants (product_id);

CREATE TABLE product_variant_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  option_name text NOT NULL CHECK (length(btrim(option_name)) > 0),
  option_value text NOT NULL CHECK (length(btrim(option_value)) > 0),
  UNIQUE(variant_id, option_name)
);
CREATE INDEX product_variant_options_variant_idx ON product_variant_options (variant_id);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  slug text NOT NULL,
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, slug)
);
CREATE INDEX categories_store_parent_idx ON categories (store_id, parent_id);

CREATE TABLE product_categories (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (length(btrim(url)) > 0),
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_idx ON product_images (product_id, sort_order);

CREATE TABLE product_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

CREATE TABLE product_taggings (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE product_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(variant_id)
);
CREATE INDEX product_inventory_variant_idx ON product_inventory (variant_id);

CREATE OR REPLACE FUNCTION check_category_depth() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_depth integer;
  subtree_height integer;
BEGIN
  -- Skip check if parent hasn't changed on update
  IF TG_OP = 'UPDATE' AND OLD.parent_id IS NOT DISTINCT FROM NEW.parent_id THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS NULL THEN
    new_depth := 1;
  ELSE
    WITH RECURSIVE ancestors AS (
      SELECT parent_id, 1 AS level
      FROM categories
      WHERE id = NEW.parent_id
      UNION ALL
      SELECT c.parent_id, a.level + 1
      FROM categories c
      JOIN ancestors a ON c.id = a.parent_id
    )
    SELECT COALESCE(MAX(level), 0) + 1 INTO new_depth
    FROM ancestors;
  END IF;

  -- Check if this row itself exceeds depth 3
  IF new_depth > 3 THEN
    RAISE EXCEPTION 'Category depth limit exceeded. Maximum allowed depth is 3 levels.';
  END IF;

  -- For updates, check if any descendants would exceed depth 3
  IF TG_OP = 'UPDATE' THEN
    WITH RECURSIVE descendants AS (
      SELECT id, 1 AS level
      FROM categories
      WHERE parent_id = NEW.id
      UNION ALL
      SELECT c.id, d.level + 1
      FROM categories c
      JOIN descendants d ON c.parent_id = d.id
    )
    SELECT COALESCE(MAX(level), 0) INTO subtree_height
    FROM descendants;

    IF new_depth + subtree_height > 3 THEN
      RAISE EXCEPTION 'Category depth limit exceeded. Moving this category would cause descendants to exceed the maximum depth of 3 levels.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER categories_depth_limit
  BEFORE INSERT OR UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION check_category_depth();
