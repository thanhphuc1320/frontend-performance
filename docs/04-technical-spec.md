# 04 — Technical Specification

> Phiên bản: Draft v1.0  
> Trạng thái: Chờ review

## 1. Mục tiêu kỹ thuật

Hệ thống phải:

- Dễ phát triển cho team nhỏ.
- Có boundary rõ.
- Hỗ trợ nhiều channel.
- Có realtime.
- Bảo vệ business invariant.
- Có khả năng scale.
- Có thể chuyển một số module thành service riêng khi cần.

---

# 2. Kiến trúc tổng thể

## Quyết định ban đầu

**Modular Monolith**

Lý do:

- MVP nhanh hơn.
- Dễ debug.
- Dễ transaction.
- Giảm operational complexity.
- Vẫn có thể thiết kế module boundary rõ ràng.

Không triển khai microservices ngay từ MVP nếu chưa có nhu cầu thực tế.

---

# 3. Stack đề xuất

## Frontend

- Next.js
- React
- TypeScript
- TailwindCSS
- TanStack Query
- Zustand khi thực sự cần client global state
- React Hook Form
- Zod
- Recharts

## Backend

- Node.js
- TypeScript
- NestJS hoặc framework Node modular tương đương

## Database

- PostgreSQL

## Cache / Queue

- Redis
- BullMQ hoặc tương đương

## Realtime

- WebSocket hoặc SSE

## Testing

- Vitest/Jest
- React Testing Library
- Playwright
- Backend integration tests

## CI/CD

- GitHub Actions
- Docker
- Vercel cho frontend nếu phù hợp

---

# 4. Repository

Đề xuất:

```text
apps/
├── web/
└── api/

packages/
├── ui/
├── types/
├── api-client/
├── config/
└── utils/

docs/
```

Monorepo tool cụ thể cần được chốt trước implementation.

---

# 5. Frontend Architecture

```text
apps/web/
├── app/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── orders/
│   ├── products/
│   ├── inventory/
│   ├── customers/
│   ├── channels/
│   ├── livestream/
│   └── analytics/
├── components/
├── hooks/
├── lib/
└── services/
```

### Nguyên tắc

1. Feature logic nằm trong feature boundary.
2. Shared UI nằm ở shared components.
3. Server state dùng TanStack Query hoặc tương đương.
4. Không đưa mọi state vào Zustand/Redux.
5. API types nên được generate/share.
6. Permission phải kiểm tra ở backend.
7. Dataset lớn phải server-side pagination.
8. Mutation phải có loading/error/success state.

---

# 6. Backend Modules

```text
Auth
Users
Stores
Channels
Products
Inventory
Orders
Customers
Livestream
Analytics
Notifications
Audit
Integrations
```

Mỗi module nên có:

```text
controller
application
domain
infrastructure
dto
```

---

# 7. Module Boundary

## Order

Own:

- Order
- Order Item
- Order Status History

Không được tự ý cập nhật bảng Inventory trực tiếp.

Phải gọi Inventory application/domain interface.

## Inventory

Own:

- Inventory
- Inventory Transaction
- Reservation

## Channel

Own:

- Channel Account
- Connection state
- Credential lifecycle

## Integration

Own:

- External API adapter
- Webhook adapter
- Mapping
- Normalization

Vendor object không được leak vào core domain.

---

# 8. Integration Adapter

Interface đề xuất:

```text
ChannelAdapter

authenticate()
refreshToken()
getProducts()
getOrders()
updateInventory()
registerWebhook()
verifyWebhook()
normalizeProduct()
normalizeOrder()
```

Implementation:

```text
TikTokAdapter
ShopeeAdapter
```

---

# 9. Order Data Flow

```text
TikTok/Shopee
      ↓
Webhook / Polling
      ↓
Integration Adapter
      ↓
Validate
      ↓
Idempotency Check
      ↓
Queue
      ↓
Order Application Service
      ↓
Inventory Reservation
      ↓
Database Transaction
      ↓
Domain Event
      ↓
Realtime Gateway
      ↓
Frontend
```

---

# 10. Realtime

Events:

```text
order.created
order.updated
inventory.updated
livestream.metric.updated
notification.created
sync.failed
```

Realtime connection phải được scope theo Store và authorization.

---

# 11. Queue

Queue cho:

- Initial sync
- Incremental sync
- Webhook processing
- Retry
- Notifications
- Analytics aggregation
- Large export/import

Mỗi job cần:

- Unique identity
- Retry policy
- Backoff
- Max attempts
- Failure state
- Observability

Job thất bại vĩnh viễn phải có Dead Letter Queue hoặc cơ chế tương đương.

---

# 12. Database

PostgreSQL là transactional source cho normalized operational data.

Nguyên tắc:

- Foreign key.
- Unique constraint.
- Index theo query pattern.
- UTC timestamps.
- Exact money representation.
- Soft delete khi cần giữ historical reference.
- Immutable historical snapshot khi cần.

---

# 13. Entity dự kiến

```text
users
stores
store_members
roles
permissions
role_permissions

channel_accounts
channel_credentials
sync_jobs
webhook_events

products
product_variants
channel_product_mappings

inventory
inventory_reservations
inventory_transactions

customers
customer_channel_mappings

orders
order_items
order_status_history

payments
refunds

livestreams
livestream_products
livestream_metrics

notifications
audit_logs
```

Schema chi tiết sẽ được chốt trong API/Data specification trước implementation.

---

# 14. Concurrency

Critical operation phải đảm bảo bằng database/backend.

Các chiến lược:

- Atomic SQL update.
- Row-level locking.
- Optimistic locking.
- Serializable transaction khi thực sự cần.

Frontend không được xem là cơ chế chống race condition.

---

# 15. Idempotency

Bắt buộc cho:

- External Order Import
- Webhook
- Inventory Sync
- Refund
- Critical retriable mutation

Có thể dùng:

- Idempotency key.
- External event ID.
- Unique database constraint.
- Deterministic operation key.

---

# 16. API

Prefix:

```text
/api/v1
```

Ví dụ:

```text
GET    /orders
GET    /orders/:id
POST   /orders/:id/cancel

GET    /products
POST   /products
PATCH  /products/:id

GET    /inventory
POST   /inventory/adjust

GET    /channels
POST   /channels/:id/connect
POST   /channels/:id/sync

GET    /livestreams
POST   /livestreams
POST   /livestreams/:id/start
POST   /livestreams/:id/end
```

Response:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Error:

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Không tìm thấy đơn hàng",
    "requestId": "..."
  }
}
```

---

# 17. Authentication

Đề xuất browser authentication:

- Secure cookie.
- HttpOnly.
- SameSite phù hợp.
- CSRF protection.
- Session/token expiration.
- Refresh strategy nếu cần.

Quyết định cuối cùng phải được ghi thành ADR.

---

# 18. Authorization

Flow:

```text
Authenticated User
      ↓
Store Membership
      ↓
Permission
      ↓
Resource Scope
      ↓
Action
```

Không được coi resource ID là bằng chứng ownership.

---

# 19. Security

Phải bảo vệ:

- IDOR
- Broken access control
- XSS
- CSRF
- SQL injection
- SSRF nếu có điểm truy cập URL
- Credential leakage
- Webhook spoofing
- Replay attack
- Brute force
- Rate limit bypass
- Excessive data exposure

Secrets không được commit.

Token external phải được bảo vệ/encrypt at rest khi phù hợp.

---

# 20. Performance

Frontend:

- Code splitting.
- Lazy loading.
- Virtualized table.
- Query caching.
- Prefetch.
- Giảm global state.

Backend:

- Index.
- Pagination.
- Cache.
- Batch.
- Async processing.

---

# 21. Observability

Cần có:

- Structured log
- Request ID
- Error tracking
- Queue metrics
- Sync metrics
- API latency
- DB latency
- Webhook failure
- Auth failure

---

# 22. CI/CD

Pull Request:

```text
Install
→ Lint
→ Typecheck
→ Unit Test
→ Integration Test
→ Build
```

Critical flow:

```text
→ E2E Test
```

---

# 23. Architecture Decision Record

Các quyết định lớn phải được ghi lại:

- Frontend framework
- Backend framework
- Monorepo
- Auth
- Realtime
- Queue
- Database
- Cache
- External integration strategy

Không tự ý thay đổi architecture trong implementation task.
