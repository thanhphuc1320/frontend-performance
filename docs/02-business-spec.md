# 02 — Business Specification

> Phiên bản: Draft v1.0  
> Trạng thái: Chờ review

## 1. Mục đích

Tài liệu này định nghĩa các quy tắc kinh doanh, state machine, invariant và cách hệ thống phải vận hành.

**Business Rule không được tự suy diễn từ UI hoặc code.**

---

# 2. Mô hình Business

Một Store là đơn vị sở hữu toàn bộ dữ liệu vận hành.

```text
Store
├── Users
├── Channel Accounts
├── Products
├── Inventory
├── Orders
├── Customers
└── Livestreams
```

Một Store có thể kết nối nhiều Channel Account.

```text
Store
├── TikTok Shop Account
└── Shopee Account
```

---

# 3. Store Rules

### BUS-STORE-001

Mọi entity nghiệp vụ phải thuộc một Store.

### BUS-STORE-002

User chỉ được truy cập Store mà User có membership hợp lệ.

### BUS-STORE-003

Thay đổi ID trên URL/API không được phép vượt Store boundary.

### BUS-STORE-004

MVP không hỗ trợ hard-delete Store.

Store nên được deactivate thay vì xóa hoàn toàn.

---

# 4. User và Role

Các Role ban đầu:

- Owner
- Admin
- Staff
- Warehouse
- Customer Support
- Analyst

### BUS-AUTH-001

Owner có toàn quyền trong Store.

### BUS-AUTH-002

Admin được quản lý nghiệp vụ nhưng không tự chuyển quyền sở hữu Store.

### BUS-AUTH-003

Warehouse được quản lý inventory nhưng không mặc định được xem dữ liệu tài chính.

### BUS-AUTH-004

Customer Support được xem Order/Customer theo permission.

### BUS-AUTH-005

Backend là nơi quyết định quyền cuối cùng.

---

# 5. Product Rules

### BUS-PROD-001

Product có thể có một hoặc nhiều Variant.

### BUS-PROD-002

Mỗi Variant bán được phải có SKU.

### BUS-PROD-003

SKU unique trong phạm vi Store.

### BUS-PROD-004

Product có historical Order không được hard-delete.

### BUS-PROD-005

Archive Product không được xóa historical data.

### BUS-PROD-006

Một Product/Variant nội bộ có thể được mapping tới nhiều channel.

```text
Internal SKU
├── TikTok SKU Mapping
└── Shopee SKU Mapping
```

---

# 6. Inventory Rules

## 6.1 Công thức

```text
Available Stock
=
Physical Stock
-
Reserved Stock
```

### BUS-INV-001

Available Stock không được nhỏ hơn 0.

### BUS-INV-002

Mọi mutation inventory phải tạo Inventory Transaction.

### BUS-INV-003

Manual adjustment phải xác định actor và reason.

### BUS-INV-004

Reservation phải atomic.

### BUS-INV-005

Cancel Order phải release reservation đúng một lần.

### BUS-INV-006

Duplicate event không được làm thay đổi stock hai lần.

### BUS-INV-007

Inventory synchronization phải idempotent.

---

# 7. Inventory Source of Truth

Mô hình MVP:

```text
Internal Inventory
       │
       ├── TikTok synchronization
       └── Shopee synchronization
```

Internal Inventory là normalized source of truth cho hệ thống.

**Cần review trước khi code:** chiến lược phân bổ stock riêng cho từng channel.

Ví dụ cần quyết định giữa:

### Phương án A — Global Stock

```text
SKU-001 = 100

TikTok = dùng chung
Shopee = dùng chung
Website = dùng chung
```

### Phương án B — Channel Allocation

```text
SKU-001 = 100

TikTok allocation = 30
Shopee allocation = 30
Website allocation = 40
```

---

# 8. Order State Machine

## 8.1 Trạng thái chính

```text
PENDING
  ↓
CONFIRMED
  ↓
PROCESSING
  ↓
PACKED
  ↓
SHIPPED
  ↓
DELIVERED
  ↓
COMPLETED
```

Trạng thái ngoại lệ:

```text
CANCELLED
FAILED
RETURNED
REFUNDED
```

## 8.2 Transition

| Từ | Sang | Cho phép |
|---|---|---|
| PENDING | CONFIRMED | Có |
| PENDING | CANCELLED | Có |
| CONFIRMED | PROCESSING | Có |
| CONFIRMED | CANCELLED | Có điều kiện |
| PROCESSING | PACKED | Có |
| PROCESSING | CANCELLED | Có điều kiện |
| PACKED | SHIPPED | Có |
| SHIPPED | DELIVERED | Có |
| DELIVERED | COMPLETED | Có |
| COMPLETED | CANCELLED | Không |
| COMPLETED | PROCESSING | Không |

Transition thực tế phải được mapping từ state của từng channel.

---

# 9. Order Rules

### BUS-ORD-001

External Order phải được nhận diện bằng:

```text
Store + Channel Account + External Order ID
```

### BUS-ORD-002

Cùng một external order không được tạo thành hai internal order.

### BUS-ORD-003

Historical order item price không được thay đổi khi Product price thay đổi.

### BUS-ORD-004

Mọi state transition phải được ghi vào Order Status History.

### BUS-ORD-005

Order cancellation phải xử lý inventory reservation theo business rule.

---

# 10. Payment Rules

Trạng thái:

```text
UNPAID
PENDING
PAID
FAILED
PARTIALLY_REFUNDED
REFUNDED
```

### BUS-PAY-001

Order không được tự chuyển sang PAID nếu không có payment event/trusted channel state.

### BUS-PAY-002

Refund không được vượt quá số tiền đã thanh toán.

### BUS-PAY-003

Payment history phải immutable.

---

# 11. Refund Rules

### BUS-REF-001

Refund phải idempotent.

### BUS-REF-002

Refund phải tham chiếu payment/order gốc.

### BUS-REF-003

Refund quantity không được vượt purchased quantity.

### BUS-REF-004

Việc trả stock sau refund/return phải dựa trên trạng thái thực tế của hàng hóa.

---

# 12. Customer Rules

### BUS-CUST-001

Customer từ các channel phải được normalize.

### BUS-CUST-002

External identifier nhạy cảm không được hiển thị nếu không cần.

### BUS-CUST-003

Customer merge phải có audit.

### BUS-CUST-004

Xóa customer không được xóa historical order.

---

# 13. Channel Rules

Channel Account có các trạng thái:

```text
DISCONNECTED
CONNECTING
CONNECTED
SYNCING
AUTH_EXPIRED
ERROR
```

### BUS-CHANNEL-001

Credentials phải được tách biệt theo Channel Account.

### BUS-CHANNEL-002

Token hết hạn không được tiếp tục sử dụng.

### BUS-CHANNEL-003

Lỗi channel không được làm mất dữ liệu nội bộ đã hợp lệ.

---

# 14. Synchronization Rules

Các loại sync:

- Initial sync
- Incremental sync
- Manual sync
- Webhook-driven sync
- Recovery sync

### BUS-SYNC-001

Sync phải idempotent.

### BUS-SYNC-002

Sync failure phải retry được nếu lỗi có thể retry.

### BUS-SYNC-003

Một record lỗi không nên làm fail toàn bộ batch nếu hệ thống hỗ trợ partial success.

### BUS-SYNC-004

Sync phải có trạng thái và tiến trình quan sát được.

---

# 15. Webhook Rules

### BUS-WEBHOOK-001

Webhook phải được verify.

### BUS-WEBHOOK-002

Webhook phải idempotent.

### BUS-WEBHOOK-003

Webhook phải có cơ chế chống replay phù hợp.

### BUS-WEBHOOK-004

Webhook đến không đúng thứ tự không được làm hỏng state machine.

---

# 16. Livestream Rules

Trạng thái:

```text
DRAFT
SCHEDULED
LIVE
ENDED
CANCELLED
```

### BUS-LIVE-001

Livestream thuộc một Store và một Channel Account.

### BUS-LIVE-002

Chỉ Channel Account hợp lệ mới được sử dụng.

### BUS-LIVE-003

Livestream có thể gắn nhiều Product/Variant.

### BUS-LIVE-004

Order được attribution vào Livestream phải giữ được thông tin attribution.

---

# 17. Revenue và GMV

Đây là phần cần **chốt trước khi implementation analytics**.

### GMV đề xuất

```text
GMV =
Tổng giá trị hàng hóa được ghi nhận là bán
trước các khoản deduction được định nghĩa
```

Cần quyết định rõ:

- Có tính cancelled order không?
- Có tính refunded order không?
- Discount trừ trước hay sau?
- Shipping có tính không?
- Platform fee có tính không?
- Tax có tính không?

### Revenue đề xuất

```text
Gross Sales
- Discounts
- Refunds
- Các khoản deduction được định nghĩa
=
Net Sales / Revenue
```

Không coi GMV = Revenue mặc định.

---

# 18. Money Rules

### BUS-MONEY-001

Không dùng floating point cho phép tính tiền.

### BUS-MONEY-002

Mọi monetary value phải có currency.

### BUS-MONEY-003

Rounding rule phải deterministic.

---

# 19. Time Rules

### BUS-TIME-001

Backend lưu UTC.

### BUS-TIME-002

Store lưu timezone.

### BUS-TIME-003

Date filter phải tính theo timezone của Store.

---

# 20. Audit Rules

Phải audit:

- Role changes
- Permission changes
- Product mutation
- Inventory adjustment
- Order mutation
- Refund
- Channel connect/disconnect
- Manual sync
- Store settings

---

# 21. Business Invariants

1. Không truy cập được Store ngoài quyền.
2. Available Stock không âm.
3. Refund không vượt Payment.
4. External Order không duplicate.
5. Historical Order không thay đổi theo Product hiện tại.
6. Completed Order không quay về state trước.
7. Inventory mutation phải traceable.
8. Critical mutation phải authorized.
9. Webhook phải idempotent.
10. Sync phải idempotent.

---

# 22. Các Business Decision cần chốt

- Multi-store ownership.
- Inventory allocation.
- GMV definition.
- Revenue definition.
- Platform commission.
- Tax.
- Shipping.
- Refund-to-stock.
- Customer merge.
- Livestream attribution.
- Order attribution khi một order liên quan nhiều nguồn.
