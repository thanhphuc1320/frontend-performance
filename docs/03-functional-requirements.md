# 03 — Functional Requirements

> Phiên bản: Draft v1.0  
> Trạng thái: Chờ review

## 1. Quy ước

Mỗi requirement có:

- ID
- Priority
- Actor
- Precondition
- Permission
- Input
- Behavior
- Validation
- Output
- Error

Priority:

- P0: Bắt buộc MVP
- P1: Quan trọng
- P2: Có thể làm sau

---

# 2. Authentication

## REQ-AUTH-001 — Đăng nhập

Priority: P0

Actor:
Tất cả user.

Precondition:
Account tồn tại và active.

Input:
- Email
- Password

Behavior:
1. Validate input.
2. Authenticate.
3. Tạo session.
4. Trả trạng thái authenticated.
5. Điều hướng tới trang được phép truy cập.

Errors:
- 401
- 429

---

## REQ-AUTH-002 — Đăng xuất

Priority: P0

Behavior:
- Invalidate session.
- Clear client authentication state.

---

## REQ-AUTH-003 — Session hết hạn

Priority: P0

Behavior:
- Detect expiration.
- Refresh nếu hỗ trợ.
- Nếu refresh fail → yêu cầu login.

---

# 3. Store

## REQ-STORE-001 — Xem Store

User chỉ thấy Store mà mình có membership.

## REQ-STORE-002 — Tạo Store

Input:
- Tên
- Timezone
- Currency

Validation:
- Tên bắt buộc.
- Timezone hợp lệ.
- Currency được hỗ trợ.

## REQ-STORE-003 — Chuyển Store

Nếu user thuộc nhiều Store, user có thể chuyển Store.

Mọi request sau đó phải scope theo active Store.

---

# 4. User và RBAC

## REQ-USER-001 — Danh sách user

Admin/Owner có permission phù hợp được xem thành viên.

## REQ-USER-002 — Mời user

Input:
- Email
- Role

## REQ-USER-003 — Thay đổi role

Không được transfer ownership bằng flow thay role thông thường.

Mọi thay đổi permission phải audit.

---

# 5. Product

## REQ-PROD-001 — Danh sách Product

Hỗ trợ:

- Search
- Pagination
- Sort
- Filter
- Status
- Category

## REQ-PROD-002 — Tạo Product

Input:

```text
Product:
- Name
- Description
- Status

Variant:
- SKU
- Price
- Cost
- Stock
```

Validation:

- SKU unique trong Store.
- Price hợp lệ.
- Required fields đầy đủ.

## REQ-PROD-003 — Cập nhật Product

Không được làm thay đổi historical Order.

## REQ-PROD-004 — Archive Product

Archived Product không được tạo sale mới theo rule hiện hành nhưng vẫn phải hiển thị trong historical order.

---

# 6. Inventory

## REQ-INV-001 — Xem Inventory

Hiển thị:

- Product
- SKU
- Physical Stock
- Reserved Stock
- Available Stock
- Low Stock status

## REQ-INV-002 — Điều chỉnh Inventory

Input:

- SKU
- Quantity delta
- Reason

Behavior:

1. Check permission.
2. Validate SKU.
3. Validate quantity.
4. Atomic update.
5. Create transaction.
6. Audit.
7. Publish event.

## REQ-INV-003 — Inventory History

Hiển thị:

- Thời gian
- SKU
- Delta
- Before
- After
- Reason
- Actor
- Source

## REQ-INV-004 — Low Stock

Trigger notification khi Available Stock <= threshold.

---

# 7. Orders

## REQ-ORD-001 — Danh sách Order

Filter:

- Search
- Status
- Payment status
- Channel
- Date range
- Customer
- SKU

Sort:

- Created date
- Total
- Status

## REQ-ORD-002 — Order Detail

Hiển thị:

- Order ID
- Channel
- Customer
- Items
- Price
- Discount
- Shipping
- Payment
- Status history
- Inventory state
- Audit

## REQ-ORD-003 — Update Status

1. Check authentication.
2. Check permission.
3. Check current state.
4. Check allowed transition.
5. Update.
6. Record history.
7. Publish event.

## REQ-ORD-004 — Cancel Order

Behavior:

- Check cancellability.
- Change state.
- Release reservation nếu cần.
- Audit.
- Sync external channel nếu cần.

## REQ-ORD-005 — Import Order

External order phải:

- Normalize.
- Idempotent.
- Retryable.
- Store-scoped.

---

# 8. Customer

## REQ-CUST-001 — Customer List

Hỗ trợ:

- Search
- Channel
- Order count
- Total spend
- Last order

## REQ-CUST-002 — Customer Detail

Hiển thị:

- Profile
- Orders
- Purchase history
- Channel association

---

# 9. Channel

## REQ-CHANNEL-001 — Connect Channel

Flow:

```text
Chọn Channel
→ OAuth
→ Callback
→ Verify Account
→ Lưu Credential an toàn
→ Tạo Channel Account
→ Initial Sync
```

## REQ-CHANNEL-002 — Channel Status

Hiển thị:

- Connected
- Syncing
- Auth expired
- Error
- Disconnected

## REQ-CHANNEL-003 — Manual Sync

User có permission có thể trigger sync.

System phải:

- Không tạo duplicate unsafe job.
- Theo dõi progress.
- Hiển thị lỗi.

---

# 10. Webhook

## REQ-WEBHOOK-001

Nhận webhook từ channel.

Behavior:

1. Verify signature.
2. Identify Channel Account.
3. Validate payload.
4. Deduplicate.
5. Process.
6. Publish domain event nếu cần.
7. Acknowledge đúng theo contract.

---

# 11. Livestream

## REQ-LIVE-001 — Tạo Livestream

Input:

- Title
- Channel
- Start time
- Products

## REQ-LIVE-002 — Start

Precondition:

- Channel connected.
- Product hợp lệ.

## REQ-LIVE-003 — Realtime Metrics

Hiển thị:

- Viewers
- Orders
- GMV
- Units sold
- Conversion rate
- AOV
- Top products

## REQ-LIVE-004 — End

Khi kết thúc:

- Chuyển trạng thái ENDED.
- Chốt metrics.
- Giữ lịch sử.
- Giữ attribution.

---

# 12. Dashboard

## REQ-DASH-001

Hiển thị:

- GMV
- Revenue metric
- Orders
- AOV
- Conversion
- Refund
- Top products
- Channel performance

## REQ-DASH-002 — Date Filter

- Hôm nay
- Hôm qua
- 7 ngày
- 30 ngày
- Custom

Tính theo Store timezone.

---

# 13. Notification

## REQ-NOTIF-001

Notification cho:

- New order
- Low stock
- Sync failure
- Auth expiration
- Critical integration error

---

# 14. Audit

## REQ-AUDIT-001

Authorized user có thể xem:

- Actor
- Action
- Resource
- Timestamp
- Before
- After

Filter:

- Actor
- Resource
- Action
- Date

---

# 15. Non-functional Requirements

## REQ-NFR-001 — Performance

Mục tiêu:

- API p95 < 500ms
- Dashboard initial load < 2.5s
- Realtime propagation < 1s

## REQ-NFR-002 — Security

- Server-side authorization
- Input validation
- Secret protection
- Webhook verification
- IDOR protection

## REQ-NFR-003 — Reliability

Critical retryable operation phải idempotent.

## REQ-NFR-004 — Observability

Critical job/integration phải có:

- Status
- Log
- Failure reason
- Retry status
