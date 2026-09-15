DROP TRIGGER IF EXISTS categories_depth_limit ON categories;
DROP FUNCTION IF EXISTS check_category_depth();

DROP TABLE IF EXISTS product_inventory;
DROP TABLE IF EXISTS product_taggings;
DROP TABLE IF EXISTS product_tags;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS product_variant_options;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS products;
