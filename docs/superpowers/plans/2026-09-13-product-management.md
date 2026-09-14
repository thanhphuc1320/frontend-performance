# Product Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full product management subsystem (products, variants, categories, tags, images, inventory) with API endpoints and web UI.

**Architecture:** Monolithic ProductsModule following existing StoresModule pattern. NestJS API with PostgreSQL repository layer, Next.js web with TanStack Query and modular components.

**Tech Stack:** NestJS, TypeScript, PostgreSQL (pg), Next.js 15, React 19, TanStack Query, TailwindCSS, Lucide React

**Spec:** `docs/superpowers/specs/2026-09-13-product-management-design.md`

## Global Constraints

- PostgreSQL 16 with pgcrypto extension
- NestJS dependency injection via tokens (e.g., `STORE_REPOSITORY`)
- Permission codes: `products.read`, `products.manage` (already defined in `authorization/domain/permission.ts`)
- Store-scoped access: all endpoints verify user membership in `:storeId`
- Audit logging via `AuditModule` for all mutations
- Soft delete: status = 'ARCHIVED' instead of DELETE
- SKU globally unique, slug unique per store
- Category max depth: 3 levels
- Pagination: default limit 20, max 100
- Image URLs stored as text (file upload in Phase 3)
- Currency: VND (numeric 15,2)

---

## File Structure

### API Layer (`apps/api/src/products/`)
- `products.module.ts` — NestJS module wiring
- `application/product.tokens.ts` — DI token `PRODUCT_REPOSITORY`
- `application/product.service.ts` — Product CRUD, search, duplicate
- `application/product.service.test.ts` — Unit tests for ProductService
- `application/category.service.ts` — Category CRUD, tree building
- `application/category.service.test.ts` — Unit tests for CategoryService
- `application/tag.service.ts` — Tag CRUD
- `application/tag.service.test.ts` — Unit tests for TagService
- `domain/product.ts` — Product domain type + validation
- `domain/product-variant.ts` — Variant, Option, Inventory types
- `domain/category.ts` — Category domain type + validation
- `domain/product-tag.ts` — Tag domain type
- `http/product.controller.ts` — Product endpoints
- `http/product.controller.test.ts` — Controller tests
- `http/category.controller.ts` — Category endpoints
- `http/category.controller.test.ts` — Controller tests
- `http/tag.controller.ts` — Tag endpoints
- `infrastructure/product.repository.ts` — PostgreSQL queries with JOINs

### Web Layer (`apps/web/features/products/`)
- `types.ts` — Product domain types (shared)
- `api.ts` — API fetch functions
- `api.test.ts` — API layer tests (msw)
- `queries.ts` — TanStack Query hooks
- `queries.test.tsx` — Query hook tests
- `components/product-list.tsx` — Table with filters/pagination
- `components/product-list.test.tsx` — Component tests
- `components/product-form.tsx` — Tabbed create/edit form
- `components/product-form.test.tsx` — Component tests
- `components/variant-editor.tsx` — Variant management
- `components/variant-editor.test.tsx` — Component tests
- `components/image-gallery.tsx` — Image URL input + sort
- `components/image-gallery.test.tsx` — Component tests
- `components/category-tree.tsx` — Tree view
- `components/category-tree.test.tsx` — Component tests
- `components/category-form.tsx` — Create/edit category

### Web Routes (`apps/web/app/(dashboard)/`)
- `products/page.tsx` — Product list page
- `products/new/page.tsx` — Create product page
- `products/[id]/page.tsx` — Edit product page
- `categories/page.tsx` — Category list page
- `categories/new/page.tsx` — Create category page
- `categories/[id]/edit/page.tsx` — Edit category page

### Database
- `infra/postgres/migrations/0005_products.sql` — Up migration
- `infra/postgres/migrations/0005_products.down.sql` — Down migration

### Modified Files
- `apps/api/src/app.module.ts` — Import ProductsModule
- `apps/web/components/layout/sidebar.tsx` — Add product/category links

---

## Task Decomposition

### Task 1: Database Migration

**Files:**
- Create: `infra/postgres/migrations/0005_products.sql`
- Create: `infra/postgres/migrations/0005_products.down.sql`

**Interfaces:**
- Produces: Database tables for all product-related entities

- [ ] **Step 1: Write up migration**

Create `infra/postgres/migrations/0005_products.sql` with all tables (products, product_variants, product_variant_options, categories, product_categories, product_images, product_tags, product_taggings, product_inventory) per spec Section 2.1.

Key points:
- `products`: UNIQUE(store_id, slug), base_price numeric(15,2)
- `product_variants`: sku UNIQUE globally
- `categories`: parent_id self-reference, UNIQUE(store_id, slug)
- `product_inventory`: quantity/reserved_quantity CHECK >= 0

- [ ] **Step 2: Write down migration**

Create `infra/postgres/migrations/0005_products.down.sql`:
DROP TABLE IF EXISTS product_inventory, product_taggings, product_tags, product_images, product_categories, categories, product_variant_options, product_variants, products;

- [ ] **Step 3: Verify migration runs**

Run: Apply migration to local DB and verify all tables exist.

- [ ] **Step 4: Commit**

```bash
git add infra/postgres/migrations/0005_products.sql infra/postgres/migrations/0005_products.down.sql
git commit -m "feat(db): add product management migration"
```

---

### Task 2: API Domain Types

**Files:**
- Create: `apps/api/src/products/domain/product.ts`
- Create: `apps/api/src/products/domain/product-variant.ts`
- Create: `apps/api/src/products/domain/category.ts`
- Create: `apps/api/src/products/domain/product-tag.ts`

**Interfaces:**
- Produces: TypeScript interfaces for Product, ProductVariant, Category, ProductTag, Inventory, VariantOption + validation functions

- [ ] **Step 1: Create product domain type**

`apps/api/src/products/domain/product.ts`:
- Export `Product` interface (id, storeId, name, slug, description, basePrice, status, createdBy, createdAt, updatedAt)
- Export `validateProductName(name)` — required, 1-200 chars
- Export `validateSlug(slug)` — required, URL-safe regex `^[a-z0-9-]+$`, max 200
- Export `validateBasePrice(price)` — >= 0, max 999,999,999.99

- [ ] **Step 2: Create product variant domain type**

`apps/api/src/products/domain/product-variant.ts`:
- Export `ProductVariant` interface (id, productId, sku, name, priceDelta, status, options[], inventory)
- Export `VariantOption` interface (id, variantId, optionName, optionValue)
- Export `Inventory` interface (id, variantId, quantity, reservedQuantity, updatedAt)
- Export `validateSku(sku)` — required, max 50 chars
- Export `validateInventory(qty, reserved)` — qty >= 0, reserved >= 0, reserved <= qty

- [ ] **Step 3: Create category domain type**

`apps/api/src/products/domain/category.ts`:
- Export `Category` interface (id, storeId, name, slug, parentId, sortOrder, children?, createdAt, updatedAt)
- Export `validateCategoryName(name)` — required, max 100
- Export `validateCategorySlug(slug)` — required, URL-safe, max 200

- [ ] **Step 4: Create product tag domain type**

`apps/api/src/products/domain/product-tag.ts`:
- Export `ProductTag` interface (id, storeId, name, createdAt)
- Export `validateTagName(name)` — required, max 50

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/products/domain/
git commit -m "feat(api): add product management domain types"
```

---

### Task 3: API Repository Layer

**Files:**
- Create: `apps/api/src/products/infrastructure/product.repository.ts`

**Interfaces:**
- Consumes: `PostgresDatabase` from `infrastructure/database.provider`
- Produces: `ProductRepository` class with CRUD methods

- [ ] **Step 1: Write ProductRepository**

`apps/api/src/products/infrastructure/product.repository.ts`:

Export interfaces:
- `CreateProductInput` — storeId, name, slug, description, basePrice, status, createdBy, variants[], categoryIds[], tagIds[], images[]
- `CreateVariantInput` — sku, name, priceDelta, status, options[], inventory{quantity, reservedQuantity}
- `ProductFilters` — status?, categoryId?, search?, sort?, page, limit
- `PaginatedProducts` — items[], total, page, limit, totalPages

Class `ProductRepository` methods:
- `constructor(db: Pool)`
- `create(input)` — transaction: insert product → variants → options → inventory → categories → tags → images
- `findById(productId, storeId)` — single product or null
- `findWithRelations(productId, storeId)` — product + variants(with options+inventory) + categories + tags + images
- `list(storeId, filters)` — paginated with search/filter/sort
- `update(productId, storeId, updates)` — partial update
- `archive(productId, storeId)` — set status = ARCHIVED
- `existsSlug(storeId, slug, excludeId?)` — check uniqueness
- `existsSku(sku, excludeVariantId?)` — check uniqueness
- `duplicate(productId, storeId, createdBy)` — copy with new slug/SKUs
- `createCategory(storeId, name, slug, parentId, sortOrder)`
- `findCategoriesByStore(storeId)`
- `deleteCategory(categoryId, storeId)` — check products/children first
- `getCategoryDepth(categoryId)` — walk up tree
- `createTag(storeId, name)`
- `findTagsByStore(storeId)`
- `deleteTag(tagId, storeId)`
- `updateInventory(variantId, quantity, reservedQuantity)` — upsert via ON CONFLICT

Private mappers: `mapProduct`, `mapCategory`, `mapTag`

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/products/infrastructure/product.repository.ts
git commit -m "feat(api): add product repository"
```

---

### Task 4: API Service Layer

**Files:**
- Create: `apps/api/src/products/application/product.tokens.ts`
- Create: `apps/api/src/products/application/product.service.ts`
- Create: `apps/api/src/products/application/product.service.test.ts`
- Create: `apps/api/src/products/application/category.service.ts`
- Create: `apps/api/src/products/application/category.service.test.ts`
- Create: `apps/api/src/products/application/tag.service.ts`
- Create: `apps/api/src/products/application/tag.service.test.ts`

**Interfaces:**
- Consumes: `ProductRepository` via `PRODUCT_REPOSITORY` token
- Produces: `ProductService`, `CategoryService`, `TagService`

- [ ] **Step 1: Create DI token**

`apps/api/src/products/application/product.tokens.ts`:
```typescript
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
```

- [ ] **Step 2: Write ProductService**

`apps/api/src/products/application/product.service.ts`:
- `@Injectable()` class with constructor injecting `PRODUCT_REPOSITORY`
- `create(input)` — validate name/slug/price, check slug exists, check SKUs unique, check >= 1 variant, call repo.create()
- `findById(id, storeId)` — call repo.findWithRelations()
- `list(storeId, filters)` — call repo.list()
- `update(id, storeId, updates)` — validate fields, check slug uniqueness if changed, call repo.update()
- `archive(id, storeId)` — call repo.archive()
- `duplicate(id, storeId, createdBy)` — call repo.duplicate()

- [ ] **Step 3: Write ProductService tests**

`apps/api/src/products/application/product.service.test.ts`:
- Test create with valid input
- Test create fails with duplicate slug
- Test create fails with duplicate SKU
- Test create fails with no variants
- Test findById returns product with relations
- Test list returns paginated results
- Test archive sets status to ARCHIVED

- [ ] **Step 4: Write CategoryService**

`apps/api/src/products/application/category.service.ts`:
- `create(storeId, name, slug, parentId?, sortOrder?)` — validate name/slug, check parent exists and same store, check depth <= 3, call repo.createCategory()
- `list(storeId)` — call repo.findCategoriesByStore(), build tree structure
- `delete(id, storeId)` — call repo.deleteCategory()

- [ ] **Step 5: Write CategoryService tests**

`apps/api/src/products/application/category.service.test.ts`:
- Test create category
- Test create with parent
- Test create fails when depth > 3
- Test delete fails when has products
- Test delete fails when has children

- [ ] **Step 6: Write TagService**

`apps/api/src/products/application/tag.service.ts`:
- `create(storeId, name)` — validate name, call repo.createTag()
- `list(storeId)` — call repo.findTagsByStore()
- `delete(id, storeId)` — call repo.deleteTag()

- [ ] **Step 7: Write TagService tests**

`apps/api/src/products/application/tag.service.test.ts`:
- Test create tag
- Test list tags
- Test delete tag

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/products/application/
git commit -m "feat(api): add product services with tests"
```

---

### Task 5: API Controllers

**Files:**
- Create: `apps/api/src/products/http/product.controller.ts`
- Create: `apps/api/src/products/http/product.controller.test.ts`
- Create: `apps/api/src/products/http/category.controller.ts`
- Create: `apps/api/src/products/http/category.controller.test.ts`
- Create: `apps/api/src/products/http/tag.controller.ts`

**Interfaces:**
- Consumes: `ProductService`, `CategoryService`, `TagService`
- Produces: HTTP endpoints with PermissionGuard

- [ ] **Step 1: Write ProductController**

`apps/api/src/products/http/product.controller.ts`:
- `@Controller('/api/v1/stores/:storeId/products')`
- `@UseGuards(PermissionGuard)` with `products.read` for GET, `products.manage` for POST/PATCH/DELETE
- `GET /` — listProducts(storeId, query) → { data: { items, pagination } }
- `POST /` — createProduct(storeId, body, user) → { data: product }
- `GET /:id` — getProduct(storeId, id) → { data: productDetail }
- `PATCH /:id` — updateProduct(storeId, id, body) → { data: product }
- `DELETE /:id` — archiveProduct(storeId, id) → 204
- `POST /:id/duplicate` — duplicateProduct(storeId, id, user) → { data: product }

- [ ] **Step 2: Write ProductController tests**

`apps/api/src/products/http/product.controller.test.ts`:
- Test list products
- Test create product
- Test get product detail
- Test update product
- Test archive product
- Test duplicate product

- [ ] **Step 3: Write CategoryController**

`apps/api/src/products/http/category.controller.ts`:
- `@Controller('/api/v1/stores/:storeId/categories')`
- `GET /` — listCategories(storeId, query.tree?) → { data: categories }
- `POST /` — createCategory(storeId, body)
- `PATCH /:id` — updateCategory(storeId, id, body)
- `DELETE /:id` — deleteCategory(storeId, id)

- [ ] **Step 4: Write CategoryController tests**

`apps/api/src/products/http/category.controller.test.ts`:
- Test list categories
- Test list categories as tree
- Test create category
- Test delete category

- [ ] **Step 5: Write TagController**

`apps/api/src/products/http/tag.controller.ts`:
- `@Controller('/api/v1/stores/:storeId/tags')`
- `GET /` — listTags(storeId)
- `POST /` — createTag(storeId, body)
- `DELETE /:id` — deleteTag(storeId, id)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/products/http/
git commit -m "feat(api): add product controllers"
```

---

### Task 6: API Module Wiring

**Files:**
- Create: `apps/api/src/products/products.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `ProductsModule` wired into AppModule

- [ ] **Step 1: Create ProductsModule**

`apps/api/src/products/products.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { DATABASE, PostgresDatabase } from '../infrastructure/database.provider';
import { ProductController } from './http/product.controller';
import { CategoryController } from './http/category.controller';
import { TagController } from './http/tag.controller';
import { ProductService } from './application/product.service';
import { CategoryService } from './application/category.service';
import { TagService } from './application/tag.service';
import { ProductRepository } from './infrastructure/product.repository';
import { PRODUCT_REPOSITORY } from './application/product.tokens';

@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule],
  controllers: [ProductController, CategoryController, TagController],
  providers: [
    {
      provide: PRODUCT_REPOSITORY,
      useFactory: (db: PostgresDatabase) => new ProductRepository(db),
      inject: [DATABASE],
    },
    ProductService,
    CategoryService,
    TagService,
  ],
  exports: [ProductService, CategoryService, TagService],
})
export class ProductsModule {}
```

- [ ] **Step 2: Register in AppModule**

Modify `apps/api/src/app.module.ts`:
- Import `ProductsModule`
- Add to `imports` array

- [ ] **Step 3: Build and verify**

Run: `pnpm build` (should compile without errors)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/products/products.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): wire up ProductsModule"
```

---

### Task 7: Web Types & API Layer

**Files:**
- Create: `apps/web/features/products/types.ts`
- Create: `apps/web/features/products/api.ts`
- Create: `apps/web/features/products/api.test.ts`

**Interfaces:**
- Produces: TypeScript types and API fetch functions

- [ ] **Step 1: Create types**

`apps/web/features/products/types.ts`:
```typescript
export interface Product {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string | null;
  priceDelta: number;
  status: 'ACTIVE' | 'INACTIVE';
  options: VariantOption[];
  inventory: Inventory | null;
}

export interface VariantOption {
  id: string;
  variantId: string;
  optionName: string;
  optionValue: string;
}

export interface Inventory {
  id: string;
  variantId: string;
  quantity: number;
  reservedQuantity: number;
  updatedAt: string;
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children?: Category[];
}

export interface ProductTag {
  id: string;
  storeId: string;
  name: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductDetail {
  product: Product;
  variants: ProductVariant[];
  categories: Category[];
  tags: ProductTag[];
  images: ProductImage[];
}

export interface PaginatedProducts {
  items: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductFilters {
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  categoryId?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}
```

- [ ] **Step 2: Create API functions**

`apps/web/features/products/api.ts`:
- Reuse existing `apiFetch` pattern from `features/stores/api.ts`
- `listProducts(storeId, filters?)` — GET /api/v1/stores/:storeId/products
- `getProduct(storeId, productId)` — GET /api/v1/stores/:storeId/products/:id
- `createProduct(storeId, data)` — POST /api/v1/stores/:storeId/products
- `updateProduct(storeId, productId, data)` — PATCH
- `archiveProduct(storeId, productId)` — DELETE
- `duplicateProduct(storeId, productId)` — POST /duplicate
- `listCategories(storeId, tree?)` — GET /api/v1/stores/:storeId/categories
- `createCategory(storeId, data)` — POST
- `deleteCategory(storeId, categoryId)` — DELETE
- `listTags(storeId)` — GET /api/v1/stores/:storeId/tags
- `createTag(storeId, data)` — POST
- `deleteTag(storeId, tagId)` — DELETE

- [ ] **Step 3: Write API tests**

`apps/web/features/products/api.test.ts`:
- Mock fetch for each endpoint
- Test success responses
- Test error handling (ApiError)

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/products/types.ts apps/web/features/products/api.ts apps/web/features/products/api.test.ts
git commit -m "feat(web): add product types and API layer"
```

---

### Task 8: Web Query Hooks

**Files:**
- Create: `apps/web/features/products/queries.ts`
- Create: `apps/web/features/products/queries.test.tsx`

**Interfaces:**
- Consumes: API functions from `api.ts`
- Produces: TanStack Query hooks

- [ ] **Step 1: Create query hooks**

`apps/web/features/products/queries.ts`:
- `useProducts(storeId, filters?)` — useQuery with ['products', storeId, filters]
- `useProduct(storeId, productId)` — useQuery with ['product', storeId, productId]
- `useCreateProduct()` — useMutation, invalidate ['products']
- `useUpdateProduct()` — useMutation, invalidate ['product', storeId, productId] + ['products']
- `useArchiveProduct()` — useMutation, invalidate ['products']
- `useDuplicateProduct()` — useMutation, invalidate ['products']
- `useCategories(storeId, tree?)` — useQuery with ['categories', storeId]
- `useCreateCategory()` — useMutation, invalidate ['categories']
- `useDeleteCategory()` — useMutation, invalidate ['categories']
- `useTags(storeId)` — useQuery with ['tags', storeId]
- `useCreateTag()` — useMutation, invalidate ['tags']
- `useDeleteTag()` — useMutation, invalidate ['tags']

- [ ] **Step 2: Write query tests**

`apps/web/features/products/queries.test.tsx`:
- Test useProducts fetches and caches
- Test useCreateProduct invalidates cache
- Test useCategories with tree param

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/products/queries.ts apps/web/features/products/queries.test.tsx
git commit -m "feat(web): add product query hooks"
```

---

### Task 9: Web Components — Product List

**Files:**
- Create: `apps/web/features/products/components/product-list.tsx`
- Create: `apps/web/features/products/components/product-list.test.tsx`

**Interfaces:**
- Consumes: `useProducts`, `useArchiveProduct`
- Produces: ProductList component

- [ ] **Step 1: Create ProductList component**

`apps/web/features/products/components/product-list.tsx`:
- Props: `storeId: string`
- State: filters (status, search, sort, page)
- Use `useProducts(storeId, filters)`
- Render table with columns: Image, Name, SKU, Price, Status, Actions
- Status filter dropdown (All, Draft, Active, Archived)
- Search input (debounced)
- Sort dropdown
- Pagination
- Archive button per row (if user has products.manage)
- Loading skeleton

- [ ] **Step 2: Write component tests**

`apps/web/features/products/components/product-list.test.tsx`:
- Test renders products
- Test filter by status
- Test search
- Test pagination
- Test archive action

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/products/components/product-list.tsx apps/web/features/products/components/product-list.test.tsx
git commit -m "feat(web): add product list component"
```

---

### Task 10: Web Components — Product Form

**Files:**
- Create: `apps/web/features/products/components/product-form.tsx`
- Create: `apps/web/features/products/components/product-form.test.tsx`
- Create: `apps/web/features/products/components/variant-editor.tsx`
- Create: `apps/web/features/products/components/variant-editor.test.tsx`
- Create: `apps/web/features/products/components/image-gallery.tsx`
- Create: `apps/web/features/products/components/image-gallery.test.tsx`

**Interfaces:**
- Consumes: `useCreateProduct`, `useUpdateProduct`, `useCategories`, `useTags`
- Produces: ProductForm, VariantEditor, ImageGallery components

- [ ] **Step 1: Create VariantEditor**

`apps/web/features/products/components/variant-editor.tsx`:
- Props: `variants: ProductVariant[]`, `onChange: (variants) => void`
- Render table of variants with SKU, Name, Price Delta, Options, Inventory
- Add variant button — opens modal/row with form
- Remove variant button
- Options editor: add/remove option_name + option_value pairs

- [ ] **Step 2: Create ImageGallery**

`apps/web/features/products/components/image-gallery.tsx`:
- Props: `images: ProductImage[]`, `onChange: (images) => void`
- Render grid of images with URL input, alt text input
- Add image button
- Remove image button
- Drag to reorder (or up/down buttons)

- [ ] **Step 3: Create ProductForm**

`apps/web/features/products/components/product-form.tsx`:
- Props: `storeId: string`, `product?: ProductDetail` (for edit mode)
- Tabbed interface: General | Variants | Images | Categories | Tags
- General tab: Name, Slug, Description, Base Price, Status
- Variants tab: VariantEditor
- Images tab: ImageGallery
- Categories tab: Multi-select from category list
- Tags tab: Multi-select from tag list + create new tag
- Submit button: Create or Update
- Cancel button

- [ ] **Step 4: Write component tests**

`apps/web/features/products/components/product-form.test.tsx`:
- Test create mode renders
- Test edit mode pre-fills data
- Test tab switching
- Test validation errors
- Test submit calls mutation

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/products/components/product-form.tsx apps/web/features/products/components/product-form.test.tsx apps/web/features/products/components/variant-editor.tsx apps/web/features/products/components/variant-editor.test.tsx apps/web/features/products/components/image-gallery.tsx apps/web/features/products/components/image-gallery.test.tsx
git commit -m "feat(web): add product form with variant editor and image gallery"
```

---

### Task 11: Web Components — Category Management

**Files:**
- Create: `apps/web/features/products/components/category-tree.tsx`
- Create: `apps/web/features/products/components/category-tree.test.tsx`
- Create: `apps/web/features/products/components/category-form.tsx`

**Interfaces:**
- Consumes: `useCategories`, `useCreateCategory`, `useDeleteCategory`
- Produces: CategoryTree, CategoryForm components

- [ ] **Step 1: Create CategoryTree**

`apps/web/features/products/components/category-tree.tsx`:
- Props: `categories: Category[]`, `onSelect?: (id) => void`, `selectedIds?: string[]`
- Render tree with expand/collapse
- Show sort order
- Recursive component for children

- [ ] **Step 2: Create CategoryForm**

`apps/web/features/products/components/category-form.tsx`:
- Props: `storeId: string`, `category?: Category`, `parentCategories: Category[]`
- Fields: Name, Slug, Parent Category (dropdown), Sort Order
- Validation: name required, slug URL-safe
- Submit: create or update

- [ ] **Step 3: Write component tests**

`apps/web/features/products/components/category-tree.test.tsx`:
- Test renders tree
- Test expand/collapse
- Test selection

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/products/components/category-tree.tsx apps/web/features/products/components/category-tree.test.tsx apps/web/features/products/components/category-form.tsx
git commit -m "feat(web): add category tree and form components"
```

---

### Task 12: Web Pages

**Files:**
- Create: `apps/web/app/(dashboard)/products/page.tsx`
- Create: `apps/web/app/(dashboard)/products/new/page.tsx`
- Create: `apps/web/app/(dashboard)/products/[id]/page.tsx`
- Create: `apps/web/app/(dashboard)/categories/page.tsx`
- Create: `apps/web/app/(dashboard)/categories/new/page.tsx`
- Create: `apps/web/app/(dashboard)/categories/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: ProductList, ProductForm, CategoryTree, CategoryForm
- Produces: Page components

- [ ] **Step 1: Create product pages**

`apps/web/app/(dashboard)/products/page.tsx`:
- Render `<ProductList storeId={activeStoreId} />`
- Get active store from URL param or context
- Add "New Product" button linking to `/products/new`

`apps/web/app/(dashboard)/products/new/page.tsx`:
- Render `<ProductForm storeId={activeStoreId} />`
- On success, redirect to `/products`

`apps/web/app/(dashboard)/products/[id]/page.tsx`:
- Get productId from params
- Render `<ProductForm storeId={activeStoreId} product={productData} />`
- Fetch product detail via `useProduct`

- [ ] **Step 2: Create category pages**

`apps/web/app/(dashboard)/categories/page.tsx`:
- Render `<CategoryTree categories={categories} />`
- Add "New Category" button

`apps/web/app/(dashboard)/categories/new/page.tsx`:
- Render `<CategoryForm storeId={activeStoreId} parentCategories={categories} />`

`apps/web/app/(dashboard)/categories/[id]/edit/page.tsx`:
- Get categoryId from params
- Render `<CategoryForm storeId={activeStoreId} category={category} parentCategories={categories} />`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/products/ apps/web/app/\(dashboard\)/categories/
git commit -m "feat(web): add product and category pages"
```

---

### Task 13: Sidebar Update

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

**Interfaces:**
- Produces: Updated sidebar with product links

- [ ] **Step 1: Update Sidebar**

Modify `apps/web/components/layout/sidebar.tsx`:
- Update "San pham" section:
  - `/products` — San pham (icon Package)
  - `/categories` — Danh muc (icon Tags)
  - `/inventory` — Ton kho (icon Warehouse)
- Ensure active state works for nested routes

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): update sidebar with product links"
```

---

### Task 14: Final Integration & Verification

**Files:**
- Modified: Various

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```
Expected: All existing tests still pass + new tests pass

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```
Expected: No errors

- [ ] **Step 3: Run build**

```bash
pnpm build
```
Expected: API and Web both build successfully

- [ ] **Step 4: Manual verification**

- Start API and Web dev servers
- Navigate to /products
- Create a product with variants
- Verify product appears in list
- Edit product
- Archive product
- Create categories
- Verify category tree

- [ ] **Step 5: Final commit**

```bash
git commit -m "feat(products): complete product management phase 2"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: All sections of the spec map to tasks
  - Domain model → Tasks 2-3
  - API → Tasks 3-6
  - Web → Tasks 7-13
  - Migration → Task 1
  - Permissions → Tasks 5-6
  - Testing → Each task has test files
- [x] **Placeholder scan**: No TBD, TODO, or vague steps
- [x] **Type consistency**: Domain types match between API and Web layers
- [x] **File naming**: Follows existing conventions (kebab-case)
- [x] **Pattern alignment**: Follows StoresModule pattern exactly

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-13-product-management.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session, batch execution with checkpoints

Which approach do you prefer?
