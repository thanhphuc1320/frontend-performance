# 05 — Edge Cases và Failure Handling

> Phiên bản: Draft v1.0  
> Trạng thái: Chờ review

## 1. Mục đích

Tài liệu này định nghĩa cách hệ thống phản ứng khi xảy ra:

- Lỗi.
- Dữ liệu không hợp lệ.
- Request trùng.
- Request đến sai thứ tự.
- Race condition.
- External API failure.
- Network failure.
- Permission thay đổi.
- Database failure.
- Security attack.

Nguyên tắc:

> Không được để lỗi ngoài dự kiến làm mất hoặc làm sai dữ liệu hợp lệ.

---

# 2. Authentication

## EDGE-AUTH-001 — Session hết hạn

Khi user đang thao tác mà session hết hạn:

- API trả 401.
- Refresh nếu có thể.
- Nếu không → yêu cầu login.
- Không làm mất dữ liệu form nếu có thể giữ an toàn.

## EDGE-AUTH-002 — Login thất bại nhiều lần

- Rate limit.
- Không tiết lộ email có tồn tại hay không.
- Ghi security event khi cần.

---

# 3. Authorization

## EDGE-AUTHZ-001 — Đổi ID trên URL

User thuộc Store A gọi resource của Store B.

Kết quả:

- Reject.
- Không leak metadata.
- Không thực hiện mutation.

## EDGE-AUTHZ-002 — Permission bị thu hồi

User mở page khi còn permission, sau đó permission bị revoke.

Khi mutation:

- Backend kiểm tra lại.
- Trả 403.
- UI cập nhật trạng thái quyền.

---

# 4. Store Isolation

## EDGE-STORE-001

User Store A gọi:

```text
/orders/{order-of-store-B}
```

Expected:

- Reject.
- Không trả dữ liệu Store B.

---

# 5. Product

## EDGE-PROD-001 — Duplicate SKU

SKU đã tồn tại.

Expected:

- DB constraint reject.
- API trả validation error.
- Không tạo Product/Variant dở dang.

## EDGE-PROD-002 — Archive Product có historical Order

Expected:

- Order cũ vẫn hiển thị.
- Product không bị hard-delete.

## EDGE-PROD-003 — External Product bị xóa

Expected:

- Internal Product vẫn giữ historical data.
- Mapping channel chuyển trạng thái phù hợp.

---

# 6. Inventory

## EDGE-INV-001 — Hai người mua SKU cuối

Initial:

```text
Available = 1
```

Request A:

```text
reserve 1
```

Request B:

```text
reserve 1
```

Expected:

- Chỉ một request thành công.
- Available không âm.
- Không tạo duplicate reservation.

## EDGE-INV-002 — Duplicate Reservation

Cùng một operation được gửi hai lần.

Expected:

- Reservation chỉ được áp dụng một lần.

## EDGE-INV-003 — Duplicate Release

Reservation đã release nhưng request release lại.

Expected:

- Không giảm stock thêm lần nữa.

## EDGE-INV-004 — Cancel Order

Order có reservation.

Cancel:

- Release đúng một lần.
- Tạo transaction.
- Audit.

## EDGE-INV-005 — Manual Adjustment + External Sync

Operator điều chỉnh stock trong lúc sync.

Expected:

- Có strategy xử lý conflict.
- Không silent overwrite.

---

# 7. Orders

## EDGE-ORD-001 — Duplicate Webhook

Cùng External Order ID đến hai lần.

Expected:

- Một internal Order.
- Event thứ hai idempotently ignored/merged.

## EDGE-ORD-002 — Webhook sai thứ tự

```text
SHIPPED
đến trước
CONFIRMED
```

Expected:

- Không áp dụng transition invalid.
- Event được lưu/recovery theo strategy.

## EDGE-ORD-003 — Invalid Transition

```text
COMPLETED → PROCESSING
```

Expected:

- Reject.
- Không thay đổi DB.

## EDGE-ORD-004 — Double Cancel

Hai client cancel cùng lúc.

Expected:

- Một logical cancellation.
- Reservation release một lần.

---

# 8. Payment

## EDGE-PAY-001 — Duplicate Payment

Payment event đến hai lần.

Expected:

- Không cộng tiền hai lần.

## EDGE-PAY-002 — Refund vượt Payment

Expected:

- Reject.
- Không mutation.

## EDGE-PAY-003 — Partial Refund

Expected:

- Tính remaining refundable amount chính xác.
- Payment chuyển PARTIALLY_REFUNDED.

---

# 9. Channel

## EDGE-CHANNEL-001 — Token hết hạn

Expected:

1. Refresh.
2. Nếu fail → AUTH_EXPIRED.
3. Notify authorized user.
4. Không retry vô hạn.

## EDGE-CHANNEL-002 — External API Down

Expected:

- Không làm hỏng internal data.
- Background job retry.
- User thấy trạng thái lỗi.

## EDGE-CHANNEL-003 — Rate Limit 429

Expected:

- Respect Retry-After.
- Exponential backoff.
- Max retry.
- Log.

---

# 10. Synchronization

## EDGE-SYNC-001 — Partial Failure

1000 record:

```text
700 success
300 failed
```

Expected:

- Giữ 700.
- Retry 300.
- Hiển thị progress.
- Có failure summary.

## EDGE-SYNC-002 — Duplicate Sync Job

Expected:

- Không chạy hai job nguy hiểm cùng lúc cho cùng Channel Account nếu không cần.

## EDGE-SYNC-003 — External Data thay đổi trong lúc sync

Expected:

- Có conflict strategy.
- Không overwrite dữ liệu hợp lệ một cách âm thầm.

---

# 11. Webhook

## EDGE-WEBHOOK-001 — Invalid Signature

Expected:

- Reject.
- Không mutation.
- Security log.

## EDGE-WEBHOOK-002 — Replay

Expected:

- Event ID đã xử lý → không xử lý lại side effect.

## EDGE-WEBHOOK-003 — Malformed Payload

Expected:

- Reject.
- Không partial mutation.
- Log an toàn.

---

# 12. Queue

## EDGE-QUEUE-001 — Job Failure

Expected:

```text
Retry
→ Backoff
→ Retry limit
→ Dead Letter
→ Alert
```

## EDGE-QUEUE-002 — Worker Restart

Expected:

- Job được retry/recover.
- Không duplicate side effect.

---

# 13. Realtime

## EDGE-REALTIME-001 — Client mất kết nối

Expected:

- Auto reconnect.
- Exponential backoff.
- Resync.

## EDGE-REALTIME-002 — Missed Events

Expected:

- Sau reconnect, client lấy authoritative state.
- Không phụ thuộc hoàn toàn vào event đã bỏ lỡ.

## EDGE-REALTIME-003 — Unauthorized Event

Expected:

- User không bao giờ nhận event của Store không có quyền.

---

# 14. Database

## EDGE-DB-001 — Transaction Failure

Expected:

- Rollback toàn bộ transaction.
- Không partial mutation.

## EDGE-DB-002 — Deadlock

Expected:

- Retry khi operation an toàn.
- Ghi log khi hết retry.

---

# 15. Large Dataset

## EDGE-DATA-001 — 100k+ Orders

Expected:

- Server-side pagination.
- Index.
- Không tải toàn bộ về browser.

## EDGE-DATA-002 — Export lớn

Expected:

- Background job.
- Progress.
- File generation.
- Download sau khi hoàn tất.

---

# 16. Browser

## EDGE-CLIENT-001 — Double Click

Expected:

- Disable button.
- Backend vẫn phải idempotent.

## EDGE-CLIENT-002 — Refresh giữa mutation

Expected:

- Mutation không bị thực hiện hai lần.

## EDGE-CLIENT-003 — Multiple Tabs

Expected:

- Server là source of truth.
- Tab cũ được reconcile bằng realtime/refetch.

---

# 17. Time

## EDGE-TIME-001 — Date boundary

Ví dụ:

```text
23:59:59 → 00:00:00
```

Expected:

- Backend UTC.
- Date filter theo Store timezone.

---

# 18. Money

## EDGE-MONEY-001 — Floating point

Không dùng:

```text
0.1 + 0.2
```

cho financial calculation.

Phải dùng exact decimal/integer representation.

---

# 19. Security

Tối thiểu phải test:

- IDOR
- Broken access control
- XSS
- CSRF
- SQL injection
- Credential exposure
- Webhook forgery
- Replay
- Brute force
- Rate-limit bypass
- Excessive data exposure

---

# 20. Failure Principle

Khi xảy ra lỗi:

1. Không làm mất dữ liệu hợp lệ.
2. Không tạo duplicate side effect.
3. Ghi nhận failure.
4. Retry nếu an toàn.
5. Cho operator biết cách xử lý.
6. Không silent failure.
