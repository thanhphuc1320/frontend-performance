# Product Management Design Spec

**Date:** 2026-09-13  
**Branch:** `phase-2-products`  
**Status:** Approved  
**Scope:** Full product management subsystem (products, variants, categories, tags, images, inventory)

---

## 1. Overview

### 1.1 Purpose
Implement a full-featured product management system for the Commerce Control Center, allowing store owners and staff to create, manage, and organize products with variants, categories, tags, images, and inventory tracking.

### 1.2 Goals
- Store-scoped product catalog with full CRUD operations
- Product variants with SKU-based inventory
- Hierarchical category management
- Tag-based product organization
- Image management per product
- Real-time inventory tracking at variant level
- Permission-gated access (products.read, products.manage)

### 1.3 Non-Goals
- Bulk import/export (Phase 3)
- Advanced pricing rules (promotions, tiers)
- Multi-warehouse inventory
- Product reviews/ratings
- SEO optimization tools
- Channel-specific product publishing

---

## 2. Domain Model

### 2.1 Database Schema

#### products
```sql
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
```

#### product_variants
```sql
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
```

#### product_variant_options
```sql
CREATE TABLE product_variant_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  option_name text NOT NULL CHECK (length(btrim(option_name)) > 0),
  option_value text NOT NULL CHECK (length(btrim(option_value)) > 0),
  UNIQUE(variant_id, option_name)
);
CREATE INDEX product_variant_options_variant_idx ON product_variant_options (variant_id);
```

#### categories
```sql
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
```

#### product_categories
```sql
CREATE TABLE product_categories (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);
```

#### product_images
```sql
CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (length(btrim(url)) > 0),
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_idx ON product_images (product_id, sort_order);
```

#### product_tags
```sql
CREATE TABLE product_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);
```

#### product_taggings
```sql
CREATE TABLE product_taggings (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
```

#### product_inventory
```sql
CREATE TABLE product_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(variant_id)
);
CREATE INDEX product_inventory_variant_idx ON product_inventory (variant_id);
```

### 2.2 Domain Objects

```typescript
interface Product {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string | null;
  priceDelta: number;
  status: 'ACTIVE' | 'INACTIVE';
  options: VariantOption[];
  inventory: Inventory | null;
}

interface VariantOption {
  id: string;
  variantId: string;
  optionName: string;
  optionValue: string;
}

interface Category {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children?: Category[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProductTag {
  id: string;
  storeId: string;
  name: string;
  createdAt: Date;
}

interface ProductImage {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

interface Inventory {
  id: string;
  variantId: string;
  quantity: number;
  reservedQuantity: number;
  available: number; // computed: quantity - reservedQuantity
  updatedAt: Date;
}
```

---

## 3. Architecture

### 3.1 Module Structure

```
products/
├── products.module.ts
├── application/
│   ├── product.service.ts
│   ├── product.service.test.ts
│   ├── category.service.ts
│   ├── category.service.test.ts
│   ├── tag.service.ts
│   ├── tag.service.test.ts
│   └── product.tokens.ts
├── domain/
│   ├── product.ts
│   ├── product-variant.ts
│   ├── category.ts
│   └── product-tag.ts
├── http/
│   ├── product.controller.ts
│   ├── product.controller.test.ts
│   ├── category.controller.ts
│   ├── category.controller.test.ts
│   └── tag.controller.ts
└── infrastructure/
    ├── product.repository.ts
    └── product.repository.test.ts
```

### 3.2 Dependency Injection

```typescript
@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule],
  controllers: [ProductController, CategoryController, TagController],
  providers: [
    { provide: PRODUCT_REPOSITORY, useFactory: (db: PostgresDatabase) => new ProductRepository(db), inject: [DATABASE] },
    ProductService,
    CategoryService,
    TagService,
  ],
  exports: [ProductService, CategoryService, TagService],
})
export class ProductsModule {}
```

### 3.3 Integration Points

- **AppModule**: Import ProductsModule
- **PermissionGuard**: Reuses existing guard with products.read/products.manage
- **AuditModule**: Logs all mutations
- **Database**: Reuses existing DATABASE token and PostgresDatabase

---

## 4. API Specification

### 4.1 Products Endpoints

#### List Products
```
GET /api/v1/stores/:storeId/products
```
Query params: status, categoryId, search, sort (created_at_desc|name_asc|price_desc), page (default 1), limit (default 20, max 100)

#### Get Product Detail
```
GET /api/v1/stores/:storeId/products/:id
```
Includes: product + variants (with options + inventory) + categories + tags + images

#### Create Product
```
POST /api/v1/stores/:storeId/products
```
Body: { name, slug, description, basePrice, status, variants[], categoryIds[], tagIds[], images[] }

#### Update Product
```
PATCH /api/v1/stores/:storeId/products/:id
```

#### Archive Product
```
DELETE /api/v1/stores/:storeId/products/:id
```
Sets status to ARCHIVED

#### Duplicate Product
```
POST /api/v1/stores/:storeId/products/:id/duplicate
```

### 4.2 Categories Endpoints

#### List Categories
```
GET /api/v1/stores/:storeId/categories?tree=true
```

#### Create/Update/Delete Category
```
POST /api/v1/stores/:storeId/categories
PATCH /api/v1/stores/:storeId/categories/:id
DELETE /api/v1/stores/:storeId/categories/:id
```

### 4.3 Tags Endpoints

```
GET /api/v1/stores/:storeId/tags
POST /api/v1/stores/:storeId/tags
DELETE /api/v1/stores/:storeId/tags/:id
```

### 4.4 Inventory Endpoints

```
PATCH /api/v1/stores/:storeId/products/:productId/variants/:variantId/inventory
```

---

## 5. Frontend Structure

### 5.1 Routes

```
(dashboard)/
├── products/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── categories/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/edit/page.tsx
```

### 5.2 Components

```
features/products/
├── api.ts, api.test.ts
├── queries.ts, queries.test.tsx
├── types.ts
└── components/
    ├── product-list.tsx, product-list.test.tsx
    ├── product-form.tsx, product-form.test.tsx
    ├── variant-editor.tsx, variant-editor.test.tsx
    ├── image-gallery.tsx, image-gallery.test.tsx
    ├── category-tree.tsx, category-tree.test.tsx
    └── category-form.tsx
```

### 5.3 Sidebar Updates

```typescript
<SidebarSection title="San pham">
  <SidebarNavItem href="/products" icon={Package} label="San pham" />
  <SidebarNavItem href="/categories" icon={Tags} label="Danh muc" />
  <SidebarNavItem href="/inventory" icon={Warehouse} label="Ton kho" />
</SidebarSection>
```

---

## 6. Permissions & Authorization

| Permission | Action |
|---|---|
| products.read | List, view products, categories, tags |
| products.manage | Create, update, archive products; manage categories, tags, inventory |

All endpoints verify: user has active membership in storeId + role has required permission.

---

## 7. Validation Rules

- **Product**: name (1-200), slug (URL-safe, unique per store), basePrice (>= 0), at least 1 variant
- **Variant**: sku (unique globally, 1-50), options (1-5 per variant), inventory.quantity >= 0
- **Category**: name (1-100), slug (unique per store), max depth 3 levels
- **Tag**: name (1-50, unique per store)

---

## 8. Error Handling

| Code | HTTP | When |
|---|---|---|
| PRODUCT_NOT_FOUND | 404 | Invalid product ID |
| CATEGORY_NOT_FOUND | 404 | Invalid category ID |
| DUPLICATE_SLUG | 409 | Duplicate slug in store |
| DUPLICATE_SKU | 409 | Duplicate SKU globally |
| CATEGORY_HAS_PRODUCTS | 409 | Delete category with products |
| MAX_DEPTH_EXCEEDED | 400 | > 3 category levels |

---

## 9. Testing Strategy

- **API**: Service unit tests, controller tests, permission integration
- **Web**: Component tests (list, form, editor, tree), API tests, query tests
- **E2E**: Create/edit/archive product, category CRUD, permission denial

---

## 10. Audit & Logging

All mutations logged via AuditModule: product.created, product.updated, product.archived, product.duplicated, category.created/deleted, tag.created/deleted, inventory.updated.

---

## 11. Migration

**File:** `infra/postgres/migrations/0005_products.sql` + `0005_products.down.sql`

---

## 12. Files Summary

### New (~35 files)
- API: 18 files (module, services, controllers, domain, repository)
- Web: 14 files (api, queries, components, routes)
- Migration: 2 files

### Modified (~3 files)
- `apps/api/src/app.module.ts`
- `apps/web/components/layout/sidebar.tsx`
- `.github/workflows/ci.yml` (if migration needed in e2e)

---

## 13. Estimated Effort

- API Layer: 6-8 hours
- Web Components: 8-10 hours
- Tests: 4-6 hours
- Migration + Setup: 1-2 hours
- **Total: ~20-26 hours**
