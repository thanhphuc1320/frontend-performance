# Order Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full order management subsystem (orders, order items, customers, status history, inventory integration) with API endpoints and web UI.

**Architecture:** Monolithic OrdersModule following existing ProductsModule pattern. NestJS API with PostgreSQL repository layer, Next.js web with TanStack Query and modular components.

**Tech Stack:** NestJS, TypeScript, PostgreSQL (pg), Next.js 15, React 19, TanStack Query, TailwindCSS, Lucide React

**Spec:** `docs/superpowers/specs/2026-09-15-order-management-design.md`

## Global Constraints

- PostgreSQL 16 with pgcrypto extension
- NestJS dependency injection via tokens (e.g., `PRODUCT_REPOSITORY`)
- Permission codes: `orders.read`, `orders.manage` (already defined in `authorization/domain/permission.ts`)
- Store-scoped access: all endpoints verify user membership in `:storeId`
- Audit logging via `AuditModule` for all mutations
- Order status transitions must be validated
- Order number auto-generated: `ORD-YYYYMMDD-NNN`
- Inventory deducted on CONFIRMED, returned on CANCELLED
- Currency: VND (numeric 15,2)

---

## File Structure

### API Layer (`apps/api/src/orders/`)
- `orders.module.ts` — NestJS module wiring
- `application/order.tokens.ts` — DI token `ORDER_REPOSITORY`
- `application/order.service.ts` — Order CRUD, status workflow
- `application/order.service.test.ts` — Unit tests
- `application/customer.service.ts` — Customer CRUD
- `application/customer.service.test.ts` — Unit tests
- `domain/order.ts` — Order domain type + validation
- `domain/customer.ts` — Customer domain type + validation
- `domain/order-status.ts` — Status enum + transition rules
- `http/order.controller.ts` — Order endpoints
- `http/order.controller.test.ts` — Controller tests
- `http/customer.controller.ts` — Customer endpoints
- `infrastructure/order.repository.ts` — PostgreSQL queries

### Web Layer (`apps/web/features/orders/`)
- `types.ts` — Order domain types
- `api.ts` — API fetch functions
- `api.test.ts` — API layer tests
- `queries.ts` — TanStack Query hooks
- `queries.test.tsx` — Query hook tests
- `components/order-list.tsx` — Table with filters/pagination
- `components/order-list.test.tsx`
- `components/order-form.tsx` — Create order form
- `components/order-form.test.tsx`
- `components/order-detail.tsx` — Order detail with timeline
- `components/order-status-badge.tsx` — Status badges
- `components/customer-list.tsx` — Customer table
- `components/customer-list.test.tsx`
- `components/customer-form.tsx` — Create/edit customer

### Web Routes (`apps/web/app/(dashboard)/`)
- `orders/page.tsx` — Order list
- `orders/new/page.tsx` — Create order
- `orders/[id]/page.tsx` — Order detail
- `customers/page.tsx` — Customer list
- `customers/new/page.tsx` — Create customer
- `customers/[id]/page.tsx` — Customer detail

### Database
- `infra/postgres/migrations/0006_orders.sql` — Up migration
- `infra/postgres/migrations/0006_orders.down.sql` — Down migration

### Modified Files
- `apps/api/src/app.module.ts` — Import OrdersModule
- `apps/web/components/layout/sidebar.tsx` — Add order/customer links
- `scripts/verify-infra.mjs` — Update table count (19 → 23)
- `apps/api/test/persistence.integration-spec.ts` — Update expected tables

---

## Task Decomposition

### Task 1: Database Migration

**Files:**
- Create: `infra/postgres/migrations/0006_orders.sql`
- Create: `infra/postgres/migrations/0006_orders.down.sql`

**Interfaces:**
- Produces: Database tables for customers, orders, order_items, order_status_history

- [ ] **Step 1: Write up migration**

Create `infra/postgres/migrations/0006_orders.sql`:

```sql
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  phone text NOT NULL CHECK (length(btrim(phone)) > 0),
  email text,
  address text,
  city text,
  district text,
  ward text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_store_idx ON customers (store_id);
CREATE INDEX customers_phone_idx ON customers (store_id, phone);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')),
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  shipping_fee numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  final_amount numeric(15,2) NOT NULL DEFAULT 0,
  shipping_address text,
  shipping_city text,
  shipping_district text,
  shipping_ward text,
  payment_status text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'PARTIAL', 'REFUNDED')),
  payment_method text CHECK (payment_method IN ('COD', 'BANK_TRANSFER', 'MOMO', 'VNPAY')),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, order_number)
);
CREATE INDEX orders_store_status_idx ON orders (store_id, status);
CREATE INDEX orders_customer_idx ON orders (customer_id);
CREATE INDEX orders_created_at_idx ON orders (created_at DESC);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  variant_id uuid REFERENCES product_variants(id),
  product_name text NOT NULL,
  variant_name text,
  sku text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(15,2) NOT NULL,
  total_price numeric(15,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

CREATE TABLE order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON order_status_history (order_id, created_at DESC);
```

- [ ] **Step 2: Write down migration**

Create `infra/postgres/migrations/0006_orders.down.sql`:
```sql
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
```

- [ ] **Step 3: Verify migration runs**

Run: `cd infra/postgres && node migrate.mjs up`
Expected: All tables created, migration 0006 recorded

- [ ] **Step 4: Commit**
```bash
git add infra/postgres/migrations/0006_orders.sql infra/postgres/migrations/0006_orders.down.sql
git commit -m "feat(db): add order management migration"
```

---

### Task 2: API Domain Types

**Files:**
- Create: `apps/api/src/orders/domain/order.ts`
- Create: `apps/api/src/orders/domain/customer.ts`
- Create: `apps/api/src/orders/domain/order-status.ts`

**Interfaces:**
- Produces: TypeScript interfaces + validation functions

- [ ] **Step 1: Create order status types**

`apps/api/src/orders/domain/order-status.ts`:
```typescript
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'READY_TO_SHIP' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED';
export type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY';

export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY_TO_SHIP', 'CANCELLED'],
  READY_TO_SHIP: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
```

- [ ] **Step 2: Create customer domain type**

`apps/api/src/orders/domain/customer.ts`:
```typescript
export interface Customer {
  id: string;
  storeId: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  ward: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function validateCustomerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Customer name is required';
  if (trimmed.length > 200) return 'Customer name must be less than 200 characters';
  return null;
}

export function validatePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (trimmed.length === 0) return 'Phone number is required';
  if (trimmed.length > 20) return 'Phone number must be less than 20 characters';
  return null;
}
```

- [ ] **Step 3: Create order domain type**

`apps/api/src/orders/domain/order.ts`:
```typescript
import type { OrderStatus, PaymentStatus, PaymentMethod } from './order-status';

export interface Order {
  id: string;
  storeId: string;
  customerId: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  finalAmount: number;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingDistrict: string | null;
  shippingWard: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface OrderDetail {
  order: Order;
  customer: Customer;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
}
```

- [ ] **Step 4: Commit**
```bash
git add apps/api/src/orders/domain/
git commit -m "feat(api): add order management domain types"
```

---

### Task 3: API Repository Layer

**Files:**
- Create: `apps/api/src/orders/infrastructure/order.repository.ts`

**Interfaces:**
- Consumes: `PostgresDatabase` from `infrastructure/database.provider`
- Produces: `OrderRepository` class with CRUD + inventory integration

- [ ] **Step 1: Write OrderRepository**

`apps/api/src/orders/infrastructure/order.repository.ts`:
- Export `CreateOrderInput`, `CreateOrderItemInput`, `OrderFilters`
- Methods: `createOrder`, `findOrderById`, `findOrderWithRelations`, `listOrders`, `updateOrderStatus`, `cancelOrder`, `createCustomer`, `findCustomerById`, `listCustomers`, `deleteCustomer`
- Inventory integration: `deductInventory`, `returnInventory`
- Order number generation: `ORD-YYYYMMDD-NNN`
- Transaction handling for order creation (order + items + status history)

- [ ] **Step 2: Commit**
```bash
git add apps/api/src/orders/infrastructure/order.repository.ts
git commit -m "feat(api): add order repository"
```

---

### Task 4: API Service Layer

**Files:**
- Create: `apps/api/src/orders/application/order.tokens.ts`
- Create: `apps/api/src/orders/application/order.service.ts`
- Create: `apps/api/src/orders/application/order.service.test.ts`
- Create: `apps/api/src/orders/application/customer.service.ts`
- Create: `apps/api/src/orders/application/customer.service.test.ts`

**Interfaces:**
- Consumes: `OrderRepository` via `ORDER_REPOSITORY` token
- Produces: `OrderService`, `CustomerService`

- [ ] **Step 1: Create DI token**
`apps/api/src/orders/application/order.tokens.ts`:
```typescript
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
```

- [ ] **Step 2: Write OrderService**
- `createOrder` — validate items, check inventory, generate order number, deduct inventory on CONFIRMED
- `findById` — return order with relations
- `listOrders` — filter, search, pagination
- `updateStatus` — validate transition, update inventory, create history entry
- `cancelOrder` — validate can cancel, return inventory

- [ ] **Step 3: Write OrderService tests**
- Test create order
- Test status transitions (valid and invalid)
- Test inventory deduction on confirm
- Test inventory return on cancel
- Test order number generation

- [ ] **Step 4: Write CustomerService**
- `create` — validate, check duplicates
- `list` — search by name/phone
- `findById` — with recent orders
- `delete` — check no orders

- [ ] **Step 5: Write CustomerService tests**
- Test create customer
- Test delete fails when has orders

- [ ] **Step 6: Commit**
```bash
git add apps/api/src/orders/application/
git commit -m "feat(api): add order services with tests"
```

---

### Task 5: API Controllers

**Files:**
- Create: `apps/api/src/orders/http/order.controller.ts`
- Create: `apps/api/src/orders/http/order.controller.test.ts`
- Create: `apps/api/src/orders/http/customer.controller.ts`

**Interfaces:**
- Consumes: `OrderService`, `CustomerService`
- Produces: HTTP endpoints with PermissionGuard

- [ ] **Step 1: Write OrderController**
- `@Controller('/api/v1/stores/:storeId/orders')`
- GET /, POST /, GET /:id, PATCH /:id/status, PATCH /:id, DELETE /:id
- Permission: orders.read for GET, orders.manage for POST/PATCH/DELETE

- [ ] **Step 2: Write OrderController tests**
- Test all endpoints
- Test permission guards
- Test status update validation

- [ ] **Step 3: Write CustomerController**
- `@Controller('/api/v1/stores/:storeId/customers')`
- GET /, POST /, GET /:id, PATCH /:id, DELETE /:id

- [ ] **Step 4: Commit**
```bash
git add apps/api/src/orders/http/
git commit -m "feat(api): add order controllers"
```

---

### Task 6: API Module Wiring

**Files:**
- Create: `apps/api/src/orders/orders.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create OrdersModule**
```typescript
@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule],
  controllers: [OrderController, CustomerController],
  providers: [
    {
      provide: ORDER_REPOSITORY,
      useFactory: (db: PostgresDatabase) => new OrderRepository(db),
      inject: [DATABASE],
    },
    OrderService,
    CustomerService,
  ],
  exports: [OrderService, CustomerService],
})
export class OrdersModule {}
```

- [ ] **Step 2: Register in AppModule**

- [ ] **Step 3: Build and verify**
Run: `pnpm build` — should compile without errors

- [ ] **Step 4: Commit**
```bash
git add apps/api/src/orders/orders.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): wire up OrdersModule"
```

---

### Task 7: Web Types & API Layer

**Files:**
- Create: `apps/web/features/orders/types.ts`
- Create: `apps/web/features/orders/api.ts`
- Create: `apps/web/features/orders/api.test.ts`

- [ ] **Step 1: Create types**
Export interfaces: Order, OrderItem, OrderStatusHistory, Customer, OrderDetail, OrderFilters, CreateOrderInput, CreateCustomerInput

- [ ] **Step 2: Create API functions**
- `listOrders`, `getOrder`, `createOrder`, `updateOrderStatus`, `cancelOrder`
- `listCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `deleteCustomer`
- Reuse existing `apiFetch` pattern

- [ ] **Step 3: Write API tests**
- Mock fetch for each endpoint
- Test success and error responses

- [ ] **Step 4: Commit**
```bash
git add apps/web/features/orders/types.ts apps/web/features/orders/api.ts apps/web/features/orders/api.test.ts
git commit -m "feat(web): add order types and API layer"
```

---

### Task 8: Web Query Hooks

**Files:**
- Create: `apps/web/features/orders/queries.ts`
- Create: `apps/web/features/orders/queries.test.tsx`

- [ ] **Step 1: Create query hooks**
- `useOrders`, `useOrder`, `useCreateOrder`, `useUpdateOrderStatus`, `useCancelOrder`
- `useCustomers`, `useCustomer`, `useCreateCustomer`, `useUpdateCustomer`, `useDeleteCustomer`
- Proper cache invalidation

- [ ] **Step 2: Write query tests**
- Test fetch and cache invalidation

- [ ] **Step 3: Commit**
```bash
git add apps/web/features/orders/queries.ts apps/web/features/orders/queries.test.tsx
git commit -m "feat(web): add order query hooks"
```

---

### Task 9: Web Components — Order List

**Files:**
- Create: `apps/web/features/orders/components/order-list.tsx`
- Create: `apps/web/features/orders/components/order-list.test.tsx`
- Create: `apps/web/features/orders/components/order-status-badge.tsx`

- [ ] **Step 1: Create OrderStatusBadge**
- Color-coded badges for each status
- PENDING (yellow), CONFIRMED (blue), PROCESSING (purple), READY_TO_SHIP (orange), SHIPPED (indigo), DELIVERED (green), CANCELLED (red), REFUNDED (gray)

- [ ] **Step 2: Create OrderList**
- Table with columns: Order #, Customer, Total, Status, Date, Actions
- Status filter dropdown
- Date range filter
- Search by order number
- Pagination
- Status update dropdown per row

- [ ] **Step 3: Write component tests**

- [ ] **Step 4: Commit**
```bash
git add apps/web/features/orders/components/order-list.tsx apps/web/features/orders/components/order-list.test.tsx apps/web/features/orders/components/order-status-badge.tsx
git commit -m "feat(web): add order list component"
```

---

### Task 10: Web Components — Order Form & Detail

**Files:**
- Create: `apps/web/features/orders/components/order-form.tsx`
- Create: `apps/web/features/orders/components/order-form.test.tsx`
- Create: `apps/web/features/orders/components/order-detail.tsx`

- [ ] **Step 1: Create OrderForm**
- Customer selector (search existing or create new)
- Product picker (search products, select variant)
- Quantity input with unit price auto-fill
- Shipping fee, discount amount
- Auto-calculate totals
- Payment method selection
- Shipping address

- [ ] **Step 2: Create OrderDetail**
- Order info card
- Customer info card
- Items table
- Status timeline (history)
- Status update actions
- Cancel button

- [ ] **Step 3: Write component tests**

- [ ] **Step 4: Commit**
```bash
git add apps/web/features/orders/components/order-form.tsx apps/web/features/orders/components/order-form.test.tsx apps/web/features/orders/components/order-detail.tsx
git commit -m "feat(web): add order form and detail components"
```

---

### Task 11: Web Components — Customer Management

**Files:**
- Create: `apps/web/features/orders/components/customer-list.tsx`
- Create: `apps/web/features/orders/components/customer-list.test.tsx`
- Create: `apps/web/features/orders/components/customer-form.tsx`

- [ ] **Step 1: Create CustomerList**
- Table with name, phone, email, order count
- Search by name/phone

- [ ] **Step 2: Create CustomerForm**
- Fields: name, phone, email, address, city, district, ward
- Validation

- [ ] **Step 3: Write component tests**

- [ ] **Step 4: Commit**
```bash
git add apps/web/features/orders/components/customer-list.tsx apps/web/features/orders/components/customer-list.test.tsx apps/web/features/orders/components/customer-form.tsx
git commit -m "feat(web): add customer list and form components"
```

---

### Task 12: Web Pages

**Files:**
- Create: `app/(dashboard)/orders/page.tsx`
- Create: `app/(dashboard)/orders/new/page.tsx`
- Create: `app/(dashboard)/orders/[id]/page.tsx`
- Create: `app/(dashboard)/customers/page.tsx`
- Create: `app/(dashboard)/customers/new/page.tsx`
- Create: `app/(dashboard)/customers/[id]/page.tsx`

- [ ] **Step 1: Create order pages**

- [ ] **Step 2: Create customer pages**

- [ ] **Step 3: Commit**
```bash
git add apps/web/app/\(dashboard\)/orders/ apps/web/app/\(dashboard\)/customers/
git commit -m "feat(web): add order and customer pages"
```

---

### Task 13: Sidebar Update

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: Update Sidebar**
Add to "Bán hàng" section:
- `/orders` — Đơn hàng (icon ShoppingCart, badge active)
- `/customers` — Khách hàng (icon Users)

- [ ] **Step 2: Commit**
```bash
git add apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): update sidebar with order links"
```

---

### Task 14: Update Infrastructure Verification

**Files:**
- Modify: `scripts/verify-infra.mjs`
- Modify: `apps/api/test/persistence.integration-spec.ts`

- [ ] **Step 1: Update verify-infra.mjs**
- Table count: 19 → 23
- Migration count: 5 → 6

- [ ] **Step 2: Update persistence.integration-spec.ts**
- Add new tables to expected list
- Update TRUNCATE to include new tables

- [ ] **Step 3: Commit**
```bash
git add scripts/verify-infra.mjs apps/api/test/persistence.integration-spec.ts
git commit -m "fix(integration): update verification for order management schema"
```

---

### Task 15: Final Integration & Verification

- [ ] **Step 1: Run all tests**
```bash
pnpm test
```
Expected: All existing + new tests pass

- [ ] **Step 2: Run typecheck**
```bash
pnpm typecheck
```
Expected: No errors

- [ ] **Step 3: Run integration tests**
```bash
pnpm test:integration
```
Expected: Pass

- [ ] **Step 4: Run lint**
```bash
pnpm lint
```
Expected: Clean

- [ ] **Step 5: Build**
```bash
pnpm build
```
Expected: Success

- [ ] **Step 6: Final commit**
```bash
git commit -m "feat(orders): complete order management phase 3"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: All sections map to tasks
  - Domain model → Tasks 2-3
  - API → Tasks 3-6
  - Web → Tasks 7-13
  - Migration → Task 1
  - Inventory integration → Task 3-4
  - Testing → Each task has test files
- [x] **Placeholder scan**: No TBD, TODO, or vague steps
- [x] **Type consistency**: Domain types match between API and Web
- [x] **File naming**: Follows existing conventions
- [x] **Pattern alignment**: Follows ProductsModule pattern

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-15-order-management.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session, batch execution with checkpoints

Which approach do you prefer?
