# 06 — Acceptance Criteria và Development Plan

> Phiên bản: Draft v1.0  
> Trạng thái: Chờ review

# PHẦN A — ACCEPTANCE CRITERIA

## 1. Nguyên tắc

Feature chỉ được coi là hoàn thành khi đáp ứng:

- Happy path
- Validation
- Authorization
- Loading state
- Empty state
- Error state
- Boundary condition
- Concurrency nếu có
- Security
- Performance nếu có yêu cầu

---

# 2. Global Acceptance

## AC-GLOBAL-001 — TypeScript

Build phải pass TypeScript không có error.

## AC-GLOBAL-002 — Lint

Lint phải pass.

## AC-GLOBAL-003 — Authorization

Mutation protected phải được kiểm tra permission ở server.

## AC-GLOBAL-004 — Store Isolation

User không được đọc hoặc mutate Store ngoài quyền.

## AC-GLOBAL-005 — Audit

Critical mutation phải tạo audit record.

## AC-GLOBAL-006 — Error State

Critical async operation phải có error state có thể hiểu và xử lý.

---

# 3. Authentication

## AC-AUTH-001 — Login thành công

Given:

- Account active.
- Credentials hợp lệ.

When:

User login.

Then:

- Session được tạo.
- User được đưa tới trang hợp lệ.

## AC-AUTH-002 — Login sai

Given:

Credentials sai.

Then:

- Login thất bại.
- Không leak thông tin account.

## AC-AUTH-003 — Session hết hạn

Given:

Session expired.

When:

User gọi protected resource.

Then:

- Refresh hoặc yêu cầu login theo auth strategy.

---

# 4. RBAC

## AC-RBAC-001

Given:

User có `orders.read`.

When:

Mở Orders.

Then:

Orders hiển thị.

## AC-RBAC-002

Given:

User không có `orders.read`.

When:

Gọi Orders API.

Then:

403.

## AC-RBAC-003

Given:

User không có `inventory.adjust`.

When:

Gửi request adjustment thủ công.

Then:

Server reject.

---

# 5. Product

## AC-PROD-001 — Tạo Product

Given:

Valid Product + permission.

Then:

Product và Variant được tạo.

## AC-PROD-002 — Duplicate SKU

Given:

SKU đã tồn tại.

When:

Create Variant cùng SKU.

Then:

Reject.

## AC-PROD-003 — Historical Order

Given:

Product có Order history.

When:

Archive.

Then:

Order history vẫn hiển thị.

---

# 6. Inventory

## AC-INV-001 — Available Stock

Given:

```text
Physical = 10
Reserved = 3
```

Then:

```text
Available = 7
```

## AC-INV-002 — Insufficient Stock

Given:

Available = 2.

When:

Reserve 3.

Then:

- Reject.
- Stock không đổi.

## AC-INV-003 — Concurrent Reservation

Given:

Available = 1.

When:

2 requests reserve 1 cùng lúc.

Then:

- Một success.
- Một failure.
- Stock không âm.

## AC-INV-004 — Cancel Release

Given:

Order reserved 1.

When:

Cancel.

Then:

Reservation release đúng một lần.

---

# 7. Orders

## AC-ORD-001 — Order List

Given:

User có permission.

Then:

Orders hiển thị có pagination.

## AC-ORD-002 — Filter

Given:

Có order TikTok và Shopee.

When:

Filter TikTok.

Then:

Chỉ TikTok order.

## AC-ORD-003 — Valid Transition

Given:

Order CONFIRMED.

When:

Change PROCESSING.

Then:

- Status updated.
- History created.

## AC-ORD-004 — Invalid Transition

Given:

Order COMPLETED.

When:

Change PROCESSING.

Then:

- Reject.
- Không mutation.

## AC-ORD-005 — Duplicate External Order

Given:

Order đã import.

When:

Webhook cùng External ID.

Then:

Không tạo duplicate.

---

# 8. Channel

## AC-CHANNEL-001 — Connect

Given:

OAuth thành công.

Then:

Channel Account CONNECTED.

Initial sync được tạo.

## AC-CHANNEL-002 — Auth Expired

Given:

Refresh token fail.

Then:

- AUTH_EXPIRED.
- Notification gửi authorized user.

---

# 9. Webhook

## AC-WEBHOOK-001 — Valid

Given:

Signature hợp lệ.

Then:

Webhook được xử lý.

## AC-WEBHOOK-002 — Invalid Signature

Then:

- Reject.
- Không mutation.

## AC-WEBHOOK-003 — Replay

Given:

Event đã xử lý.

When:

Event đến lần nữa.

Then:

Không duplicate side effect.

---

# 10. Livestream

## AC-LIVE-001 — Start

Given:

Channel connected và Product hợp lệ.

When:

Start.

Then:

Livestream LIVE chỉ khi operation thành công.

## AC-LIVE-002 — Metrics

Given:

Livestream LIVE.

When:

Metric event đến.

Then:

Authorized clients nhận update.

## AC-LIVE-003 — End

When:

Livestream end.

Then:

- Status ENDED.
- Metrics được giữ.
- Order attribution giữ nguyên.

---

# 11. Dashboard

## AC-DASH-001 — Date Range

Given:

Store có sales.

When:

Chọn date range.

Then:

Metrics phản ánh đúng range theo Store timezone.

## AC-DASH-002 — Empty

Given:

Không có sales.

Then:

Dashboard hiển thị empty/zero state phù hợp.

---

# PHẦN B — DEVELOPMENT PLAN

# 12. Format của một Task

Mỗi task phải có:

```text
Task ID
Tên
Mục tiêu
Dependencies
Requirements liên quan
Business Rules liên quan
Edge Cases liên quan
Acceptance Criteria
Test Requirements
Implementation Notes
Definition of Done
```

---

# 13. Phase 0 — Foundation

### TASK-001 — Khởi tạo repository

Dependencies:
Không có.

Acceptance:

- Install pass.
- Build pass.
- Lint pass.
- Typecheck pass.
- Test runner hoạt động.

### TASK-002 — Environment configuration

Depends:
TASK-001.

### TASK-003 — PostgreSQL + Migration

Depends:
TASK-001.

### TASK-004 — Redis

Depends:
TASK-001.

### TASK-005 — CI

Depends:
TASK-001.

---

# 14. Phase 1 — Design System

### TASK-010 — Application Shell

### TASK-011 — Navigation

### TASK-012 — Table

### TASK-013 — Form

### TASK-014 — Modal

### TASK-015 — Toast

### TASK-016 — Loading / Empty / Error states

---

# 15. Phase 2 — Authentication

### TASK-020 — Authentication

### TASK-021 — Store Membership

Depends:
TASK-020.

### TASK-022 — RBAC

Depends:
TASK-021.

### TASK-023 — Audit Infrastructure

Depends:
TASK-022.

---

# 16. Phase 3 — Product

### TASK-030 — Product Domain

### TASK-031 — Product API

### TASK-032 — Product List UI

### TASK-033 — Product Create/Edit

### TASK-034 — Variant/SKU

---

# 17. Phase 4 — Inventory

### TASK-040 — Inventory Domain

### TASK-041 — Inventory Transaction

### TASK-042 — Reservation

### TASK-043 — Atomic Adjustment

### TASK-044 — Inventory UI

### TASK-045 — Low Stock

---

# 18. Phase 5 — Orders

### TASK-050 — Order Domain

### TASK-051 — Order State Machine

### TASK-052 — Order API

### TASK-053 — Order List

### TASK-054 — Order Detail

### TASK-055 — Status Transition

### TASK-056 — Cancellation

---

# 19. Phase 6 — Channel

### TASK-060 — Channel Abstraction

### TASK-061 — Channel Account Lifecycle

### TASK-062 — TikTok OAuth

### TASK-063 — TikTok Product Sync

### TASK-064 — TikTok Order Sync

### TASK-065 — TikTok Webhook

### TASK-066 — Shopee OAuth

### TASK-067 — Shopee Product Sync

### TASK-068 — Shopee Order Sync

### TASK-069 — Shopee Webhook

---

# 20. Phase 7 — Realtime

### TASK-070 — Event Infrastructure

### TASK-071 — Realtime Gateway

### TASK-072 — Order Realtime

### TASK-073 — Inventory Realtime

### TASK-074 — Notification Realtime

---

# 21. Phase 8 — Dashboard / Analytics

### TASK-080 — Dashboard Aggregation

### TASK-081 — GMV/Revenue Calculation

### TASK-082 — Dashboard Widgets

### TASK-083 — Date Filter

### TASK-084 — Channel Analytics

### TASK-085 — Product Analytics

---

# 22. Phase 9 — Livestream

### TASK-090 — Livestream Domain

### TASK-091 — Livestream CRUD

### TASK-092 — Channel Livestream Integration

### TASK-093 — Realtime Metrics

### TASK-094 — Product Attribution

### TASK-095 — Livestream Analytics

---

# 23. Phase 10 — Production Hardening

### TASK-100 — Security Review

### TASK-101 — Authorization Test Suite

### TASK-102 — Concurrency Test Suite

### TASK-103 — Webhook Idempotency Tests

### TASK-104 — Load Test

### TASK-105 — Observability

### TASK-106 — Production Deployment

---

# 24. Definition of Done

Task chỉ hoàn thành khi:

- Requirement implemented.
- Business rule đúng.
- Acceptance pass.
- Edge case quan trọng được xử lý.
- Typecheck pass.
- Lint pass.
- Unit test pass.
- Integration test pass nếu cần.
- E2E test cho critical flow.
- Loading state.
- Empty state.
- Error state.
- Authorization.
- Audit nếu cần.
- Security review.
- Documentation update.
- Code review.

---

# 25. Traceability

Mọi business behavior quan trọng phải trace được:

```text
Business Rule
      ↓
Requirement
      ↓
Technical Design
      ↓
Edge Case
      ↓
Acceptance Criteria
      ↓
Implementation Task
      ↓
Automated Test
```

Nếu không trace được, behavior đó chưa đủ specification để đưa vào implementation.
