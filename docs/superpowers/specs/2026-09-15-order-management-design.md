# Order Management Design Spec

**Date:** 2026-09-15  
**Branch:** TBD  
**Status:** Approved  
**Scope:** Order Management subsystem (orders, order items, customers, status history, inventory integration)

---

## 1. Overview

### 1.1 Purpose
Implement a comprehensive order management system for the Commerce Control Center, enabling store staff to create, track, and manage customer orders with inventory integration and status workflow.

### 1.2 Goals
- Store-scoped order management with full CRUD operations
- Customer management (registered users + guest customers)
- Order status workflow with history tracking
- Order items linked to products/variants
- Automatic inventory deduction on order confirmation
- Permission-gated access (orders.read, orders.manage)
- Search and filter by status, customer, date range

### 1.3 Non-Goals
- Payment gateway integration (Phase 4)
- Shipping carrier integration
- Automated refund processing
- Multi-warehouse fulfillment
- Advanced pricing rules (promotions, tiers)
- Invoice generation

---

## 2. Domain Model

### 2.1 Database Schema

#### customers
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
```

#### orders
```sql
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
```

#### order_items
```sql
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
```

#### order_status_history
```sql
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

### 2.2 Domain Objects

```typescript
interface Customer {
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

interface Order {
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

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'READY_TO_SHIP' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED';
type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY';

interface OrderItem {
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

interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
}

interface OrderDetail {
  order: Order;
  customer: Customer;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
}
```

---

## 3. Architecture

### 3.1 Module Structure (Monolithic OrdersModule)

```
orders/
├── orders.module.ts
├── application/
│   ├── order.service.ts
│   ├── order.service.test.ts
│   ├── customer.service.ts
│   ├── customer.service.test.ts
│   └── order.tokens.ts
├── domain/
│   ├── order.ts
│   ├── customer.ts
│   └── order-status.ts
├── http/
│   ├── order.controller.ts
│   ├── order.controller.test.ts
│   └── customer.controller.ts
└── infrastructure/
    └── order.repository.ts
```

### 3.2 Integration Points

- **AppModule**: Import `OrdersModule`
- **PermissionGuard**: Reuses existing guard with `orders.read` / `orders.manage`
- **AuditModule**: Logs all order mutations
- **Database**: Reuses existing `DATABASE` token
- **ProductsModule**: Reads product/variant data for order items
- **Inventory**: Deducts/returns stock via `ProductRepository.updateInventory()`

---

## 4. API Specification

### 4.1 Orders Endpoints

#### List Orders
```
GET /api/v1/stores/:storeId/orders
```
Query params: status, customerId, fromDate, toDate, search (order_number), sort, page, limit

#### Create Order
```
POST /api/v1/stores/:storeId/orders
```
Body: { customerId, items: [{ productId, variantId?, quantity, unitPrice }], shippingFee, discountAmount, shippingAddress, paymentMethod, notes }

#### Get Order Detail
```
GET /api/v1/stores/:storeId/orders/:id
```
Includes: order + customer + items + statusHistory

#### Update Status
```
PATCH /api/v1/stores/:storeId/orders/:id/status
```
Body: { status, notes }
Validates status transition

#### Update Order
```
PATCH /api/v1/stores/:storeId/orders/:id
```
Body: partial order fields

#### Cancel Order
```
DELETE /api/v1/stores/:storeId/orders/:id
```
Sets status to CANCELLED, returns inventory

### 4.2 Customers Endpoints

#### List Customers
```
GET /api/v1/stores/:storeId/customers
```

#### Create Customer
```
POST /api/v1/stores/:storeId/customers
```

#### Get Customer
```
GET /api/v1/stores/:storeId/customers/:id
```
Includes: customer + recent orders

#### Update Customer
```
PATCH /api/v1/stores/:storeId/customers/:id
```

#### Delete Customer
```
DELETE /api/v1/stores/:storeId/customers/:id
```
Fails if customer has orders

---

## 5. Order Status Workflow

### Valid Transitions
```
PENDING → CONFIRMED, CANCELLED
CONFIRMED → PROCESSING, CANCELLED
PROCESSING → READY_TO_SHIP, CANCELLED
READY_TO_SHIP → SHIPPED, CANCELLED
SHIPPED → DELIVERED
DELIVERED → REFUNDED
```

### Inventory Rules
- **CONFIRMED**: Deduct quantity, add reserved
- **CANCELLED**: Return quantity, remove reserved
- **REFUNDED**: Return quantity (if not already)

---

## 6. Frontend Structure

### Routes
```
(dashboard)/
├── orders/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── customers/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
```

### Components
```
features/orders/
├── api.ts, api.test.ts
├── queries.ts, queries.test.tsx
├── types.ts
└── components/
    ├── order-list.tsx
    ├── order-form.tsx
    ├── order-detail.tsx
    ├── order-status-badge.tsx
    ├── customer-list.tsx
    └── customer-form.tsx
```

---

## 7. Permissions

| Permission | Action |
|---|---|
| orders.read | View orders, customers |
| orders.manage | Create, update, cancel orders; manage customers |
| inventory.read | Check stock when creating orders |
| inventory.adjust | Deduct/return inventory on status changes |

---

## 8. Validation Rules

### Order
- At least 1 item required
- customer_id must belong to same store
- status transitions must be valid
- order_number auto-generated: `ORD-YYYYMMDD-NNN`

### Order Item
- quantity > 0
- unit_price >= 0
- product_id must exist
- variant_id (if provided) must belong to product

### Customer
- name: required, 1-200 chars
- phone: required, valid format
- email: optional, valid format

---

## 9. Files Summary

### New (~30 files)
- API: 15 files (module, services, controllers, domain, repository)
- Web: 12 files (api, queries, components, routes)
- Migration: 2 files

### Modified (~3 files)
- app.module.ts
- sidebar.tsx
- verify-infra.mjs

---

## 10. Estimated Effort

- API Layer: 6-8 hours
- Web Components: 8-10 hours
- Tests: 4-6 hours
- Migration + Setup: 1-2 hours
- **Total: ~20-26 hours**
