# Implementation Readiness Report

> Product: Commerce Control Center
> Phase: 0 - Discovery & Architecture
> Input: `docs/01-product-spec.md` through `docs/06-acceptance-and-development.md`
> Visual source: `design/commerce-control-center-preview.png`
> Requested visual filename: `design/dashboard-reference.png` (not present)
> Status: Draft input, pending product and architecture review
> Code status: No application source code, component, API implementation, migration, infrastructure setup, or authentication code was created.

## 1. Executive Summary

Commerce Control Center is a Store-scoped, multi-channel commerce operations platform. The confirmed direction is a modular monolith with a normalized internal model, PostgreSQL as the operational transactional source of truth, asynchronous processing for synchronization and integration work, and Store-authorized realtime propagation.

The following are sufficiently established for architecture design:

- Store is the tenant and ownership boundary.
- All business records and requests must respect Store membership.
- Backend authorization is authoritative.
- Product/SKU, Inventory, Order, Customer, Channel Account, Synchronization, Notification and Audit are core boundaries.
- Critical mutations and external processing must be auditable and idempotent.
- Inventory must preserve `Available Stock = Physical Stock - Reserved Stock >= 0`.
- Historical order data must survive product archive/removal.

Implementation is **BLOCKED for production development** until the P0 decisions in section 22 are approved. The largest blockers are inventory allocation, financial metric definitions, the complete permission matrix, multi-Store ownership/membership policy, channel contracts, authentication strategy, and the realtime/event delivery contract.

Classification used throughout:

- **CONFIRMED**: explicitly stated in the six specifications or visibly present in the supplied image.
- **INFERRED**: a reasonable architectural consequence, not an approved requirement.
- **MISSING**: not defined by the specifications or image.
- **CONFLICT**: two inputs establish incompatible scope or behavior.

## 2. Product Architecture

### 2.1 Scope

| Scope | Modules |
|---|---|
| MVP P0, CONFIRMED | Authentication, Store, User/RBAC, Dashboard basic, Products, Variants/SKU, Inventory, Orders, basic Customers, TikTok integration, Shopee integration, Webhooks, Synchronization, Notifications, Audit Logs |
| P1, CONFIRMED | Livestream, realtime metrics, advanced analytics |
| P2/future, CONFIRMED | AI analytics, advanced promotion, customer segmentation, additional channels |
| Explicitly excluded from initial scope, CONFIRMED | Full accounting/ERP, payroll/HRM, delivery fleet/route optimization, complete marketing automation, buyer marketplace, AI selling, recommendation engine |

### 2.2 Recommended runtime shape

```text
Browser
  -> Web application
  -> Versioned API
       -> Auth and Store authorization
       -> Domain modules
       -> PostgreSQL
       -> Redis/queue workers
       -> Realtime delivery
       -> TikTok/Shopee adapters
```

This is a recommendation based on the technical specification, not a new confirmed requirement. Use one modular API initially; separate worker runtime logically or operationally. Do not introduce microservices without measured operational or scaling need.

### 2.3 System boundaries

- Internal boundary: Store-scoped normalized operational model.
- External boundary: TikTok Shop and Shopee APIs, OAuth, webhooks, status and data mappings.
- Client boundary: Browser UI, client cache and realtime connection; client is never authoritative for authorization or concurrency.
- Operational boundary: Background jobs, retries, dead-letter handling, notifications and observability.

## 3. Bounded Contexts

| Context | MVP status | Owns / responsibility |
|---|---|---|
| Identity & Access | MVP | User, session, roles, permissions, authentication and authorization |
| Store & Membership | MVP | Store, membership, active Store context and lifecycle |
| Product Catalog | MVP | Product, Variant/SKU, category scope if approved, archive and channel mappings |
| Inventory | MVP | Balances, reservations, transactions, adjustments and low-stock policy |
| Order Management | MVP | Orders, items, state machine, status history and cancellation |
| Payment & Refund | MVP-required for order correctness; scope needs confirmation | Payment state/history and refund constraints |
| Customer | MVP basic | Normalized customer profile, channel mapping, lookup and detail |
| Channel Account | MVP | Connection state, credentials and account lifecycle |
| Integration & Synchronization | MVP | Vendor adapters, mapping, normalization, sync jobs and webhooks |
| Notification | MVP | New order, low stock, sync/auth/integration notifications |
| Audit & Security Events | MVP | Critical mutation audit and security events |
| Dashboard / Analytics | MVP basic; advanced P1 | Operational aggregates, metrics and reports |
| Livestream | P1, unless product owner promotes it | Livestream lifecycle, products, metrics and attribution |

Cross-context writes must use application/domain interfaces. For example, Order must not update Inventory storage directly.

## 4. Actors & Permissions

### 4.1 Actors

| Actor | Confirmed responsibility |
|---|---|
| Owner | Full Store management |
| Admin / Operations Manager | Daily operations: orders, products, inventory, livestream, customers |
| Staff | Order/customer lookup and permitted order support |
| Warehouse Staff | Inventory, stock movements and fulfillment support |
| Customer Support | Order/customer access according to permission |
| Analyst | Dashboard, revenue, product, channel and livestream analytics |
| Unauthenticated visitor | Authentication flows only, INFERRED |
| External channel | Verified API/webhook interaction, INFERRED |
| Background worker | System actor with job context, INFERRED |

### 4.2 Architecture-level permission matrix

`R` means read; `C` create; `U` update; `D` delete/archive; `M` manage; `X` special action. This is a candidate matrix, not an approval of role permissions.

| Resource/action | Owner | Admin | Staff | Warehouse | Support | Analyst |
|---|---:|---:|---:|---:|---:|---:|
| Store/settings manage | M | limited | - | - | - | - |
| Members/roles manage | M | limited | - | - | - | - |
| Products read/manage | M | M | R | R | R | R |
| Inventory read | M | M | R | M | R | R |
| Inventory adjust | M | M | - | X | - | - |
| Orders read | M | M | R | R | R | - |
| Orders status/cancel | M | M | X | X | X | - |
| Customers read | M | M | R | - | R | R |
| Customer merge | M | M | - | - | - | - |
| Channels connect/disconnect/sync | M | M | - | - | - | - |
| Livestream manage | M | M | X | - | - | R |
| Analytics/financial read | M | M | - | - | - | R |
| Audit read | M | M | - | - | - | - |

**REQUIRES BUSINESS DECISION:** exact role-to-permission mapping, finance visibility, role customization, ownership transfer, invitation/removal, and whether `Staff` may mutate orders.

## 5. Business Domain

### Confirmed rules

- Every business entity belongs to one Store; access requires valid membership.
- External IDs are not globally unique. External orders are identified by Store + Channel Account + External Order ID.
- SKU is unique within Store.
- Product archive cannot remove historical order visibility.
- Inventory mutations create transactions; adjustments require actor and reason.
- Reservations are atomic; duplicate events and releases cannot produce duplicate stock effects.
- Order transitions are constrained and every transition has history.
- Payment history is immutable; refunds are bounded by paid amount and idempotent.
- Channel credentials are isolated per Channel Account; external failures must not corrupt valid internal data.
- Webhooks require verification, deduplication and replay protection.
- Money is exact, currency-bearing and deterministically rounded; backend timestamps are UTC and date filters use Store timezone.

### Inferred architectural rules

- Internal normalized records are the source for operational reads and cross-channel behavior.
- Vendor payloads should remain inside Integration adapters.
- Realtime should propagate changes, while refetch/read APIs remain authoritative.
- Critical mutation audit should be append-only or otherwise tamper-evident.

## 6. Entity Model

The following entities have explicit support in the specifications or technical entity list. Attributes below are core attributes only; complete schema is **MISSING**.

| Entity | Purpose / core attributes | Relationships / lifecycle | Ownership / source of truth |
|---|---|---|---|
| Store | Business workspace; name, timezone, currency, status | Owns all business data; active/deactivated; no MVP hard delete | Store; internal DB |
| User | Authenticated person; email, password credential state, account status | Has memberships; session lifecycle | Identity module; internal DB |
| StoreMember | User-Store access and role | Pending/active/revoked lifecycle is incomplete | Store membership; internal DB |
| Role | Named access grouping | Assigned to memberships; management rules incomplete | Access module; internal DB |
| Permission | Resource/action capability | Mapped to roles | Access module; internal DB |
| Product | Internal product identity; name, description, status | Has variants; active/archived | Product Catalog; internal DB |
| Variant/SKU | Sellable inventory unit; SKU, price, cost | Belongs to Product; maps to channels | Product Catalog; internal DB |
| Category | Product grouping | Navigation shows it; CRUD and MVP status missing | Product Catalog; **REQUIRES DECISION** |
| Channel | External platform type | TikTok/Shopee confirmed; Website conflict | Integration definition; external platform |
| ChannelAccount | Connected shop account and state | Store-owned; disconnected/connecting/connected/syncing/auth-expired/error | Channel module; internal connection state |
| ChannelCredential | Protected external credentials | Rotated/expired/revoked lifecycle incomplete | Channel module; protected secret store/DB reference |
| ChannelProductMapping | Internal SKU to external product/SKU | Mapping conflict/deletion states missing | Integration mapping; internal DB |
| InventoryBalance | Physical, reserved and available stock | Adjusted/reserved/deducted/reconciled behavior partly specified | Inventory module; internal DB |
| InventoryReservation | Stock held for an order/operation | Created/released; expiry missing | Inventory module; internal DB |
| InventoryTransaction | Immutable stock movement; delta, before/after, reason, actor, source | Append-only history | Inventory module; internal DB |
| Order | Normalized sale; channel/account IDs, customer, totals, statuses | PENDING through COMPLETED plus exception states | Order module; internal DB after normalization |
| OrderItem | Historical item snapshot; SKU/name/price/quantity | Belongs to Order; immutable historical values | Order module; internal DB |
| OrderStatusHistory | Transition audit | Append-only per Order | Order module; internal DB |
| Payment | Payment status and amount/currency | Linked to Order; payment event history needed | Payment module; trusted event/channel state |
| Refund | Refund amount/quantity and references | Linked to Order/Payment; idempotent, partial/refunded states | Payment module; internal DB after validation |
| Customer | Normalized customer profile | Channel mappings, orders; merge policy missing | Customer module; internal DB |
| Livestream | Live session; title, account, start/end, state | DRAFT -> SCHEDULED -> LIVE -> ENDED or CANCELLED | Livestream module; internal DB/channel |
| LivestreamProduct | Products associated with session | Linked to Livestream and Product/Variant | Livestream module; internal DB |
| LivestreamMetric | Viewers, orders, GMV, units, conversion, AOV | Live updates then final history; source/frequency missing | Analytics/live provider; **REQUIRES DECISION** |
| SyncJob | Sync type, progress, status, failure/retry | Initial/incremental/manual/webhook/recovery | Integration module; internal DB/queue |
| WebhookEvent | Verified external event identity/payload metadata | Received, deduplicated, processed/failed; retention missing | Integration module; internal DB |
| Notification | In-app operational alert and delivery/read state | New order, low stock, sync/auth/integration; read lifecycle missing | Notification module; internal DB |
| AuditLog | Actor/action/resource/before/after/time | Append-only; retention/redaction missing | Audit module; internal DB |

**REQUIRES DECISION:** category, payment event, attribution and security-event entities may be modeled separately or as records within the owning context; no schema implementation should start before this is approved.

## 7. Business Workflows

Only specified states are used below. Where transitions are incomplete, the gap is explicitly marked.

### Store setup

`Login -> create/select Store -> connect TikTok -> connect Shopee -> sync products -> check inventory -> ready`

### Order

`PENDING -> CONFIRMED -> PROCESSING -> PACKED -> SHIPPED -> DELIVERED -> COMPLETED`

Exception states: `CANCELLED`, `FAILED`, `RETURNED`, `REFUNDED`.

Confirmed allowed examples: PENDING->CONFIRMED/CANCELLED; CONFIRMED->PROCESSING and conditional CANCELLED; PROCESSING->PACKED and conditional CANCELLED; PACKED->SHIPPED; SHIPPED->DELIVERED; DELIVERED->COMPLETED. All channel-specific mappings and cancellation conditions are **MISSING**.

### Inventory

`Physical Stock - Reserved Stock = Available Stock`; reservation and release are atomic and idempotent. Exact deducted/adjusted lifecycle and refund/return restoration are **MISSING**.

### Livestream

`DRAFT -> SCHEDULED -> LIVE -> ENDED`; `CANCELLED` is an exception. Start requires a connected channel and valid products. Metric source, sampling, failed-start transitions and attribution are **MISSING**.

### Channel and synchronization

Channel states: `DISCONNECTED`, `CONNECTING`, `CONNECTED`, `SYNCING`, `AUTH_EXPIRED`, `ERROR`. Sync types: initial, incremental, manual, webhook-driven, recovery. Retry/backoff, partial success, progress and dead-letter behavior are confirmed at principle level; exact policies are **MISSING**.

### Payment/refund

Payment states: `UNPAID`, `PENDING`, `PAID`, `FAILED`, `PARTIALLY_REFUNDED`, `REFUNDED`. Refund is idempotent, cannot exceed payment, and stock restoration depends on actual returned-item condition. The return inspection lifecycle is **MISSING**.

## 8. Data Flow

### External-to-internal flow

```text
Channel API/webhook
  -> verify account/signature/replay
  -> validate and deduplicate
  -> adapter mapping/normalization
  -> queue when asynchronous
  -> application service
  -> transaction with Order/Inventory/Payment as required
  -> durable event publication
  -> notification/realtime/read-model consumers
  -> frontend refetches authoritative API state
```

### Source of truth

| Data | Authoritative source |
|---|---|
| Normalized operational records | Internal PostgreSQL, CONFIRMED by technical/business direction |
| External channel state | External platform, imported and mapped internally |
| Inventory used by internal operations | Internal inventory, CONFIRMED; allocation strategy missing |
| Dashboard aggregates | Internal operational data or read model, recommendation; freshness/rebuild missing |
| Realtime event | Delivery signal, not authoritative state, recommendation |

The technical specification suggests a queue and domain events. Whether an outbox is mandatory for reliable publication is **REQUIRES TECHNICAL DECISION**, not confirmed.

## 9. Frontend Architecture

- Application shell owns authentication boundary, active Store, navigation, route layout and global connection state.
- Feature boundaries: auth, store, dashboard, orders, products, inventory, customers, channels, livestream and analytics.
- Shared design system needs shell, navigation, cards, table, form, modal, toast, badge, date selector and loading/empty/error states.
- Server state should use TanStack Query or equivalent; form state can use React Hook Form/Zod; local UI state remains local; Zustand only for justified cross-feature state.
- API client must centralize auth, Store context, typed errors, pagination and request IDs.
- Realtime handlers should invalidate or narrowly patch cached queries and refetch after reconnect.
- Permission-aware UI may hide/disable actions but backend checks every protected request.
- Large datasets require server pagination/filter/sort and measured virtualization.

**MISSING UX specification:** responsive behavior, accessibility, keyboard/focus rules, exact loading/empty/error/permission-denied states, stale-data indicators, mobile scope, and interaction contracts.

## 10. Backend Architecture

Recommended module layering, without implementation:

`Transport/controller -> DTO/validation -> application use case -> domain policy/state machine -> repository/adapter infrastructure`

Backend responsibilities:

- Enforce Store scope and permission on every protected operation.
- Keep vendor objects inside Integration adapters.
- Enforce validation, state transitions, transactions, idempotency and audit.
- Run sync, webhook processing, retries, notifications, aggregation and large exports as observable jobs.
- Expose stable application interfaces between Order, Inventory, Payment, Channel and Analytics.
- Return a consistent error envelope with code, message and request ID.

## 11. Database Architecture

**Confirmed candidate:** PostgreSQL transactional database with foreign keys, unique constraints, indexes, UTC timestamps, exact money representation and historical snapshots.

Required constraints include Store-scoped SKU uniqueness, Store + Channel Account + external order uniqueness, webhook/event idempotency, non-negative inventory, immutable payment/order history where required, and Store isolation.

**REQUIRES TECHNICAL DECISION:** tenant key placement, membership lifecycle constraints, reservation expiry/reconciliation, inventory locking strategy, refund allocation, category/mapping states, audit retention/redaction, aggregate read models, outbox, backup/restore and disaster recovery targets.

No schema or migration is created in this phase.

## 12. API Architecture

**Confirmed direction:** `/api/v1`, resource-oriented APIs, success envelope with pagination and error envelope containing code/message/request ID.

| Resource | Method / purpose | Auth and action |
|---|---|---|
| Session | POST login/logout; session status | Public login; authenticated logout/status |
| Stores | GET/POST; select active Store | Membership; create/manage permission |
| Members/Roles | GET/POST/PATCH | members/roles permissions |
| Products/Variants | GET/POST/PATCH; archive action | products read/create/update/archive |
| Inventory | GET; POST adjustment; history | inventory read/adjust/history |
| Orders | GET list/detail; transition/cancel | orders read/update/cancel |
| Customers | GET list/detail; merge action | customers read/merge |
| Channels | GET; connect/callback/disconnect/sync | channel permissions; OAuth callback contract |
| Webhooks | Channel-specific ingress | Verified external signature, no user session assumption |
| Livestream | GET/POST; start/end; metrics | livestream permissions; P1 unless promoted |
| Dashboard/Analytics | GET summary/trends/performance | analytics/finance permissions |
| Notifications/Audit | GET and read-state/audit queries | notification/audit permissions |

Before implementation, every endpoint needs field schema/nullability, Store scope source, pagination/filter/sort grammar, max limits, error codes, idempotency key, concurrency response, date/currency serialization, rate limit and versioning policy.

## 13. Realtime Architecture

Confirmed event candidates from the technical specification: `order.created`, `order.updated`, `inventory.updated`, `livestream.metric.updated`, `notification.created`, `sync.failed`.

| Event | Producer | Consumer / purpose | Delivery requirement |
|---|---|---|---|
| order.created/updated | Order/import | Dashboard, orders, notifications | Store-authorized, deduplicated, resync |
| inventory.updated | Inventory | Inventory/dashboard/channel sync | Preserve authoritative balance |
| livestream.metric.updated | Livestream/integration | Live dashboard/control room | Frequency and source missing |
| notification.created | Notification producers | In-app notification UI | Read state missing |
| sync.failed | Sync worker | Channel status/alerts | Retry and failure detail |

WebSocket versus SSE is **REQUIRES TECHNICAL DECISION**. Regardless of transport: authorize connection/subscription by Store, include event identity/version or cursor, reconnect with backoff, refetch authoritative state after missed events, handle duplicates/out-of-order delivery, and define fallback polling. The `<1s` target is a goal, not yet a measured SLA.

## 14. External Integrations

| Integration | Confirmed | Missing before implementation |
|---|---|---|
| TikTok Shop | OAuth connection, product/order sync, webhook, inventory synchronization in principle | API/region/version, scopes, token lifecycle, field/status mapping, webhook contract, rate limits, sandbox, reconciliation |
| Shopee | Same functional integration direction as TikTok | Same vendor contract details |
| Website/other channel | Visible in image only | Whether MVP channel, API, ownership and priority; do not implement by assumption |
| Payment provider | Payment/refund domain rules exist; provider not named | Provider, webhook/API, source of trusted payment state |
| Shipping provider | Shipping appears as order data; provider not named | Provider, fulfillment contract, tracking and status source |

Every channel needs an integration dossier covering authentication, API, webhook verification/replay, mapping, rate limits, retries, reconciliation, PII and test credentials. No external behavior may be assumed.

## 15. Authentication & Authorization

Confirmed: email/password login, session creation/invalidation, expiration handling, generic failed-login response, rate limiting, server-side permission checks, secure browser cookie direction, HttpOnly, SameSite, CSRF protection and Store membership isolation.

**REQUIRES DECISION:** server-side session versus signed access/refresh tokens, lifetimes/rotation/revocation, password reset/email verification, MFA, invitation acceptance, OAuth state/PKCE, session invalidation after membership changes, encryption/key rotation and security-event retention.

Authorization flow:

`Authenticated user -> active Store membership -> permission -> Store-scoped resource -> action`

## 16. Security

Requirements: IDOR/cross-Store protection, broken access control prevention, input validation, XSS/CSRF/SQL injection protection, webhook signature and replay protection, brute-force/rate-limit controls, SSRF protection where URLs are accepted, secret isolation, encrypted external credentials at rest where appropriate, PII minimization and audit of critical mutations.

**MISSING:** PII retention/deletion/anonymization, password policy, MFA policy, key provider/rotation, audit immutability/retention, incident response, data export/access procedures and exact rate limits.

## 17. Testing Strategy

| Level | Required coverage | Traceability |
|---|---|---|
| Unit/domain | Order transition matrix, inventory invariant/concurrency policy, payment/refund, money/time, normalization, idempotency | BUS rules -> requirements |
| Integration | DB constraints/rollback, reservation races, duplicate webhooks/orders, queue retry/DLQ, credential boundary | Edge cases -> technical design |
| API/security | Contract envelopes, Store IDOR, RBAC matrix, auth expiry/rate limiting, CSRF/XSS/injection, webhook forgery/replay | Requirements -> acceptance |
| Component | Forms, filters, loading/empty/error/denied states and permission-aware actions | Functional/UI requirements |
| E2E | Login, Store switch, product, inventory, order/cancel, channel connect, dashboard date filter | Acceptance criteria |
| Realtime | Authorization, reconnect, missed events, duplicate/order behavior, fallback | Realtime requirements |
| Performance/visual | API p95, dashboard load, 100k+ orders, sync batches, realtime latency, visual regression against supplied image | NFR and visual source |

Every implemented requirement must trace `Business Rule -> Requirement -> Design -> Edge Case -> Acceptance -> Task -> Automated Test`.

## 18. Infrastructure

Recommendation only: local Docker-based PostgreSQL/Redis, separate local/test/staging/production environments, web/API/worker runtime separation, managed PostgreSQL with backups and restore tests, Redis suitable for queues, secret manager, TLS/OAuth callback configuration, structured logs/request IDs, error tracking, queue and sync metrics, CI gates (install/lint/typecheck/unit/integration/build/critical E2E), rollback-compatible migrations and DR monitoring.

**MISSING/REQUIRES DECISION:** hosting for API/workers, Vercel compatibility with realtime/long-running workers, DB/Redis provider and region, availability/RPO/RTO, email/notification provider, observability provider/ownership, retention and incident operations. No infrastructure is created in this phase.

## 19. Dashboard UI Mapping

The supplied image shows a desktop dense operations dashboard. It is treated as visual source of truth; this report does not redesign it.

| UI section | Purpose / interaction | Data and API requirement | Permission / realtime |
|---|---|---|---|
| App shell/sidebar | Navigate Dashboard, Sales, Products, Channels, Analytics, Administration, Settings/Help | Route availability and active Store context | Permission-filtered; realtime status indicator |
| Header | Store breadcrumb, user menu, connection status | Store/session summary; `GET` session/store context | Authenticated; connection health |
| Date filter/refresh | Select 7 days and refresh data | Dashboard query by Store timezone; refresh/cache semantics missing | analytics/finance read; realtime plus manual refresh |
| KPI cards | Net Revenue, GMV, Orders, AOV, Conversion, Refund | Dashboard summary endpoint and exact formulas | Finance/analytics permission; freshness missing |
| Revenue performance | Trend with Revenue/GMV/Orders tabs | Time buckets, date range, aggregation/read model | analytics/finance; refresh/realtime policy missing |
| Live Commerce card | Current stream, viewers, orders, live GMV/conversion, product/control-room actions | Livestream summary/metrics and deep-link APIs | Livestream permission; P1 conflict; realtime |
| Recent orders | Search and order table with channel, livestream, value/status/time | Orders list with pagination/filter/sort and live updates | orders.read; order.created/updated |
| Channel performance | Channel share, orders and value | Channel analytics aggregate | analytics/finance; Website scope conflict |
| Live performance | Viewers/orders/GMV trends and tabs | Livestream metric series | livestream/analytics; metric source/frequency missing |
| Top products | Revenue, units sold, stock ranking | Product analytics plus inventory read | analytics and possibly inventory; ranking rule missing |
| Badges/notifications | Counts for orders, low stock, integration errors | Notification and operational count queries | Resource-specific permissions; count/read semantics missing |
| Live control-room banner | Shortcut to active livestream | Active livestream and route/empty behavior | livestream permission; behavior with no live session missing |

The image does not specify loading, empty, error, permission denied, stale data, responsive, accessibility, keyboard, mobile, offline or interaction confirmation states. These must be added to the implementation specification before UI coding.

## 20. Requirement Conflicts

| ID | Conflict |
|---|---|
| CONFLICT-001 | Livestream is P1 in product/MVP scope but occupies a prominent dashboard card, chart and control-room CTA in the visual source. |
| CONFLICT-002 | MVP names TikTok Shop and Shopee, while the image shows Website in recent orders and channel performance. |
| CONFLICT-003 | Dashboard is P0/basic but GMV and Revenue are explicitly unresolved; the image presents them as primary KPIs. |
| CONFLICT-004 | Navigation includes Categories, but category entity/requirements/MVP priority are not defined. |
| CONFLICT-005 | Technical entity list includes livestream metrics, but its source, retention and aggregation are not defined. |

## 21. Missing Requirements

### Product/business

- Multi-Store ownership, ownership transfer, invitations, membership removal and deactivation behavior.
- Inventory global versus channel allocation and conflict reconciliation.
- GMV, Revenue, AOV, conversion and refund formulas, including cancelled/refunded orders, discounts, shipping, tax and fees.
- Cancellation conditions per order state and channel.
- Refund/return inspection and stock restoration.
- Customer matching, merge conflict handling, reversibility and privacy lifecycle.
- Livestream and multi-source order attribution.
- Supported currency list and currency change policy.

### UX/product design

- Responsive/mobile scope, accessibility, loading/empty/error/denied states, stale data and offline behavior.
- Exact dashboard refresh/freshness and comparison-period behavior.
- Notification read state, sidebar badge definitions and control-room empty behavior.

### Technical/operational

- Complete API and data specification.
- Channel vendor contracts and sandbox credentials.
- Auth/session, realtime transport, outbox, queue/DLQ, analytics read model and deployment ADRs.
- Backup/restore, RPO/RTO, PII retention and incident response.

## 22. Decision Register

| ID | Decision | Type | Current state | Options | Recommendation | Owner |
|---|---|---|---|---|---|---|
| DEC-001 | MVP channel scope | PRODUCT | Website visible but not listed in MVP | TikTok+Shopee / add Website | Keep TikTok+Shopee; mark Website future until contract exists | Product |
| DEC-002 | Livestream priority | PRODUCT | P1 text, first-class visual | P1 / promote P0 | Decide explicitly; do not let image silently change scope | Product |
| DEC-003 | Inventory allocation | BUSINESS | Global vs channel allocation open | Global / allocation | Choose after channel stock semantics review; global is simpler MVP candidate | Business |
| DEC-004 | Financial formulas | BUSINESS | GMV/Revenue proposed only | Define status, fee, tax, shipping, discount treatment | Approve formulas before analytics/dashboard implementation | Business/Finance |
| DEC-005 | Multi-Store ownership | BUSINESS | Multi-Store membership possible; ownership open | Single owner / multiple ownership | Define ownership, transfer, invite and removal lifecycle | Product/Business |
| DEC-006 | RBAC matrix | SECURITY | Roles named; mapping incomplete | Fixed matrix / customizable roles | Approve explicit resource-action matrix, especially finance | Owner/Security |
| DEC-007 | Category scope | PRODUCT | Navigation shows category | MVP / future | Exclude from MVP unless CRUD and rules are specified | Product |
| DEC-008 | Auth model | SECURITY | Secure cookie direction; final model open | Server session / access-refresh tokens | Choose based on deployment and revocation needs; record ADR | Engineering/Security |
| DEC-009 | Realtime transport | TECHNICAL | WebSocket or SSE | WebSocket / SSE / polling fallback | Evaluate bidirectionality, hosting and scale; record ADR | Engineering |
| DEC-010 | Event publication consistency | TECHNICAL | Domain events suggested; guarantee open | Outbox / equivalent / best effort | Use outbox or equivalent for committed critical effects | Engineering |
| DEC-011 | Monorepo/framework | TECHNICAL | Stack proposed; tool/framework not final | Next/React + Node/Nest or equivalent | Approve stack/tool before repository creation | Engineering |
| DEC-012 | Analytics read model | TECHNICAL | Aggregate/read model suggested | Live queries / materialized/read model | Define freshness and rebuild SLA, then choose | Engineering/Data |
| DEC-013 | External channel contracts | TECHNICAL | Vendors named, contracts absent | Vendor dossiers | Complete and approve TikTok/Shopee dossiers | Integration owner |
| DEC-014 | Hosting and DR | INFRASTRUCTURE | Docker/GitHub Actions/Vercel suggested | Deployment topologies | Select topology compatible with workers/realtime; define RPO/RTO | Engineering/Operations |
| DEC-015 | PII and audit retention | SECURITY | Protection principle only | Retention/redaction policies | Approve data classification and retention before production data | Security/Legal |

Current states in this register are **Proposed** or **Requires Decision** unless explicitly labelled confirmed in the sections above. No decision is silently treated as confirmed.

## 23. Implementation Readiness

### Verdict

- **Architecture:** Directionally ready. Modular monolith and major context boundaries are sufficiently clear.
- **Implementation:** **BLOCKED** for production implementation of financial analytics, integrations, livestream, inventory allocation and final authorization behavior.
- **Optional:** Foundation design, API/data contract drafting, ADR drafting, traceability matrix and visual state specification can proceed without application code.

### Checklist

#### Product

- [ ] Scope, including Website and Livestream priority
- [ ] Business rules and financial formulas
- [ ] User roles and membership lifecycle
- [ ] Complete permission matrix

#### UX

- [x] Dashboard visual direction exists
- [ ] Loading, empty, error and permission-denied states
- [ ] Responsive/mobile behavior
- [ ] Design system and accessibility specification

#### Technical

- [x] High-level modular architecture
- [ ] Database/data specification and concurrency policy
- [ ] Complete API contracts
- [ ] Realtime transport and delivery/resync contract
- [ ] Final authentication/session strategy

#### Infrastructure

- [ ] Local environment decision
- [ ] CI/CD topology
- [ ] Deployment/hosting
- [ ] Backup, restore, monitoring, secrets and DR

## 24. Recommended Implementation Order

This is dependency order, not a request to begin coding:

1. Approve product/business decisions DEC-001 through DEC-007 and complete the traceability matrix.
2. Approve technical/security/infrastructure ADRs DEC-008 through DEC-015.
3. Specify API contracts, data model, event naming, permission matrix and integration dossiers.
4. Establish repository/environment/CI/database/queue/observability foundation.
5. Define application shell, design-system primitives and all standard UI states from the visual source.
6. Implement authentication, Store membership/switching, RBAC and audit infrastructure.
7. Implement Product, Variant/SKU, approved category scope and archive behavior.
8. Implement Inventory ledger, atomic adjustment, reservation/release, conflict policy and low-stock notification.
9. Implement Order state machine, immutable item snapshots, payment/refund, cancellation and inventory integration.
10. Implement Channel abstraction and one provider end-to-end with OAuth, sync, webhook, retries and reconciliation.
11. Add the second provider after the adapter contract is validated.
12. Add durable event publication, realtime authorization, reconnect and authoritative resync.
13. Implement dashboard aggregates and widgets only after metric formulas and freshness are approved.
14. Implement Livestream/live metrics according to the approved priority and attribution rules.
15. Complete advanced analytics, exports, security review, load tests, DR verification and deployment hardening.

Do not start with dashboard calculations or channel-specific UI shortcuts. The highest-risk dependencies are Store isolation, RBAC, inventory concurrency, order idempotency, payment/refund correctness and metric definitions.

## Final Checkpoint

### What is established

- Product scope direction, Store boundary, major actors, core contexts, normalized model principle, key invariants, integration principles, testing categories and dashboard information architecture.

### What remains missing

- Approved business formulas/policies, complete RBAC, channel contracts, API/data contracts, UX states, auth/realtime/event decisions and production operations policy.

### Decisions for review

- DEC-001 through DEC-015, prioritizing channel scope, Livestream priority, inventory allocation, financial definitions and permission matrix.

### Existing assumptions

- Modular monolith, PostgreSQL, Redis/queue and feature-oriented frontend are recommendations aligned with the technical specification, not all final ADRs.
- Image analysis uses `commerce-control-center-preview.png` because the requested `dashboard-reference.png` is absent.
- The provided image is desktop visual guidance; it does not approve any missing mobile, accessibility or state behavior.

### Blockers

- Unresolved business decisions and missing external/API/data contracts listed above.

### Next phase proposal

After review and approval, run a dedicated requirements/decision closure phase: resolve P0 decisions, produce approved API/data/event specifications and ADRs, update this report, then create an implementation plan. Stop here until the user reviews and approves the checkpoint.
