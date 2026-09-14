import { Pool } from 'pg';
import { RepositoryError, mapConflict } from '../../persistence/repository-error';
import type { Product, ProductStatus } from '../domain/product';
import type { ProductVariant, ProductVariantStatus, VariantOption, Inventory } from '../domain/product-variant';
import type { Category } from '../domain/category';
import type { ProductTag } from '../domain/product-tag';

type Database = { query<T>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }>; };

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  createdAt: Date;
}

export interface CreateVariantInput {
  sku: string;
  name?: string;
  priceDelta?: number;
  status?: ProductVariantStatus;
  options: { optionName: string; optionValue: string }[];
  inventory: { quantity: number; reservedQuantity: number };
}

export interface CreateProductInput {
  storeId: string;
  name: string;
  slug: string;
  description?: string;
  basePrice: number;
  status?: ProductStatus;
  createdBy: string;
  variants: CreateVariantInput[];
  categoryIds: string[];
  tagIds: string[];
  images: { url: string; altText?: string; sortOrder?: number }[];
}

export interface ProductFilters {
  status?: ProductStatus;
  categoryId?: string;
  search?: string;
  sort?: string;
  page: number;
  limit: number;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductWithRelations extends Product {
  variants: ProductVariant[];
  categories: Category[];
  tags: ProductTag[];
  images: ProductImage[];
}

type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: string;
  status: ProductStatus;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  name: string | null;
  price_delta: string;
  status: ProductVariantStatus;
  created_at: Date;
  updated_at: Date;
};

type OptionRow = {
  id: string;
  variant_id: string;
  option_name: string;
  option_value: string;
};

type InventoryRow = {
  id: string;
  variant_id: string;
  quantity: number;
  reserved_quantity: number;
  updated_at: Date;
};

type CategoryRow = {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

type TagRow = {
  id: string;
  store_id: string;
  name: string;
  created_at: Date;
};

type ImageRow = {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: Date;
};

export class ProductRepository {
  constructor(private readonly db: Pool) {}

  private async transaction<T>(work: (executor: Database) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    await client.query('BEGIN');
    try {
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async create(input: CreateProductInput): Promise<Product> {
    return this.transaction(async (executor) => {
      let productResult;
      try {
        productResult = await executor.query<ProductRow>(
          `INSERT INTO products (store_id, name, slug, description, base_price, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [input.storeId, input.name, input.slug, input.description ?? null, input.basePrice, input.status ?? 'DRAFT', input.createdBy],
        );
      } catch (error) {
        return mapConflict(error, 'Product slug already exists');
      }
      const product = this.mapProduct(productResult.rows[0]!);

      for (const variant of input.variants) {
        let variantResult;
        try {
          variantResult = await executor.query<VariantRow>(
            `INSERT INTO product_variants (product_id, sku, name, price_delta, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [product.id, variant.sku, variant.name ?? null, variant.priceDelta ?? 0, variant.status ?? 'ACTIVE'],
          );
        } catch (error) {
          return mapConflict(error, 'SKU already exists');
        }
        const v = variantResult.rows[0]!;

        for (const option of variant.options) {
          await executor.query(
            `INSERT INTO product_variant_options (variant_id, option_name, option_value) VALUES ($1, $2, $3)`,
            [v.id, option.optionName, option.optionValue],
          );
        }

        await executor.query(
          `INSERT INTO product_inventory (variant_id, quantity, reserved_quantity) VALUES ($1, $2, $3)`,
          [v.id, variant.inventory.quantity, variant.inventory.reservedQuantity],
        );
      }

      for (const categoryId of input.categoryIds) {
        await executor.query(
          `INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)`,
          [product.id, categoryId],
        );
      }

      for (const tagId of input.tagIds) {
        await executor.query(
          `INSERT INTO product_taggings (product_id, tag_id) VALUES ($1, $2)`,
          [product.id, tagId],
        );
      }

      for (const image of input.images) {
        await executor.query(
          `INSERT INTO product_images (product_id, url, alt_text, sort_order) VALUES ($1, $2, $3, $4)`,
          [product.id, image.url, image.altText ?? null, image.sortOrder ?? 0],
        );
      }

      return product;
    });
  }

  async findById(productId: string, storeId: string, executor: Database = this.db): Promise<Product | null> {
    const result = await executor.query<ProductRow>(
      `SELECT * FROM products WHERE id = $1 AND store_id = $2`,
      [productId, storeId],
    );
    if (result.rowCount === 0) return null;
    return this.mapProduct(result.rows[0]!);
  }

  async findWithRelations(productId: string, storeId: string): Promise<ProductWithRelations | null> {
    const product = await this.findById(productId, storeId);
    if (!product) return null;

    const [
      variantsResult,
      optionsResult,
      inventoryResult,
      categoriesResult,
      tagsResult,
      imagesResult,
    ] = await Promise.all([
      this.db.query<VariantRow>(`SELECT * FROM product_variants WHERE product_id = $1`, [productId]),
      this.db.query<OptionRow>(`SELECT * FROM product_variant_options WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = $1)`, [productId]),
      this.db.query<InventoryRow>(`SELECT * FROM product_inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = $1)`, [productId]),
      this.db.query<CategoryRow>(`SELECT c.* FROM categories c JOIN product_categories pc ON pc.category_id = c.id WHERE pc.product_id = $1`, [productId]),
      this.db.query<TagRow>(`SELECT t.* FROM product_tags t JOIN product_taggings pt ON pt.tag_id = t.id WHERE pt.product_id = $1`, [productId]),
      this.db.query<ImageRow>(`SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order`, [productId]),
    ]);

    const optionsMap = new Map<string, VariantOption[]>();
    for (const opt of optionsResult.rows) {
      const list = optionsMap.get(opt.variant_id) ?? [];
      list.push({ id: opt.id, variantId: opt.variant_id, optionName: opt.option_name, optionValue: opt.option_value });
      optionsMap.set(opt.variant_id, list);
    }

    const inventoryMap = new Map<string, Inventory>();
    for (const inv of inventoryResult.rows) {
      inventoryMap.set(inv.variant_id, {
        id: inv.id,
        variantId: inv.variant_id,
        quantity: inv.quantity,
        reservedQuantity: inv.reserved_quantity,
        updatedAt: inv.updated_at,
      });
    }

    const variants: ProductVariant[] = variantsResult.rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      sku: row.sku,
      name: row.name,
      priceDelta: parseFloat(row.price_delta),
      status: row.status,
      options: optionsMap.get(row.id) ?? [],
      inventory: inventoryMap.get(row.id) ?? (() => { throw new RepositoryError('NOT_FOUND', `Inventory not found for variant ${row.id}`); })(),
    }));

    return {
      ...product,
      variants,
      categories: categoriesResult.rows.map(this.mapCategory),
      tags: tagsResult.rows.map(this.mapTag),
      images: imagesResult.rows.map((row) => ({
        id: row.id,
        productId: row.product_id,
        url: row.url,
        altText: row.alt_text,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
      })),
    };
  }

  async list(storeId: string, filters: ProductFilters): Promise<PaginatedProducts> {
    const conditions: string[] = ['p.store_id = $1'];
    const values: unknown[] = [storeId];
    let idx = 2;

    if (filters.status) {
      conditions.push(`p.status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.categoryId) {
      conditions.push(`EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.id AND pc.category_id = $${idx++})`);
      values.push(filters.categoryId);
    }
    if (filters.search) {
      conditions.push(`(p.name ILIKE $${idx++} OR p.slug ILIKE $${idx++})`);
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const where = conditions.join(' AND ');

    const sortField = filters.sort?.startsWith('-') ? filters.sort.slice(1) : filters.sort;
    const sortDir = filters.sort?.startsWith('-') ? 'DESC' : 'ASC';
    let orderBy = 'p.created_at DESC';
    if (sortField === 'name') orderBy = `p.name ${sortDir}`;
    else if (sortField === 'basePrice') orderBy = `p.base_price ${sortDir}`;
    else if (sortField === 'status') orderBy = `p.status ${sortDir}`;
    else if (sortField === 'createdAt') orderBy = `p.created_at ${sortDir}`;

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM products p WHERE ${where}`,
      values,
    );
    const total = parseInt(countResult.rows[0]!.count, 10);

    const page = Math.max(1, filters.page);
    const limit = Math.max(1, Math.min(100, filters.limit));
    const offset = (page - 1) * limit;

    const productResult = await this.db.query<ProductRow>(
      `SELECT p.* FROM products p WHERE ${where} ORDER BY ${orderBy} LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    const items = productResult.rows.map(this.mapProduct);
    const totalPages = Math.ceil(total / limit);

    return { items, total, page, limit, totalPages };
  }

  async update(productId: string, storeId: string, updates: Partial<Pick<Product, 'name' | 'slug' | 'description' | 'basePrice' | 'status'>>): Promise<Product> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) { sets.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.slug !== undefined) { sets.push(`slug = $${idx++}`); values.push(updates.slug); }
    if (updates.description !== undefined) { sets.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.basePrice !== undefined) { sets.push(`base_price = $${idx++}`); values.push(updates.basePrice); }
    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); values.push(updates.status); }

    if (sets.length === 0) {
      const existing = await this.findById(productId, storeId);
      if (!existing) throw new RepositoryError('NOT_FOUND', 'Product not found');
      return existing;
    }

    sets.push(`updated_at = now()`);
    values.push(productId);
    values.push(storeId);

    const result = await this.db.query<ProductRow>(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${idx} AND store_id = $${idx + 1} RETURNING *`,
      values,
    );
    if (result.rowCount === 0) throw new RepositoryError('NOT_FOUND', 'Product not found');
    return this.mapProduct(result.rows[0]!);
  }

  async archive(productId: string, storeId: string): Promise<Product> {
    const result = await this.db.query<ProductRow>(
      `UPDATE products SET status = 'ARCHIVED', updated_at = now() WHERE id = $1 AND store_id = $2 RETURNING *`,
      [productId, storeId],
    );
    if (result.rowCount === 0) throw new RepositoryError('NOT_FOUND', 'Product not found');
    return this.mapProduct(result.rows[0]!);
  }

  async existsSlug(storeId: string, slug: string, excludeId?: string): Promise<boolean> {
    const sql = excludeId
      ? `SELECT 1 FROM products WHERE store_id = $1 AND slug = $2 AND id <> $3 LIMIT 1`
      : `SELECT 1 FROM products WHERE store_id = $1 AND slug = $2 LIMIT 1`;
    const values = excludeId ? [storeId, slug, excludeId] : [storeId, slug];
    const result = await this.db.query(sql, values);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async existsSku(sku: string, excludeVariantId?: string): Promise<boolean> {
    const sql = excludeVariantId
      ? `SELECT 1 FROM product_variants WHERE sku = $1 AND id <> $2 LIMIT 1`
      : `SELECT 1 FROM product_variants WHERE sku = $1 LIMIT 1`;
    const values = excludeVariantId ? [sku, excludeVariantId] : [sku];
    const result = await this.db.query(sql, values);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async duplicate(productId: string, storeId: string, createdBy: string): Promise<Product> {
    return this.transaction(async (executor) => {
      const original = await this.findById(productId, storeId, executor);
      if (!original) throw new RepositoryError('NOT_FOUND', 'Product not found');

      const newSlug = `${original.slug}-copy-${Date.now()}`;

      let productResult;
      try {
        productResult = await executor.query<ProductRow>(
          `INSERT INTO products (store_id, name, slug, description, base_price, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [storeId, `${original.name} (Copy)`, newSlug, original.description, original.basePrice, 'DRAFT', createdBy],
        );
      } catch (error) {
        return mapConflict(error, 'Product slug already exists');
      }
      const newProduct = this.mapProduct(productResult.rows[0]!);

      const variantsResult = await executor.query<VariantRow>(
        `SELECT * FROM product_variants WHERE product_id = $1`,
        [productId],
      );

      for (const variantRow of variantsResult.rows) {
        const newSku = `${variantRow.sku}-COPY-${Date.now()}`;
        let variantResult;
        try {
          variantResult = await executor.query<VariantRow>(
            `INSERT INTO product_variants (product_id, sku, name, price_delta, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [newProduct.id, newSku, variantRow.name, parseFloat(variantRow.price_delta), variantRow.status],
          );
        } catch (error) {
          return mapConflict(error, 'SKU already exists');
        }
        const newVariant = variantResult.rows[0]!;

        const optionsResult = await executor.query<OptionRow>(
          `SELECT * FROM product_variant_options WHERE variant_id = $1`,
          [variantRow.id],
        );
        for (const opt of optionsResult.rows) {
          await executor.query(
            `INSERT INTO product_variant_options (variant_id, option_name, option_value) VALUES ($1, $2, $3)`,
            [newVariant.id, opt.option_name, opt.option_value],
          );
        }

        const inventoryResult = await executor.query<InventoryRow>(
          `SELECT * FROM product_inventory WHERE variant_id = $1`,
          [variantRow.id],
        );
        if (inventoryResult.rows.length > 0) {
          const inv = inventoryResult.rows[0]!;
          await executor.query(
            `INSERT INTO product_inventory (variant_id, quantity, reserved_quantity) VALUES ($1, $2, $3)`,
            [newVariant.id, inv.quantity, inv.reserved_quantity],
          );
        } else {
          await executor.query(
            `INSERT INTO product_inventory (variant_id, quantity, reserved_quantity) VALUES ($1, $2, $3)`,
            [newVariant.id, 0, 0],
          );
        }
      }

      await executor.query(
        `INSERT INTO product_categories (product_id, category_id)
         SELECT $1, category_id FROM product_categories WHERE product_id = $2`,
        [newProduct.id, productId],
      );

      await executor.query(
        `INSERT INTO product_taggings (product_id, tag_id)
         SELECT $1, tag_id FROM product_taggings WHERE product_id = $2`,
        [newProduct.id, productId],
      );

      await executor.query(
        `INSERT INTO product_images (product_id, url, alt_text, sort_order)
         SELECT $1, url, alt_text, sort_order FROM product_images WHERE product_id = $2`,
        [newProduct.id, productId],
      );

      return newProduct;
    });
  }

  async createCategory(storeId: string, name: string, slug: string, parentId?: string | null, sortOrder?: number): Promise<Category> {
    try {
      const result = await this.db.query<CategoryRow>(
        `INSERT INTO categories (store_id, name, slug, parent_id, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [storeId, name, slug, parentId ?? null, sortOrder ?? 0],
      );
      return this.mapCategory(result.rows[0]!);
    } catch (error) {
      return mapConflict(error, 'Category slug already exists');
    }
  }

  async findCategoriesByStore(storeId: string): Promise<Category[]> {
    const result = await this.db.query<CategoryRow>(
      `SELECT * FROM categories WHERE store_id = $1 ORDER BY sort_order, name`,
      [storeId],
    );
    return result.rows.map(this.mapCategory);
  }

  async deleteCategory(categoryId: string, storeId: string): Promise<void> {
    const childrenResult = await this.db.query(
      `SELECT 1 FROM categories WHERE parent_id = $1 LIMIT 1`,
      [categoryId],
    );
    if (childrenResult.rowCount !== null && childrenResult.rowCount > 0) {
      throw new RepositoryError('CONFLICT', 'Category has subcategories');
    }

    const productsResult = await this.db.query(
      `SELECT 1 FROM product_categories WHERE category_id = $1 LIMIT 1`,
      [categoryId],
    );
    if (productsResult.rowCount !== null && productsResult.rowCount > 0) {
      throw new RepositoryError('CONFLICT', 'Category has products');
    }

    const result = await this.db.query(
      `DELETE FROM categories WHERE id = $1 AND store_id = $2`,
      [categoryId, storeId],
    );
    if (result.rowCount === 0) throw new RepositoryError('NOT_FOUND', 'Category not found');
  }

  async getCategoryDepth(categoryId: string): Promise<number> {
    const result = await this.db.query<{ depth: number }>(
      `WITH RECURSIVE ancestors AS (
         SELECT parent_id, 1 AS level
         FROM categories
         WHERE id = $1
         UNION ALL
         SELECT c.parent_id, a.level + 1
         FROM categories c
         JOIN ancestors a ON c.id = a.parent_id
       )
       SELECT COALESCE(MAX(level), 0) AS depth FROM ancestors`,
      [categoryId],
    );
    return result.rows[0]?.depth ?? 0;
  }

  async createTag(storeId: string, name: string): Promise<ProductTag> {
    try {
      const result = await this.db.query<TagRow>(
        `INSERT INTO product_tags (store_id, name) VALUES ($1, $2) RETURNING *`,
        [storeId, name],
      );
      return this.mapTag(result.rows[0]!);
    } catch (error) {
      return mapConflict(error, 'Tag already exists');
    }
  }

  async findTagsByStore(storeId: string): Promise<ProductTag[]> {
    const result = await this.db.query<TagRow>(
      `SELECT * FROM product_tags WHERE store_id = $1 ORDER BY name`,
      [storeId],
    );
    return result.rows.map(this.mapTag);
  }

  async deleteTag(tagId: string, storeId: string): Promise<void> {
    const result = await this.db.query(
      `DELETE FROM product_tags WHERE id = $1 AND store_id = $2`,
      [tagId, storeId],
    );
    if (result.rowCount === 0) throw new RepositoryError('NOT_FOUND', 'Tag not found');
  }

  async updateInventory(variantId: string, quantity: number, reservedQuantity: number): Promise<Inventory> {
    const result = await this.db.query<InventoryRow>(
      `INSERT INTO product_inventory (variant_id, quantity, reserved_quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (variant_id)
       DO UPDATE SET quantity = EXCLUDED.quantity, reserved_quantity = EXCLUDED.reserved_quantity, updated_at = now()
       RETURNING *`,
      [variantId, quantity, reservedQuantity],
    );
    const row = result.rows[0]!;
    return {
      id: row.id,
      variantId: row.variant_id,
      quantity: row.quantity,
      reservedQuantity: row.reserved_quantity,
      updatedAt: row.updated_at,
    };
  }

  private mapProduct(row: ProductRow): Product {
    return {
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      basePrice: parseFloat(row.base_price),
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCategory(row: CategoryRow): Category {
    return {
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      slug: row.slug,
      parentId: row.parent_id,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTag(row: TagRow): ProductTag {
    return {
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      createdAt: row.created_at,
    };
  }
}
