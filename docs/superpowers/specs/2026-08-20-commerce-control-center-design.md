# Commerce Control Center Architectural Design

## Status

Approved in brainstorming review. This document records the architectural design for discovery Phase 0. It does not scaffold or implement the project.

## Source of Truth

- `docs/01-product-spec.md`
- `docs/02-business-spec.md`
- `docs/03-functional-requirements.md`
- `docs/04-technical-spec.md`
- `docs/05-edge-cases.md`
- `docs/06-acceptance-and-development.md`
- `design/commerce-control-center-preview.png`

The requested `design/dashboard-reference.png` was not present. The existing preview image is the visual source used for this design.

## Architectural Approach

Use a modular monolith with independently deployable API and worker processes in one Turborepo + pnpm monorepo.

- Frontend: Next.js and React.
- Backend: NestJS.
- API: versioned REST under `/api/v1`.
- Transactional database: PostgreSQL.
- Cache and queue infrastructure: Redis + BullMQ.
- MVP dashboard freshness: polling; realtime gateway is deferred.
- Deployment: managed cloud, provider to be selected later.

This approach preserves transaction boundaries for order and inventory invariants while allowing workers and analytics workloads to scale independently before any domain is extracted into a service.

## Product Architecture

### Bounded Contexts

- Identity & Auth: users, credentials, sessions, invitations and password reset.
- Store & Membership: stores, memberships and active Store context.
- Authorization: fixed MVP roles, permission catalog and policy evaluation.
- Catalog: products, variants, SKUs, categories and channel mappings.
- Inventory: physical stock, reserved stock, available stock, reservations, transactions and safety buffers.
- Orders: orders, items, state machine and status history.
- Payments & Refunds: payment state/history and refund state/history.
- Customers: normalized customers, channel identities, merge suggestions and merge audit.
- Channels: Channel Accounts, connection state and credential lifecycle.
- Integrations & Sync: TikTok/Shopee adapters, Website event adapter, webhook events, jobs and normalization.
- Livestream: livestreams, active sessions and attribution metadata.
- Analytics & Dashboard: metric definitions, aggregation jobs and read models.
- Notifications: notification records and delivery state.
- Audit: immutable audit records and audit queries.

### Actors and Authorization

MVP roles are Owner, Admin, Staff, Warehouse, Customer Support and Analyst. A user may belong to multiple Stores and has a separate role per Store. Custom roles are deferred.

Authorization flow:

```text
Authenticated User -> Store Membership -> Fixed Role -> Permission -> Resource Scope -> Action
```

The backend is authoritative. Dashboard shell requires `dashboard.read`; financial and livestream widgets require their dedicated permissions. Resource IDs never establish ownership.

Every business entity and background job is Store-scoped. Failed cross-Store authorization must not leak resource metadata.

## Domain Model and Invariants

### Inventory

- Global Stock is the business model.
- `Available Stock = Physical Stock - Reserved Stock`.
- Available Stock cannot be negative.
- Safety buffer defaults at Store level and can be overridden per SKU/Variant.
- Channel publication uses `Available Stock - Effective Safety Buffer`.
- Manual adjustments change Internal Inventory and create transaction, audit record and event.
- External order events create or release reservations.
- External inventory sync cannot silently overwrite a manual adjustment.
- Reservation, release and sync operations are atomic and idempotent.

### Orders and Payments

External order identity is `Store + Channel Account + External Order ID`.

Order states follow the specified state machine from `PENDING` through `COMPLETED`, with `CANCELLED`, `FAILED`, `RETURNED` and `REFUNDED` exception states. Payment state is independent; an Order may become `COMPLETED` while Payment is not `PAID`.

Historical order item prices are immutable. Valid transitions create status history. Cancellation releases reservation exactly once. Payment and refund events are trusted, validated and idempotent.

### Metrics

```text
GMV: orders from CONFIRMED onward, excluding orders cancelled before CONFIRMED
Revenue: Gross Sales - Discounts - Refunds
Revenue recognition: when Order becomes COMPLETED
Refund recognition: in the period when the refund occurs
```

Shipping, platform fees and tax are not deducted in the MVP definitions.

### Customers and Livestreams

Customer matching creates a possible-match suggestion; an operator must confirm a merge. Merge is audited and never removes historical order data.

Livestream attribution prefers an explicit channel livestream identifier. If absent, a time-based fallback may be used and must retain attribution confidence. MVP includes active livestream snapshot and control-room shortcut; full realtime metrics/control-room functionality is deferred.

## Runtime Architecture

### Frontend

Feature boundaries include auth, dashboard, orders, products, inventory, customers, channels, livestream and analytics. TanStack Query manages server state. Large datasets use server pagination. Permission, loading, empty and error states are explicit per feature/widget.

### Backend

NestJS modules use controller, application, domain, infrastructure and DTO boundaries. Controllers validate and delegate. Application services orchestrate use cases. Domain code protects invariants. Infrastructure implements repositories, queue ports and external adapters.

Orders call Inventory application interfaces and never update Inventory tables directly. Integration vendor objects are normalized before entering core domain services. Analytics reads reporting projections rather than performing expensive aggregation over operational tables per request.

### Data and API

PostgreSQL is the normalized transactional source. It uses foreign keys, Store-scoped constraints, query-pattern indexes, UTC timestamps, exact money representation and immutable historical snapshots.

REST endpoints are versioned under `/api/v1`, use consistent data/pagination envelopes and structured errors with code, message and request ID. Store context comes from authenticated membership, not arbitrary client input.

### Jobs

BullMQ handles initial/incremental/manual/recovery sync, webhook processing, retries, inventory publication, payment processing, notifications, analytics aggregation and large exports. Jobs carry Store and Channel Account scope, deterministic identity, retry/backoff policy, failure state and dead-letter handling.

### Dashboard Freshness

Dashboard metrics are served from analytics read models and queried through REST. MVP uses polling with `computedAt`, `lastSourceEventAt` and `isStale` metadata. On failure, the UI keeps the last valid data and exposes stale/error state. The server remains authoritative.

## Dashboard Mapping

The visual reference defines the shell, sidebar, header, KPI cards, revenue chart, Live Commerce card, Recent Orders, Channel Performance, Live Performance, Top Products, realtime status and live control shortcut. It defines visual intent, not unapproved business rules.

| Section | Data/API | Business and permission boundary |
|---|---|---|
| Shell/header/sidebar | Session, Store context, capabilities, notifications | Store membership and module permissions |
| KPI cards | `/dashboard/summary` | GMV/Revenue definitions; financial permission |
| Revenue chart | `/dashboard/revenue-series` | Store timezone and metric definition; financial permission |
| Live Commerce | `/dashboard/active-livestream` | Active session snapshot; livestream read permission |
| Recent Orders | Paginated `/orders` query | Order read permission and Store scope |
| Channel Performance | `/dashboard/channel-performance` | Channel analytics and financial permission |
| Live Performance | `/dashboard/live-performance` | Polling snapshot; livestream analytics permission |
| Top Products | `/dashboard/top-products` | Product/analytics read permission |
| Realtime indicator | Freshness metadata and polling state | No claim of realtime gateway in MVP |
| Control-room shortcut | Active livestream route/resource | `livestream.control` permission |

Date filters are today, yesterday, 7 days, 30 days and custom. Backend applies boundaries in Store timezone and stores timestamps in UTC.

## Security, Testing and Operations

Authentication uses email/password, secure cookie session identifier, PostgreSQL session records, invitation and password reset. CSRF protection, rate limiting, secure headers, input validation, secret protection, webhook signature/replay protection and PII masking are required.

Audit is mandatory for role/permission changes, product mutation, inventory adjustment, order mutation, refund, channel connection, manual sync, Store settings, customer merge, safety-buffer changes and PII anonymization.

Testing includes unit, application integration, database/constraint, adapter contract, API integration, frontend component, E2E, security, concurrency, performance and recovery tests. Critical behavior traces from business rule through automated test.

Managed-cloud topology separates frontend, stateless API and worker services, with managed PostgreSQL, Redis, secret management, object storage, backups, staging/production environments, health checks and rollback strategy. Observability covers request IDs, API/DB latency, queue state, sync/webhook failures, authentication failures, dashboard freshness and inventory discrepancies.

## Deferred Decisions

- Payment provider selection.
- TikTok and Shopee API/webhook contract details.
- Managed-cloud provider.
- ORM and migration tool.
- Exact polling intervals.
- Exact fixed-role permission matrix.
- Dashboard read-model schema.
- Safety-buffer defaults and channel quantity limits.
- PII retention duration.
- Backup RPO/RTO.
- Full livestream control-room requirements.

These decisions must be resolved in the implementation plan or ADRs before they become blocking schema/API work.

## Scope Exclusions

The initial implementation does not include custom roles, MFA, social login, full realtime gateway, full livestream metrics, AI analytics, advanced promotion, customer segmentation or additional external channels.
