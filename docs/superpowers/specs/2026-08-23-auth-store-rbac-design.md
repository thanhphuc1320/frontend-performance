# Authentication, Store Membership & RBAC Architectural Design

## Status

Approved in brainstorming review. This document defines the next subsystem after Phase 0 Foundation. It is a design specification only; it does not implement authentication, database schema or API behavior.

## Scope

This subsystem includes:

- Self-registration and email verification.
- Password policy and account recovery.
- PostgreSQL-backed sessions with secure cookies.
- Global User identity.
- First Store onboarding.
- Multi-Store memberships.
- Invitation lifecycle.
- Fixed-role RBAC.
- Store isolation and authorization enforcement.
- Auth, Store and membership audit events.

It excludes custom roles, MFA, social login, business-domain authorization and operational modules such as Products, Orders and Inventory.

## Source of Truth

- `docs/01-product-spec.md`
- `docs/02-business-spec.md`
- `docs/03-functional-requirements.md`
- `docs/04-technical-spec.md`
- `docs/05-edge-cases.md`
- `docs/06-acceptance-and-development.md`
- `docs/superpowers/specs/2026-08-20-commerce-control-center-design.md`

## Approved Decisions

- Self-registration is enabled.
- Email verification is required before Store creation or application use.
- The verified User creates the first Store and becomes Owner.
- Passwords require at least 12 characters; common/compromised passwords are rejected.
- Session idle timeout is 24 hours; absolute lifetime is 30 days.
- Invitation tokens expire after 7 days and support resend/revoke.
- Members may leave a Store; the final Owner cannot be removed.
- Fixed-role permission matrix is proposed by this design; custom roles are deferred.
- Only Owner can deactivate/reactivate a Store.
- Login is rate-limited, temporary lockout is used, and password reset/email change require email verification.
- User is a global identity; email is trimmed and lowercased; uniqueness is global.
- Authentication is implemented in-house in the NestJS modular monolith.
- Sessions are stored in PostgreSQL and cookies contain only opaque session identifiers.

## Architecture

### Contexts

- Identity & Auth owns User, credentials, sessions, verification/recovery tokens and auth lifecycle.
- Store & Membership owns Store, membership, onboarding and invitations.
- Authorization owns fixed roles, permission catalog and policy evaluation.
- Audit owns immutable records for auth, Store and membership mutations.
- Email delivery is an outbound port used by Auth and Membership; the provider is replaceable.

### Request Authorization

```text
Cookie Session ID
→ Session
→ Global User
→ Active Store Membership
→ Fixed Role
→ Permission
→ Store-scoped Resource
→ Action
```

The backend is authoritative at the controller boundary and again in application services for critical mutations. A resource ID never proves ownership. Cross-Store failures do not reveal resource metadata.

## Identity & Authentication

### User

The global User record contains normalized email, password hash, account status, email verification timestamp, failed-login counters, temporary lock timestamp and lifecycle timestamps.

Statuses are `UNVERIFIED`, `ACTIVE`, `TEMPORARILY_LOCKED` and `DISABLED`.

Email normalization is trim plus lowercase. One normalized email maps to one global User. A User may have memberships in multiple Stores.

### Registration

```text
Register email/password
→ Normalize and validate
→ Create UNVERIFIED User
→ Generate hashed verification token
→ Send verification email
→ Consume single-use token
→ Activate User
→ Create first Store
→ Create Owner membership
→ Create session
```

A User cannot create a Store before email verification. Public flows use generic responses so they do not reveal whether an email exists.

### Password and Recovery

- Password minimum is 12 characters.
- Passwords are stored only as adaptive password hashes.
- Common and compromised passwords are rejected.
- Password reset tokens are hashed, single-use and expiring.
- Resetting a password revokes existing sessions according to the security policy.
- Email changes require verification of the new address before changing the global identity.
- Verification, reset and email-change URLs are never logged.

The exact hash algorithm, breach-list provider, token TTL and lockout threshold are ADR-level implementation decisions. They must not weaken the approved policy.

### Login and Session

```text
Credentials
→ Rate-limit check
→ User/status check
→ Password verification
→ Lockout counter update
→ Create PostgreSQL session
→ Set secure cookie
→ Return authenticated context
```

Sessions contain a hash of the opaque identifier, User ID, last activity, absolute expiry, revocation timestamp and safe metadata. Idle timeout is 24 hours; absolute lifetime is 30 days.

Cookies are `HttpOnly`, `Secure` in production, `SameSite` appropriate to deployment and `Path=/`. CSRF protection is required for cookie-authenticated mutations.

Expired or revoked sessions return `401`. Invalid credentials return a generic `401`; rate limiting returns `429`; temporary lockout uses the agreed error convention without exposing sensitive state.

## Store & Membership

### Store

Store contains name, timezone, currency, status, creator and timestamps. Status is `ACTIVE` or `DEACTIVATED`. Store data is never hard-deleted in MVP.

Defaults are `Asia/Ho_Chi_Minh` and `VND`, while the model retains Store-specific values.

Only Owner can deactivate/reactivate. Deactivated Stores reject operational mutations and new invitation acceptance. Historical data and audit records remain available to authorized contexts.

### First Store

```text
Verified User
→ Validate name/timezone/currency
→ Create Store
→ Create Owner membership
→ Set active Store context
→ Create session/application context
```

Store and Owner membership creation are one transaction. Failure rolls back both.

### Membership

Membership statuses are `INVITED`, `ACTIVE`, `SUSPENDED`, `LEFT` and `REMOVED`.

- One membership exists per User/Store pair.
- Role belongs to the membership, not the global User.
- Members can leave voluntarily.
- Authorized Owner/Admin flows can suspend or remove members.
- The final Owner cannot be removed or downgraded.
- Membership history is retained; removal is not hard-delete.

### Invitations

Invitations are Store-scoped and include inviter, normalized email, fixed role, hashed token, status and expiry. Tokens expire after 7 days, are single-use and support resend/revoke.

An existing global User accepts without creating a duplicate User. Acceptance revalidates Store status, invitation state and inviter-issued role. Resend/revoke/accept/expire operations are audited and must not create duplicate memberships.

## RBAC

### Permission Catalog

- `dashboard.read`, `dashboard.financial.read`, `dashboard.livestream.read`, `analytics.read`
- `orders.read`, `orders.update`, `orders.cancel`
- `customers.read`, `customers.merge`
- `products.read`, `products.manage`
- `inventory.read`, `inventory.adjust`
- `channels.read`, `channels.connect`, `channels.sync`
- `livestream.read`, `livestream.control`
- `members.read`, `members.invite`, `members.manage`
- `roles.read`, `audit.read`, `store.settings`, `store.deactivate`

### Fixed Roles

- Owner: all Store permissions.
- Admin: operational, member and configuration permissions; no ownership transfer, final-Owner removal or Store deactivation.
- Staff: basic dashboard, order read/update, product read and customer read.
- Warehouse: inventory read/adjust, order read and fulfillment-scoped order updates; no financial access.
- Customer Support: order and customer read, support-scoped order updates; no financial access.
- Analyst: dashboard, financial dashboard and analytics read; no mutations.

`orders.update` and `members.manage` are policy-scoped actions, not unrestricted access. Frontend capability checks improve UX only; backend permission checks are mandatory.

## Data Model and API Surface

### Data Model

Required tables are `users`, `sessions`, `email_tokens`, `stores`, `store_memberships`, `roles`, `permissions`, `role_permissions` and `invitations`.

Constraints include global normalized email uniqueness, one membership per User/Store pair, unique token hashes, expiry/consumption enforcement, Store status checks and final-Owner protection.

### API Groups

Public/auth endpoints cover registration, email verification, login, logout, session, password reset and email change. Store endpoints cover list, create, select, deactivate and reactivate. Membership endpoints cover list, invite, accept, resend, revoke, leave, suspend, remove and role change.

All endpoints are versioned under `/api/v1`, use the existing response/error envelope and include request IDs. Store context comes from authenticated membership evaluation, not an untrusted client claim.

## Frontend Behavior

Required flows are register, verify email, login, reset password, accept invitation, create first Store, Store switch, session expiration and access denied.

- Use TanStack Query for server state.
- Invalidate Store-scoped queries after Store switch.
- Preserve form state after safe session expiry when possible.
- Show generic credential/token errors.
- Show loading, success, empty, error and forbidden states.
- Hide unavailable actions based on server capabilities, without relying on that hiding for security.

## Error Handling and Security

- `401`: unauthenticated, invalid credential or expired session.
- `403`: authenticated but outside Store/permission boundary.
- `423`: temporary lockout if selected by final API convention.
- `429`: rate limit.
- Invalid/expired token: safe generic response and a new-flow action.
- Database failure: transaction rollback and no partial Store/membership mutation.

Never log passwords, raw tokens, cookies, reset URLs or unnecessary PII. Audit registration, verification, login failures, lockouts, logout, password reset, email changes, Store lifecycle, invitations, membership lifecycle and role changes.

## Testing Strategy

- Unit: normalization, password policy, token rules, session expiry, lockout, permission policies and final-Owner invariant.
- Integration: registration/onboarding transaction, login/session, reset, invitation acceptance, Store switch and membership lifecycle.
- API: `401`, `403`, `423`, `429`, validation, Store isolation and capability responses.
- Security: IDOR, CSRF, brute force, account enumeration, token replay, permission revocation and excessive data exposure.
- E2E: registration through Store onboarding, login, recovery, invitation, Store switching, member leave/remove and role changes.
- Audit: every critical mutation creates an immutable audit record.

## Deferred ADR Decisions

- Password hash algorithm and breach-list provider.
- Exact lockout threshold, duration and error convention.
- Verification/reset/email-change token TTLs.
- Email delivery provider.
- CSRF implementation detail.
- Exact ORM/migration implementation.
- Final Admin policy boundaries for each module.
- External auth provider is not used for this subsystem unless a separately approved redesign replaces this design.

## Traceability

```text
BUS-AUTH / BUS-STORE
→ REQ-AUTH / REQ-STORE / REQ-USER
→ Auth, Store & Authorization contexts
→ PostgreSQL sessions, memberships and policies
→ REST API and frontend capability states
→ Edge auth/store/permission cases
→ AC-AUTH / AC-RBAC / global authorization criteria
→ Automated unit, integration, security and E2E tests
```
