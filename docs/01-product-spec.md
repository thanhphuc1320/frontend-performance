# 01 — Product Specification

> Phiên bản: Draft v1.0  
> Trạng thái: Chờ review  
> Ngôn ngữ: Tiếng Việt

## 1. Mục đích tài liệu

Tài liệu này định nghĩa sản phẩm, mục tiêu, phạm vi, người dùng, module, user journey và các khái niệm cốt lõi của nền tảng quản lý bán hàng đa kênh.

Đây là nguồn tham chiếu cấp Product. Các chi tiết về business rule, technical implementation và acceptance được quy định ở các tài liệu khác.

---

## 2. Tổng quan sản phẩm

### 2.1 Tên sản phẩm

**Multi-Channel Commerce Management Platform**

Tên làm việc: **Commerce Control Center**

### 2.2 Tầm nhìn

Xây dựng một trung tâm điều hành duy nhất cho người bán hàng đa kênh, giúp quản lý tập trung:

- Cửa hàng
- Kênh bán hàng
- Sản phẩm
- SKU / Variant
- Tồn kho
- Đơn hàng
- Khách hàng
- Livestream
- Doanh thu
- Báo cáo
- Người dùng và phân quyền

### 2.3 Vấn đề cần giải quyết

Người bán hàng qua TikTok Shop, Shopee và livestream thường phải:

- Quản lý nhiều hệ thống khác nhau.
- Đồng bộ sản phẩm thủ công.
- Theo dõi tồn kho ở nhiều nơi.
- Xử lý đơn hàng từ nhiều nguồn.
- Khó theo dõi doanh thu tổng.
- Khó theo dõi hiệu quả livestream.
- Không có một nơi duy nhất để theo dõi trạng thái vận hành.
- Khó phát hiện lỗi đồng bộ và webhook.

Sản phẩm giải quyết vấn đề bằng cách chuẩn hóa dữ liệu từ các kênh bên ngoài thành một mô hình nội bộ thống nhất.

---

## 3. Mục tiêu sản phẩm

### Mục tiêu chính

1. Tập trung hóa hoạt động bán hàng.
2. Quản lý nhiều kênh trong một hệ thống.
3. Chuẩn hóa dữ liệu từ các nền tảng.
4. Cung cấp thông tin tồn kho đáng tin cậy.
5. Quản lý đơn hàng tập trung.
6. Cung cấp realtime cho các nghiệp vụ cần thiết.
7. Theo dõi hiệu quả livestream.
8. Cung cấp analytics phục vụ quyết định kinh doanh.
9. Đảm bảo phân quyền và audit.
10. Thiết kế nền tảng đủ tốt để mở rộng thêm channel.

---

## 4. Không thuộc phạm vi ban đầu

MVP không xây dựng:

- Hệ thống kế toán đầy đủ.
- ERP đầy đủ.
- Payroll.
- HRM.
- Quản lý đội giao hàng.
- Tối ưu tuyến giao hàng.
- Hệ thống marketing automation hoàn chỉnh.
- Marketplace dành cho người mua.
- AI tự động bán hàng.
- AI recommendation engine.

Các tính năng trên có thể được xem xét ở giai đoạn sau.

---

## 5. Đối tượng sử dụng

### 5.1 Owner

Quản lý toàn bộ Store:

- Cấu hình Store.
- Kết nối channel.
- Quản lý user.
- Quản lý sản phẩm.
- Theo dõi tồn kho.
- Theo dõi đơn hàng.
- Theo dõi doanh thu.
- Xem analytics.

### 5.2 Admin / Operations Manager

Quản lý hoạt động hằng ngày:

- Đơn hàng.
- Sản phẩm.
- Tồn kho.
- Livestream.
- Khách hàng.

### 5.3 Staff / Customer Support

- Tra cứu đơn hàng.
- Tra cứu khách hàng.
- Hỗ trợ xử lý đơn.
- Xem thông tin cần thiết theo permission.

### 5.4 Warehouse Staff

- Xem tồn kho.
- Điều chỉnh tồn kho.
- Theo dõi stock movement.
- Hỗ trợ xử lý fulfillment.

### 5.5 Analyst

- Dashboard.
- Doanh thu.
- Sản phẩm.
- Channel.
- Livestream.

---

## 6. Mô hình sản phẩm

```text
User
  │
  ▼
Store
  │
  ├── Users / Roles
  ├── Channel Accounts
  │     ├── TikTok Shop
  │     └── Shopee
  │
  ├── Products
  │     └── Variants / SKUs
  │
  ├── Inventory
  │
  ├── Orders
  │
  ├── Customers
  │
  ├── Livestreams
  │
  └── Analytics
```

---

## 7. Module sản phẩm

### Core

- Authentication
- Store Management
- User Management
- RBAC
- Dashboard
- Products
- Variants / SKUs
- Inventory
- Orders
- Customers
- Channels
- Synchronization
- Webhooks
- Notifications
- Audit Logs

### Advanced

- Livestream
- Realtime Metrics
- Analytics
- Reports

---

## 8. Cấu trúc điều hướng

```text
Dashboard

Bán hàng
├── Đơn hàng
├── Khách hàng
└── Livestream

Sản phẩm
├── Sản phẩm
├── Danh mục
└── Tồn kho

Kênh bán hàng
├── Kênh đã kết nối
├── Đồng bộ
└── Lỗi tích hợp

Phân tích
├── Tổng quan
├── Doanh thu
├── Sản phẩm
├── Kênh
└── Livestream

Quản trị
├── Người dùng
├── Vai trò & quyền
├── Nhật ký hoạt động
└── Cài đặt
```

---

## 9. User Journey

### 9.1 Thiết lập Store

```text
Đăng nhập
→ Tạo / chọn Store
→ Kết nối TikTok Shop
→ Kết nối Shopee
→ Đồng bộ sản phẩm
→ Kiểm tra tồn kho
→ Sẵn sàng vận hành
```

### 9.2 Xử lý đơn hàng

```text
Dashboard
→ Đơn hàng mới
→ Lọc / tìm kiếm
→ Xem chi tiết
→ Kiểm tra thanh toán
→ Xử lý đơn
→ Cập nhật trạng thái
→ Hoàn tất
```

### 9.3 Livestream

```text
Tạo Livestream
→ Chọn channel
→ Chọn sản phẩm
→ Bắt đầu
→ Theo dõi người xem
→ Theo dõi đơn
→ Theo dõi tồn kho
→ Theo dõi GMV
→ Kết thúc
→ Xem kết quả
```

---

## 10. Thuật ngữ

### Store

Workspace của một business.

### Channel

Nền tảng bán hàng như TikTok Shop hoặc Shopee.

### Channel Account

Tài khoản shop cụ thể được kết nối từ một Store tới channel.

### Product

Sản phẩm ở mô hình nội bộ.

### Variant

Biến thể của Product.

### SKU

Đơn vị quản lý tồn kho và bán hàng.

### Order

Đơn hàng đã được chuẩn hóa về mô hình nội bộ.

### Customer

Khách hàng được chuẩn hóa từ các channel.

### Livestream

Một phiên bán hàng trực tiếp.

### Physical Stock

Số lượng tồn vật lý.

### Reserved Stock

Số lượng đang được giữ cho các reservation.

### Available Stock

```text
Available Stock = Physical Stock - Reserved Stock
```

---

## 11. Nguyên tắc sản phẩm

### 11.1 Internal Model First

Mô hình nội bộ không được phụ thuộc trực tiếp vào cấu trúc dữ liệu của một channel.

### 11.2 Business Rule Explicit

Business rule quan trọng phải được viết rõ trong Business Specification.

### 11.3 Fail Safely

Lỗi từ external platform không được làm hỏng dữ liệu nội bộ.

### 11.4 Auditability

Mutation quan trọng phải truy được:

- Ai thực hiện.
- Thực hiện gì.
- Resource nào.
- Giá trị trước.
- Giá trị sau.
- Thời điểm.

### 11.5 Performance First

Các màn hình có dataset lớn phải được thiết kế với pagination, caching, virtualization và query optimization.

---

## 12. KPI sản phẩm

Mục tiêu ban đầu:

| Chỉ số | Mục tiêu |
|---|---:|
| Tỷ lệ đồng bộ đơn hàng thành công | > 99% |
| Độ chính xác tồn kho | > 99.9% |
| Realtime event latency | < 1 giây mục tiêu |
| API p95 | < 500ms mục tiêu |
| Dashboard initial load | < 2.5 giây mục tiêu |

Các con số này cần được xác nhận lại bằng load test thực tế.

---

## 13. MVP

### P0 — Bắt buộc

- Authentication
- Store
- User / RBAC
- Dashboard cơ bản
- Products
- Variants / SKU
- Inventory
- Orders
- Customers cơ bản
- TikTok integration
- Shopee integration
- Webhook
- Synchronization
- Notification
- Audit log

### P1

- Livestream
- Realtime metrics
- Analytics nâng cao

### P2

- AI analytics
- Advanced promotion
- Customer segmentation
- Thêm channel mới

---

## 14. Ràng buộc sản phẩm

1. Dữ liệu phải được scope theo Store.
2. Một User có thể được thiết kế để thuộc nhiều Store.
3. External ID không mặc định là globally unique.
4. Historical Order phải tồn tại ngay cả khi Product bị archive.
5. Business mutation quan trọng phải audit.
6. Webhook phải idempotent.
7. Inventory không được âm do race condition.
8. Permission phải được kiểm tra ở backend.
