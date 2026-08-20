# Architecture Decision / Implementation Readiness Report

> Dự án: Commerce Control Center
> Phạm vi phân tích: `docs/01` đến `docs/06` và ảnh `design/commerce-control-center-preview.png`
> Ngày: 2026-08-20
> Trạng thái đầu vào: Draft v1.0, chờ review
> Kết luận: Chưa nên bắt đầu implementation production trước khi chốt các quyết định P0 trong báo cáo này.

## 1. Executive Summary

Đây là một nền tảng quản lý bán hàng đa kênh, multi-tenant theo `Store`, với internal model làm nguồn chuẩn hóa dữ liệu. Kiến trúc phù hợp với specification là **modular monolith** gồm web app và API app trong monorepo, PostgreSQL làm transactional source of truth, Redis và queue cho tác vụ bất đồng bộ, cùng realtime gateway có authorization theo Store.

Các nền tảng kiến trúc đã tương đối rõ:

- Store boundary là boundary bắt buộc cho mọi dữ liệu và request.
- Backend là nơi quyết định authorization cuối cùng.
- Product, Order, Inventory, Channel/Integration và Audit có boundary riêng.
- External event, sync, webhook và mutation quan trọng phải idempotent.
- Inventory phải bảo toàn invariant `Available = Physical - Reserved >= 0`.
- Historical order và payment history phải được bảo toàn/immutable theo ngữ cảnh.

Các blockers chính trước development:

- Chưa chốt inventory global hay phân bổ theo channel.
- Chưa chốt định nghĩa GMV, Revenue, refund, shipping, fee và tax.
- Chưa có permission matrix đầy đủ cho từng action và từng role.
- Chưa chốt multi-store ownership và lifecycle invitation/membership.
- Chưa có contract chi tiết của TikTok/Shopee: API version, OAuth, webhook, rate limit, field mapping và status mapping.
- Chưa chốt auth strategy, realtime protocol, monorepo tool, môi trường deployment và secret management cụ thể.
- Livestream xuất hiện nổi bật trong UI nhưng được phân loại P1; ảnh còn có Website trong channel performance dù MVP chỉ nêu TikTok Shop và Shopee.

## 2. Product Architecture

### 2.1 Architectural shape

```text
Browser
  -> Web application (Next.js/React)
  -> API application (/api/v1)
       -> Auth and authorization
       -> Domain modules
       -> PostgreSQL
       -> Redis / queue workers
       -> Realtime gateway
       -> External channel adapters
              -> TikTok Shop
              -> Shopee
```

Recommended runtime shape for MVP, consistent with the technical specification:

- One modular API deployment initially, with worker processes separated logically or operationally when needed.
- One web application.
- PostgreSQL for normalized operational data and transactional invariants.
- Redis for queue coordination, transient cache and optionally pub/sub.
- Queue workers for sync, webhook processing, retries, notifications and analytics aggregation.
- External adapters isolated from core domain models.

This is an architectural recommendation derived from the technical specification, not a new business decision. No microservices should be introduced at MVP without a measured need.

### 2.2 Architectural principles

- Every domain record is Store-scoped unless explicitly system-global.
- Core domain must not depend on vendor payload shape.
- Cross-module behavior goes through application/domain interfaces, not direct table mutation.
- Database constraints enforce critical invariants in addition to application validation.
- Async processing is observable, retryable and idempotent.
- Realtime is an optimization for propagation; authoritative state remains in the API/database.
- All critical mutations are authorized and audited.

## 3. Bounded Contexts / Modules

| Context | Owns | Main responsibilities | Dependencies |
|---|---|---|---|
| Identity & Access | User, session, role, permission | Login, logout, session lifecycle, RBAC | Store membership |
| Store & Membership | Store, membership, active Store context | Store creation, selection, deactivation, invitation | Identity, Access |
| Product Catalog | Product, Variant/SKU, category, lifecycle | Product CRUD, archive, SKU uniqueness | Store, Channel mapping |
| Inventory | Inventory balance, reservation, transaction | Atomic adjustment, reserve/release, low stock | Product, Order commands |
| Order Management | Order, item snapshot, status history | Normalize/import, state machine, cancellation | Inventory, Payment, Integration |
| Payment & Refund | Payment, payment events, refund | Immutable payment history, refund limits/idempotency | Order, Inventory policy |
| Customer | Customer, channel identity mapping | Normalize, search, detail, merge audit | Order, Channel |
| Channel Account | Channel account, connection state, credential lifecycle | Connect/disconnect, OAuth state, account health | Integration adapters |
| Integration & Sync | Adapter, mapping, sync job, webhook event | Vendor API calls, normalization, retries, dedupe | Channel, Product, Order, Inventory |
| Livestream | Livestream, linked products, metrics, attribution | Draft/schedule/live/end, live metrics, attribution | Channel, Order, Analytics |
| Analytics & Reporting | Aggregations/read models | GMV, revenue, dashboard, channel/product reports | Order, Payment, Refund, Livestream |
| Notification | Notification and delivery state | New order, low stock, sync/auth/integration alerts | All event producers |
| Audit & Security Events | Audit log, security events | Before/after, actor, resource, timestamp | All critical mutation contexts |

The technical specification names `Channels` and `Integrations` separately; that separation should be retained. `Channel Account` owns lifecycle and credentials, while adapters own vendor communication and mapping.

## 4. Actors and Permission Model

### 4.1 Actors

- Owner
- Admin / Operations Manager
- Staff
- Warehouse Staff
- Customer Support
- Analyst
- Unauthenticated visitor, limited to authentication flows
- External channel system, limited to verified webhook/API interactions
- Background worker, acting with system identity and auditable job context

### 4.2 Authorization model

The required model is Store-scoped RBAC with permission checks in this order:

```text
Authenticated user
  -> active Store membership
  -> permission
  -> resource Store scope
  -> requested action
```

The API must never infer ownership from a resource ID. It must query the resource together with the authorized Store scope and return no cross-tenant metadata.

### 4.3 Permission vocabulary indicated by specs

The acceptance document explicitly uses `orders.read` and `inventory.adjust`. A complete permission catalog should at least cover:

- `stores.read`, `stores.update`, `stores.deactivate`
- `members.read`, `members.invite`, `members.update_role`, `members.remove`
- `roles.read`, `roles.manage`
- `products.read`, `products.create`, `products.update`, `products.archive`
- `inventory.read`, `inventory.adjust`, `inventory.reserve`, `inventory.history.read`
- `orders.read`, `orders.update_status`, `orders.cancel`, `orders.import`
- `customers.read`, `customers.merge`
- `channels.read`, `channels.connect`, `channels.disconnect`, `channels.sync`, `channels.errors.read`
- `livestream.read`, `livestream.create`, `livestream.start`, `livestream.end`, `livestream.metrics.read`
- `analytics.read`, `finance.read`
- `notifications.read`, `audit.read`

This is a candidate permission vocabulary, not an approved matrix. The role-to-permission mapping and financial-data policy still require owner/business approval.

## 5. Main Business Entities

### Identity and tenancy

- `User`
- `Store`
- `StoreMember` / membership status
- `Role`
- `Permission`
- `RolePermission`
- Session / refresh session, depending on final auth strategy

### Catalog and inventory

- `Product`
- `ProductVariant` / `SKU`
- `Category`
- `ChannelProductMapping`
- `InventoryBalance`
- `InventoryReservation`
- `InventoryTransaction`

### Orders and money

- `Order`
- `OrderItem` with immutable product/name/SKU/price snapshot
- `OrderStatusHistory`
- `Payment`
- `PaymentEvent` or equivalent immutable event history
- `Refund`

### Customer and channels

- `Customer`
- `CustomerChannelMapping`
- `ChannelAccount`
- `ChannelCredential` or encrypted credential reference
- `SyncJob`
- `WebhookEvent`

### Livestream and platform operation

- `Livestream`
- `LivestreamProduct`
- `LivestreamMetric`
- Attribution record for order-to-livestream association
- `Notification`
- `AuditLog`
- Security event / integration error record, if separated from audit

### Required entity constraints

- Store-scoped uniqueness for SKU.
- Store + Channel Account + external order ID uniqueness.
- Idempotency uniqueness for webhook/event and critical retriable operations.
- Foreign keys across owned entities.
- Monetary values stored as exact integer minor units or exact decimal, with currency and deterministic rounding policy.
- UTC timestamps, with Store timezone used for date filtering.
- Historical order item snapshots independent of current Product state.
- Soft-delete/archive semantics where history must remain visible.

## 6. Data Flow

### 6.1 External order / webhook flow

```text
TikTok/Shopee webhook or polling
  -> verify signature and identify Channel Account
  -> validate payload
  -> persist raw/deduplicated WebhookEvent or import identity
  -> enqueue processing job
  -> adapter normalization
  -> idempotency and Store-scope checks
  -> Order application service
  -> reserve inventory atomically when applicable
  -> persist Order, snapshots, status history and side effects transactionally
  -> publish domain/outbox event
  -> notification and realtime consumers
  -> frontend refetches authoritative state
```

The exact transaction boundary between event persistence, job enqueue, order creation and inventory reservation requires an outbox/reliable-delivery decision before implementation.

### 6.2 Inventory adjustment flow

```text
Authorized operator
  -> API validation and Store scope
  -> atomic balance mutation
  -> InventoryTransaction with before/after, actor, reason, source
  -> AuditLog
  -> domain event
  -> notification if low-stock threshold crossed
  -> realtime inventory update
  -> channel stock synchronization job
```

### 6.3 Channel connection and sync flow

```text
User selects channel
  -> OAuth initiation with state/anti-CSRF protection
  -> callback
  -> verify external account
  -> encrypt/store credentials
  -> create ChannelAccount
  -> enqueue initial sync
  -> process products/orders/mappings with partial failure handling
  -> update SyncJob and ChannelAccount status
  -> notify and expose progress/errors
```

### 6.4 Analytics flow

Operational data should remain authoritative in PostgreSQL. Dashboard queries may use indexed aggregate queries or asynchronous read models. The freshness SLA, aggregation schedule and correction/rebuild strategy are not yet specified.

## 7. Frontend Architecture

Use the proposed Next.js + React + TypeScript feature architecture:

- Route/application shell handles active Store, navigation, auth boundaries and layout.
- Feature boundaries: auth, store, dashboard, orders, products, inventory, customers, channels, livestream and analytics.
- Shared components: table, form, modal, toast, badges, date filters, loading/empty/error states.
- TanStack Query (or equivalent) owns server state, caching, invalidation and refetch.
- Local component/form state stays local; Zustand is only for explicitly justified cross-feature client state.
- React Hook Form + Zod can provide form state and client validation, but server validation remains authoritative.
- Large lists use server pagination, filtering/sorting and virtualization only where measured necessary.
- Realtime events invalidate or patch narrowly scoped cached queries; reconnect triggers authoritative resync.
- Permission-aware UI hides/disables unavailable actions, but does not replace backend authorization.

### Dashboard information architecture from the image

- Persistent dark sidebar: Dashboard, Sales, Products, Channels, Analytics, Administration, Settings/Help.
- Store context and current route in top bar: `Luma House / Dashboard`.
- Realtime connection indicator and user menu.
- Date-range selector and manual refresh action.
- KPI cards: Net Revenue, GMV, Orders, AOV, Conversion Rate, Refund Rate.
- Revenue performance chart with Revenue/GMV/Orders tabs.
- Live Commerce card with active livestream, viewers, orders and live GMV/conversion.
- Recent orders table with search, channel, livestream, value, status and relative time.
- Channel performance card with channel share, order count and value.
- Live performance chart with viewer/order/GMV tabs.
- Top products card with revenue, units sold and stock.
- Fixed live control-room entry banner.

The image shows a desktop-first dense operations dashboard. Responsive behavior, mobile scope, accessibility, exact interaction states and loading/error/empty variants are not defined by the image and must be specified.

## 8. Backend Architecture

### 8.1 Internal layering

Each module should be organized around:

- Controller/transport
- DTO and validation
- Application use cases
- Domain entities, policies and state transitions
- Infrastructure repositories, external adapters and persistence

NestJS is proposed, but `NestJS hoặc framework Node modular tương đương` means the framework is not yet a final ADR decision.

### 8.2 Integration boundary

Define a stable `ChannelAdapter` contract for authentication, token refresh, product/order retrieval, inventory update, webhook registration/verification and normalization. TikTok and Shopee vendor objects must remain in integration infrastructure and never leak into core domain types.

### 8.3 Async jobs

Queues are required for initial/incremental/recovery/manual sync, webhook processing, retries, notification delivery, analytics aggregation and large exports/imports. Each job needs identity, dedupe policy, retry/backoff, max attempts, failure state, observability and dead-letter handling.

## 9. Database Requirements

PostgreSQL is the intended transactional database. Before schema implementation, the following must be specified:

- Complete table attributes and enum/status policy.
- Tenant key strategy and whether every table carries `store_id` directly.
- Membership uniqueness and lifecycle constraints.
- SKU, external order, webhook and idempotency unique keys.
- Inventory concurrency strategy: atomic conditional update, row lock, or both.
- Reservation lifecycle, expiry and reconciliation rules.
- Order item snapshot fields and price/currency representation.
- Payment/refund allocation for partial refunds.
- Product/category/archive semantics.
- Channel mapping conflict and deletion states.
- Audit retention, sensitive-field redaction and append-only policy.
- Indexes for order/product/inventory/customer/dashboard query patterns.
- Pagination strategy and large-data export tables/jobs.
- Migration, backup, restore, retention and disaster recovery targets.

Use an outbox or equivalent reliable event publication mechanism if the system must guarantee that committed mutations eventually produce queue/realtime effects. This is a technical decision still requiring confirmation.

## 10. API Requirements

The specification establishes `/api/v1`, resource-oriented examples, a common success envelope and an error envelope containing code, message and request ID.

Required API groups include:

- Auth/session
- Stores and active Store selection
- Members, roles and permissions
- Products, variants, categories and mappings
- Inventory, adjustments, reservations and history
- Orders, status transitions, cancellation and detail/history
- Customers and merge
- Channel accounts, OAuth callbacks, status and sync jobs
- Webhook ingress endpoints per channel contract
- Livestream lifecycle and metrics
- Dashboard/analytics with Store-timezone date ranges
- Notifications and audit logs

Every endpoint specification still needs:

- Request/response schema and field nullability.
- Authentication and permission requirement.
- Store scope source and cross-tenant behavior.
- Pagination/filter/sort grammar and maximum limits.
- Idempotency requirements and key format.
- State-transition error codes.
- Validation and concurrency conflict responses.
- Date/time and currency serialization rules.
- Rate limits and webhook acknowledgment behavior.
- Versioning/deprecation policy.

## 11. Realtime Requirements

The required events are `order.created`, `order.updated`, `inventory.updated`, `livestream.metric.updated`, `notification.created` and `sync.failed`. Connections must be authorized and Store-scoped.

The transport is not decided: the technical spec permits WebSocket or SSE. The choice should be recorded as an ADR based on bidirectional needs, hosting constraints, connection scale and client complexity.

Minimum behavior:

- Authenticate and authorize at connection and subscription time.
- Never publish a Store event to an unauthorized client.
- Include event identity/version or cursor where needed.
- Auto-reconnect with backoff.
- Refetch authoritative state after reconnect or missed events.
- Define event ordering and duplicate handling.
- Define metric sampling/frequency and acceptable latency.
- Define fallback when realtime is unavailable.

The `< 1 second` propagation target is a goal, not yet an operational SLA or load-tested acceptance threshold.

## 12. External Integrations

Explicitly named integrations:

- TikTok Shop
- Shopee

The image also displays Website as a channel. This must be confirmed as either a future/placeholder channel or an MVP integration; it must not be implemented by assumption.

For each channel, the project needs a confirmed integration dossier:

- API and SDK version, region and production eligibility.
- OAuth grant, redirect URI, scopes and token refresh/revocation rules.
- Account identity and external ID uniqueness rules.
- Product, variant, order, payment, refund and inventory field mappings.
- External status-to-internal state mapping, including out-of-order events.
- Webhook event types, signature verification and replay window.
- Pagination, rate limits, Retry-After and error taxonomy.
- Inventory update semantics and conflict behavior.
- Sandbox/test accounts and certification requirements.
- PII handling, retention and permitted display fields.

No concrete vendor contract is present in the current documents, so channel implementation is not fully ready.

## 13. Authentication and Authorization

The documents require email/password login, sessions, expiration handling, rate limiting, generic login errors, secure browser cookies, HttpOnly, appropriate SameSite, CSRF protection and optional refresh strategy.

Still to decide in an ADR:

- Server-side session store versus signed access/refresh token model.
- Session and refresh lifetimes, rotation and revocation.
- Password hashing algorithm and password reset/email verification.
- MFA requirement and recovery process.
- Login/session invalidation after role or membership changes.
- Invitation acceptance and pending membership model.
- OAuth state/PKCE details for external channels.
- CSRF design for all cookie-authenticated mutations.
- Secret/key management and encryption-at-rest implementation.
- Audit/security event retention and operator access.

Authorization must be evaluated server-side on every protected request and mutation, including after a permission is revoked while a page is open.

## 14. Testing Strategy

### Unit and domain tests

- Order transition matrix and terminal states.
- Inventory formulas, atomic reservation/release and low-stock thresholds.
- Payment/refund limits, partial refunds and money rounding.
- Store-scope policies and permission checks.
- Normalization and channel status mapping.
- Idempotency key/event behavior.

### Integration tests

- PostgreSQL migrations, constraints, transactions and rollback.
- Concurrent inventory reservations and double cancellation.
- External order uniqueness and duplicate webhook processing.
- Queue retry, dead-letter and worker restart recovery.
- Realtime authorization and resync.
- Credential encryption/access boundaries.

### API and security tests

- Contract tests for request/response/error envelopes.
- IDOR and cross-Store access tests.
- RBAC matrix tests for every mutation.
- Authentication rate limiting and session expiry.
- CSRF, XSS, SQL injection, SSRF where applicable, secret exposure, webhook forgery/replay and excessive data exposure.

### Frontend tests

- React Testing Library for permission-aware states, forms, loading/empty/error states and filter behavior.
- Playwright for login, Store selection, product creation, inventory adjustment, order processing/cancellation, channel connection and dashboard date filtering.
- Realtime reconnect/missed-event reconciliation.

### Performance and operations tests

- API p95 target under realistic dataset and concurrency.
- Dashboard initial load under realistic aggregate query volume.
- 100k+ order list behavior and large export.
- Sync batch partial failure and rate limiting.
- Realtime latency and connection authorization.

Acceptance requires traceability from business rule through requirement, design, edge case, acceptance criterion, task and automated test.

## 15. Infrastructure and Deployment Requirements

The current specification suggests Docker, GitHub Actions and possibly Vercel for frontend, but does not define a complete deployment topology.

Minimum infrastructure capabilities:

- Separate web, API and worker runtime concerns.
- Managed PostgreSQL with migrations, backups, restore test and monitoring.
- Redis with persistence/availability appropriate to queue requirements.
- Secure secret and encryption-key management.
- TLS, domain and OAuth callback configuration.
- Queue worker scaling and dead-letter inspection.
- Centralized structured logs, request IDs, error tracking and metrics.
- Monitoring for API/DB latency, queue depth, sync/webhook failures, auth failures and realtime health.
- CI gates: install, lint, typecheck, unit, integration, build and critical E2E.
- Environment separation: local, test/CI, staging and production.
- Data retention, PII controls and incident response.
- Deployment rollback and migration compatibility strategy.

Open infrastructure decisions:

- Hosting for API and workers.
- Whether Vercel is compatible with the selected realtime and long-running worker model.
- PostgreSQL/Redis providers and regions.
- Availability, RPO and RTO targets.
- Domain, email provider and notification delivery channels.
- Observability providers and alert ownership.

## 16. UI to Requirement Mapping

| UI element in reference | Requirement mapping | Readiness / gap |
|---|---|---|
| Store name and breadcrumb | REQ-STORE-001, 003 | Active Store and multi-Store switching behavior need exact contract. |
| Realtime connected indicator | REQ-NFR-001, technical realtime events | Transport, health semantics, fallback and reconnect UX unspecified. |
| Date selector: 7 days | REQ-DASH-002, BUS-TIME-003 | Presets exist; comparison-period and custom timezone boundaries need definition. |
| Refresh data button | REQ-CHANNEL-003, dashboard | Manual dashboard refresh semantics, rate limit and cache invalidation unspecified. |
| Net Revenue KPI | REQ-DASH-001 | Revenue definition, deductions, refund timing and aggregation source unresolved. |
| GMV KPI | REQ-DASH-001 | GMV formula explicitly unresolved in business spec. |
| Orders KPI | REQ-DASH-001 | Inclusion by status/date/time needs confirmation. |
| AOV KPI | REQ-DASH-001 | Denominator and treatment of cancelled/refunded orders unspecified. |
| Conversion rate KPI | REQ-DASH-001, REQ-LIVE-003 | Funnel numerator/denominator and source of viewers unspecified. |
| Refund rate KPI | REQ-DASH-001 | Amount versus order/quantity rate and date attribution unresolved. |
| Revenue performance chart | REQ-DASH-001, analytics | Time bucket, timezone, missing data and aggregation freshness unspecified. |
| Live Commerce card | REQ-LIVE-003, P1 livestream | UI prominence conflicts with P1 classification; MVP inclusion must be confirmed. |
| Recent orders table | REQ-ORD-001/002, realtime events | Image shows `Website` channel; MVP channel scope conflict. Livestream attribution also needs rule. |
| Channel performance | REQ-DASH-001, analytics | Channel list and financial calculation unresolved; Website discrepancy. |
| Live performance chart | REQ-LIVE-003 | Metric sampling, source and P1 delivery scope unresolved. |
| Top products | REQ-DASH-001, REQ-PROD/INV | Ranking metric, archived products and stock freshness unspecified. |
| Live control-room banner | REQ-LIVE-001/002/003 | Deep-link route, permission and behavior when no live session unspecified. |
| Notification dot/avatar | REQ-NOTIF-001, auth | Notification read state, menu, profile and session actions unspecified. |
| Sidebar badges for orders/stock/errors | REQ-NOTIF-001, channel/sync | Count definition, refresh/realtime source and permissions unspecified. |

## 17. Contradictions and Ambiguities

### 17.1 Scope and priority

- Livestream is P1 in product scope but is a major first-class dashboard region and bottom control-room CTA in the reference image.
- Analytics/dashboard financial widgets are P0/P1 mixed, while GMV and Revenue definitions are explicitly not finalized.
- Image includes Website; product MVP explicitly names TikTok and Shopee only.
- Product navigation includes Categories, but category entity and functional CRUD requirements are not defined.
- Technical entity list includes `livestream_metrics`, but metric source, sampling and retention are not defined.

### 17.2 Business rule gaps

- Inventory source strategy is unresolved: global stock versus per-channel allocation.
- Conflict handling between manual adjustment and external sync is required but not defined.
- Refund-to-stock depends on actual item condition, but the return/inspection state model is absent.
- Customer merge rules, identity matching, reversibility and conflict resolution are absent.
- Livestream attribution and multi-source order attribution are explicitly unresolved.
- Order cancellation conditions per state and per channel are only partially specified.
- Channel transition mapping is required but no TikTok/Shopee mapping exists.
- Multi-store ownership is listed as a decision, while Store switching is already specified.

### 17.3 Technical gaps

- NestJS versus another Node modular framework is open.
- Monorepo tool is open.
- WebSocket versus SSE is open.
- Session versus token/refresh implementation is open.
- Outbox/reliable event publication is not specified.
- API/Data schema is deferred and therefore not implementation-ready.
- Deployment topology, worker runtime and Vercel compatibility are open.
- Notification delivery is not defined beyond in-app notification.

## 18. Decisions Required From Product/Business Owner

These should be answered before implementing the affected modules:

1. Is MVP limited to TikTok Shop and Shopee, or does Website also belong to MVP?
2. Is Livestream P0 for the dashboard launch, or P1 and therefore excluded from the initial dashboard release?
3. Is one User allowed to own multiple Stores, and how are ownership transfer, invitations and membership removal handled?
4. Is inventory global or allocated per channel? How are reservations and channel stock updates calculated?
5. Define GMV exactly, including cancelled, refunded, discount, shipping, fee and tax treatment.
6. Define Revenue/Net Sales exactly, including timing and allocation of partial refunds.
7. Define AOV, conversion rate and refund rate formulas and denominators.
8. Define refund, return inspection and stock-restoration rules.
9. Define customer identity matching and merge policy.
10. Define livestream attribution and orders involving multiple sources.
11. Define all role-to-permission mappings, especially finance/analytics and channel credentials.
12. Define allowed order cancellation transitions and channel-specific exceptions.
13. Confirm categories as MVP scope and define category behavior.
14. Confirm supported currencies and Store currency immutability/change policy.
15. Confirm PII display, retention and deletion/anonymization policy.

## 19. Technical ADRs Required

1. Final frontend/backend framework selection.
2. Monorepo tool and package boundaries.
3. Browser authentication/session strategy.
4. Realtime transport and event delivery/resync model.
5. Queue technology, worker deployment and dead-letter operations.
6. Event publication consistency: outbox or equivalent.
7. Inventory concurrency and channel allocation strategy.
8. Money representation, currency and rounding implementation.
9. Analytics aggregation/read-model strategy and freshness SLA.
10. Credential encryption, key management and secret rotation.
11. Hosting topology, database/Redis providers and DR targets.
12. API contract format/generation strategy.

## 20. What Is Ready to Start

The following foundation is sufficiently specified for design and proof-of-concept work, subject to normal ADR review:

- Modular monolith as the initial product architecture.
- Store-scoped tenancy and backend-enforced authorization.
- Core boundaries for Auth, Store, Product, Inventory, Order, Channel/Integration, Customer, Audit and Notifications.
- PostgreSQL as transactional database; Redis/queue for asynchronous work.
- Normalized internal model independent of vendor objects.
- Product/SKU uniqueness and historical order preservation.
- Inventory non-negative invariant, transaction logging, atomic reservation and idempotency requirements.
- Order status history and explicit invalid-transition rejection.
- Webhook verification, dedupe, replay protection and safe failure principles.
- Required test categories and CI quality gates.
- Initial dashboard information architecture and navigation direction.

The safest initial development slice, after resolving the P0 decisions, is foundation plus one vertical slice that proves Store isolation, RBAC, Product/SKU, Inventory and audit behavior.

## 21. What Is Missing Before Production Development

- Approved product/business spec, currently all source docs are Draft and “Chờ review”.
- Complete permission matrix.
- API specification and data/schema specification.
- Channel integration contracts and sandbox credentials.
- Final financial metric definitions.
- Inventory allocation/conflict policy.
- Auth, realtime, event publication and deployment ADRs.
- Responsive/accessibility/UI state specification.
- Retention, backup/restore, DR and PII/security policies.
- Performance test dataset and measurable SLA definitions.

## 22. Recommended Implementation Order

This order preserves dependencies and validates the highest-risk invariants early:

1. Resolve the P0 business and technical decisions listed in sections 18 and 19.
2. Approve API contract, data model, event naming, permission matrix and traceability matrix.
3. Establish repository, environments, migrations, PostgreSQL, Redis/queue, CI, logging and request IDs.
4. Build application shell, design-system primitives and standard loading/empty/error states from the reference UI.
5. Implement authentication, Store membership/switching, RBAC and audit infrastructure.
6. Implement Product, Variant/SKU, category scope if approved, archive semantics and APIs/UI.
7. Implement Inventory transaction ledger, atomic adjustment, reservation/release, concurrency tests and low-stock notifications.
8. Implement Order domain/state machine, immutable item snapshots, payment/refund model, cancellation and inventory integration.
9. Implement Channel abstraction and one provider end-to-end, including OAuth, product/order sync, webhook, retries and observability.
10. Add the second provider only after the adapter contract and first provider behavior are proven.
11. Add event publication, realtime gateway, authorization, reconnect and authoritative resync.
12. Implement dashboard aggregates only after GMV/Revenue/AOV/conversion/refund formulas are approved.
13. Implement Livestream and live metrics according to the confirmed P0/P1 scope and attribution rules.
14. Add advanced analytics, exports, production hardening, security review, load tests, DR verification and deployment.

Do not begin with dashboard calculations or channel-specific UI shortcuts. The highest-risk correctness properties are Store isolation, inventory concurrency, order idempotency, payment/refund invariants and metric definitions.

## 23. Final Readiness Verdict

**Architecture readiness:** Directionally ready. Modular monolith and primary boundaries are clear.

**Implementation readiness:** Partial. Foundation and non-financial domain design can proceed after ADR approval, but production implementation of integrations, inventory allocation, financial analytics, livestream and authorization cannot be considered fully specified yet.

**Code status:** No source code was written. This work added only this architecture/readiness report. The supplied image filename was absent; analysis used the existing `design/commerce-control-center-preview.png`.
