# Auth / Store / RBAC Requirement Traceability

> Plan: `2026-08-23-auth-store-rbac`  
> Branch: `auth-store-rbac`  
> Scope: Identity, registration, verification, password policy, sessions, recovery, Store onboarding, membership, invitations, fixed roles, authorization, Store isolation, frontend states, audit, security tests and traceability.

---

## 1. Traceability Matrix

### Business Rules → Requirements → Code → Tests

| ID | Business Rule / Requirement | Domain Code | API / UI Behavior | Automated Tests |
|---|---|---|---|---|
| **BUS-STORE-001** | Mọi entity nghiệp vụ phải thuộc một Store. | `stores` table; `store_id` FK in `store_memberships`, `invitations`, `audit_logs`. | All business endpoints (deferred) will require `storeId`. Auth endpoints are global. | E2E: `boots the real AppModule and runs registration through Store selection` |
| **BUS-STORE-002** | User chỉ được truy cập Store mà User có membership hợp lệ. | `AuthGuard.lookupMembership()`; `AuthorizationService.can()`. | `403 STORE_ACCESS_DENIED` if no active membership. | E2E: `enforces store-scoped access controls` (security.e2e-spec.ts); Unit: `PermissionGuard` — `denies cross-Store access even with valid permission` |
| **BUS-STORE-003** | Thay đổi ID trên URL/API không được phép vượt Store boundary. | `AuthGuard.extractStoreId()` checks params/query/header/cookie; `PermissionGuard` rechecks resource scope. | Cross-Store requests return generic `403`. | E2E: `Store A user accessing Store B resource -> generic 403`; Unit: `denies cross-Store access with generic 403` |
| **BUS-STORE-004** | MVP không hỗ trợ hard-delete Store. | `prevent_store_hard_delete()` trigger on `stores`. | `DELETE stores` raises exception. | Integration: `persistence.integration-spec.ts` (transaction rollback verifies trigger behavior indirectly) |
| **BUS-AUTH-001** | Owner có toàn quyền trong Store. | `ROLE_PERMISSIONS.OWNER = PERMISSION_CODES` (all 24). | Capabilities endpoint returns all permissions for Owner. | Unit: `grants Owner full access to all permissions` |
| **BUS-AUTH-002** | Admin được quản lý nghiệp vụ nhưng không tự chuyển quyền sở hữu Store. | `ROLE_PERMISSIONS.ADMIN` excludes `store.deactivate`, `dashboard.financial.read`, `livestream.control`, `roles.manage`. | Admin cannot deactivate Store or manage roles. | Unit: `grants Admin operational permissions but not ownership, financial, livestream or role management` |
| **BUS-AUTH-003** | Warehouse được quản lý inventory nhưng không mặc định được xem dữ liệu tài chính. | `ROLE_PERMISSIONS.WAREHOUSE` includes `inventory.read/adjust`, excludes `dashboard.financial.read`, `analytics.read`. | Warehouse sees orders and inventory only. | Unit: `grants Warehouse inventory and order fulfillment permissions` |
| **BUS-AUTH-004** | Customer Support được xem Order/Customer theo permission. | `ROLE_PERMISSIONS.CUSTOMER_SUPPORT` includes `orders.read/update`, `customers.read`. | CS sees orders and customers only. | Unit: `grants Customer Support order and customer permissions` |
| **BUS-AUTH-005** | Backend là nơi quyết định quyền cuối cùng. | `PermissionGuard` + `AuthGuard` run on every protected request. | Frontend hides actions via `/capabilities`, but backend rejects unauthorized mutations with `403`. | E2E: `suspended membership -> generic 403`; Unit: `denies access when permission is missing` |
| **REQ-AUTH-001** | Đăng nhập — validate, authenticate, tạo session. | `AuthController.login()`; `SessionService.create()`; `PasswordHasher.verify()`. | `POST /api/v1/auth/login` returns `200` with `userId`, sets session + CSRF cookies. | Unit: `returns a secure cookie and CSRF token on valid login`; E2E: `runs registration through Store selection` |
| **REQ-AUTH-002** | Đăng xuất — invalidate session, clear client state. | `AuthController.logout()`; `SessionService.revoke()`. | `POST /api/v1/auth/logout` clears cookies, revokes session. | Unit: `revokes the current session and clears cookies on logout` |
| **REQ-AUTH-003** | Session hết hạn — detect, refresh nếu có, yêu cầu login. | `SessionService.validate()` checks `idle_expires_at` and `absolute_expires_at`; `AuthGuard` throws `401` on invalid session. | `401 UNAUTHENTICATED` on expired/revoked session. | Unit: `rejects an expired session`; `rejects a revoked session` |
| **REQ-STORE-001** | Xem Store — chỉ thấy Store có membership. | `StoreService.listStores()` filters by active membership. | `GET /api/v1/stores` returns only user's active Stores. | Unit: `does not accept client ownership data and lists/selects only user Stores` |
| **REQ-STORE-002** | Tạo Store — tên bắt buộc, timezone hợp lệ, currency được hỗ trợ. | `StoreService.createFirstStore()` validates name, timezone, currency (`VND` only). | `POST /api/v1/stores` returns `201` with Store + Owner membership; `400` on invalid input. | Unit: `creates the first Store and Owner membership in one transaction with safe defaults`; `rejects invalid timezone and unsupported currency` |
| **REQ-STORE-003** | Chuyển Store — mọi request sau scope theo active Store. | `AuthGuard.extractStoreId()` reads `commerce_selected_store` cookie. | `POST /api/v1/stores/:storeId/select` sets cookie; subsequent requests use selected Store. | E2E: `selects store and scopes subsequent requests` |
| **REQ-USER-001** | Danh sách user — Admin/Owner có permission. | `MembershipService.list()`; `PermissionGuard` checks `members.read`. | `GET /api/v1/stores/:storeId/members` returns membership list. | Unit: `lists memberships scoped to a Store` |
| **REQ-USER-002** | Mởi user — email + role. | `InvitationService.invite()`; creates hashed token, 7-day expiry. | `POST /api/v1/stores/:storeId/invitations` sends invitation email. | Unit: `creates an invitation with 7-day expiry and hashed token` |
| **REQ-USER-003** | Thay đổi role — không transfer ownership bằng flow thường, mọi thay đổi phải audit. | `MembershipService.changeRole()`; advisory lock + owner count check; `AuditService.log()`. | `PATCH /api/v1/stores/:storeId/members/:userId/role` returns updated membership or `409 FINAL_OWNER_PROTECTED`. | Unit: `allows Owner to change a member role`; `rejects role change that would leave zero active Owners`; E2E: `serializes concurrent final-Owner role changes` |
| **EDGE-AUTH-001** | Session hết hạn — API trả 401, refresh nếu có thể, yêu cầu login. | `SessionService.validate()` returns `null` on expiry; `AuthGuard` throws `401`. | `401 UNAUTHENTICATED` on expired session. | Unit: `rejects an expired session` |
| **EDGE-AUTH-002** | Login thất bại nhiều lần — rate limit, không tiết lộ email tồn tại. | `User.recordFailedLogin()`; lockout after 5 attempts / 15 minutes. | `401 UNAUTHENTICATED` for invalid credentials; `429 RATE_LIMITED` after threshold. | Unit: `returns 429 after 5 failed attempts`; `returns generic 401 for invalid credentials` |
| **EDGE-AUTHZ-001** | Đổi ID trên URL — reject, không leak metadata, không mutation. | `PermissionGuard` checks `resourceStoreId` against `context.storeId`. | `403 STORE_ACCESS_DENIED` with no extra data. | E2E: `Store A user accessing Store B resource -> generic 403` |
| **EDGE-AUTHZ-002** | Permission bị thu hồi — backend kiểm tra lại, trả 403, UI cập nhật. | `MembershipService.recheckActorMembership()` after mutation. | `403 MEMBERSHIP_REVOKED` if actor loses manage permission during operation. | Unit: `rechecks actor permission after revoke in case session was invalidated` |
| **EDGE-STORE-001** | User Store A gọi resource Store B — reject, không trả dữ liệu Store B. | `AuthGuard.lookupMembership()` returns `null` for wrong Store; `PermissionGuard` blocks. | `403 STORE_ACCESS_DENIED` with no Store B data. | E2E: `Store A user accessing Store B resource -> generic 403` |
| **AC-GLOBAL-001** | TypeScript build pass. | Entire `apps/api` and `apps/web` codebase. | `pnpm typecheck` passes. | CI gate: `pnpm typecheck` |
| **AC-GLOBAL-002** | Lint pass. | Entire codebase. | `pnpm lint` passes. | CI gate: `pnpm lint` |
| **AC-GLOBAL-003** | Mutation protected phải được kiểm tra permission ở server. | `PermissionGuard` on all mutation controllers; `RequirePermission` decorator. | `403 PERMISSION_DENIED` for unauthorized mutations. | Unit: `denies access when permission is missing`; E2E: `enforces store-scoped access controls` |
| **AC-GLOBAL-004** | Store Isolation — user không được đọc/mutate Store ngoài quyền. | `AuthGuard` + `PermissionGuard` + `AuthorizationService.can(resourceStoreId)`. | Cross-Store access returns `403`. | E2E: `enforces store-scoped access controls` |
| **AC-GLOBAL-005** | Audit — critical mutation phải tạo audit record. | `AuditService.log()` called in all critical services; redaction of secrets. | Audit records created for: register, verify, login, logout, session create/revoke, password reset, email change, store create/update/deactivate/reactivate, membership leave/suspend/remove/role_change, invitation invite/resend/revoke/accept. | Unit: `logs a safe audit record`; `redacts password fields from audit data`; `redacts token and session fields from audit data` |
| **AC-GLOBAL-006** | Error state — critical async operation phải có error state hiểu được. | `ApiError` with `status`, `code`, `message`; `ApiExceptionFilter` maps to envelope. | Frontend `ApiError` class surfaces `status`, `code`, `message` for toast/error UI. | Unit: `maps expected domain failures to the response envelope` |
| **AC-AUTH-001** | Login thành công — session được tạo, user đưa tới trang hợp lệ. | `AuthController.login()`; `SessionService.create()`. | `200` with cookies; frontend queries `/session` then `/capabilities`. | E2E: `runs registration through Store selection` |
| **AC-AUTH-002** | Login sai — thất bại, không leak thông tin account. | Generic `401 UNAUTHENTICATED` for all invalid cases. | Same error message for unknown email, wrong password, disabled user. | Unit: `returns generic 401 for invalid credentials` |
| **AC-AUTH-003** | Session hết hạn — refresh hoặc yêu cầu login. | `SessionService.touch()` extends idle timeout; absolute expiry is hard limit. | `401` on absolute expiry or revocation. | Unit: `rejects an expired session`; `rejects a revoked session` |
| **AC-RBAC-001** | User có `orders.read` — Orders hiển thị. | `ROLE_PERMISSIONS` matrix. | Frontend queries `/capabilities` and conditionally renders Orders nav. | Unit: `returns permissions for the selected Store` |
| **AC-RBAC-002** | User không có `orders.read` — gọi API trả 403. | `PermissionGuard` rejects. | `403 PERMISSION_DENIED`. | Unit: `denies access when permission is missing` |
| **AC-RBAC-003** | User không có `inventory.adjust` — server reject. | `PermissionGuard` rejects. | `403 PERMISSION_DENIED`. | Unit: `denies access when permission is missing` |

---

## 2. Deferred ADR Choices and Final Records

The following decisions were deferred in the original design spec and resolved during Tasks 1-10:

| Decision | Original State | Final Record | Location |
|---|---|---|---|
| Password hashing algorithm | Open | Argon2id, 19 MiB memory cost, 2 iterations, 1 lane | `docs/adr/0001-auth-security-and-persistence.md` |
| Compromised-password checking | Open | Have I Been Pwned k-anonymity (5-char SHA-1 prefix); fails closed | `docs/adr/0001-auth-security-and-persistence.md` |
| Login lockout threshold | Open | 5 attempts within window → 15-minute lockout | `docs/adr/0001-auth-security-and-persistence.md` |
| Token TTLs | Open | Verification 24h; password-reset 1h; email-change 1h; invitation 7 days | `docs/adr/0001-auth-security-and-persistence.md` |
| Session strategy | Open | PostgreSQL opaque sessions with SHA-256 hashed tokens; no JWT | `docs/adr/0001-auth-security-and-persistence.md` |
| Email delivery adapter | Open | `EmailDelivery` port; memory adapter for dev/test; SMTP for production | `docs/adr/0001-auth-security-and-persistence.md` |
| CSRF protection | Open | Double-submit token bound to session with HMAC-SHA256; `X-CSRF-Token` header required for mutations | `docs/adr/0001-auth-security-and-persistence.md` |
| Cookie settings | Open | `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` in production | `docs/adr/0001-auth-security-and-persistence.md` |
| ORM vs raw SQL | Open | Raw `pg` driver with parameterized SQL; small repository layer | `docs/adr/0001-auth-security-and-persistence.md` |
| Migration direction | Open | Forward-only in deployment; paired down migration for local/test rollback | `docs/adr/0001-auth-security-and-persistence.md` |
| Role model | Open | Fixed system roles (`OWNER`, `ADMIN`, `STAFF`, `WAREHOUSE`, `CUSTOMER_SUPPORT`, `ANALYST`) seeded in migration | `infra/postgres/migrations/0002_auth_store_rbac.sql` |
| Permission matrix | Candidate vocabulary | 24 permissions with explicit `ROLE_PERMISSIONS` mapping in code and migration | `apps/api/src/authorization/domain/permission.ts` |
| Final-Owner protection | Mentioned in spec | Database trigger + application advisory-lock pattern | `infra/postgres/migrations/0002_auth_store_rbac.sql` + `MembershipService` |
| Store hard-delete | Open | Blocked by `prevent_store_hard_delete()` trigger; soft-deactivate only | `infra/postgres/migrations/0002_auth_store_rbac.sql` |
| Audit data redaction | Open | Automatic redaction of keys containing `password`, `token`, `hash`, `cookie`, `csrf`, `secret` | `apps/api/src/audit/audit.service.ts` |

---

## 3. Test Inventory

### Unit / Domain Tests

| Test File | Coverage |
|---|---|
| `apps/api/src/identity/domain/email.test.ts` | Email normalization, trimming, lowercasing, malformed rejection |
| `apps/api/src/identity/domain/password-policy.test.ts` | Length >= 12, common password rejection, compromised-password checking, fail-closed behavior |
| `apps/api/src/identity/domain/user.test.ts` | Status transitions, lockout tracking, successful login reset |
| `apps/api/src/identity/domain/auth-token.test.ts` | Token hash matching, no raw material exposure |
| `apps/api/src/stores/domain/membership.test.ts` | Membership status transitions (ACTIVE, SUSPENDED, LEFT, REMOVED, INVITED) |
| `apps/api/src/identity/application/identity.service.test.ts` | Registration, verification, idempotency, transaction rollback, email sending |
| `apps/api/src/identity/application/recovery.service.test.ts` | Password reset request/complete, email change request/complete, token expiry, compromised password rejection |
| `apps/api/src/auth/application/session.service.test.ts` | Session creation, validation, touch, revoke, CSRF generation, idle/absolute expiry |
| `apps/api/src/stores/application/store.service.test.ts` | First-Store creation, idempotency, timezone/currency validation, list, select, update, deactivate, reactivate |
| `apps/api/src/stores/application/membership.service.test.ts` | Leave, suspend, remove, changeRole, list, final-Owner protection, permission checks, recheck actor |
| `apps/api/src/stores/application/invitation.service.test.ts` | Invite, resend, revoke, accept, email mismatch, deactivated Store, expired token, race condition |
| `apps/api/src/authorization/application/authorization.service.test.ts` | Permission check, membership status check, cross-Store denial, context missing denial |
| `apps/api/src/audit/audit.service.test.ts` | Audit log insertion, recursive redaction of secrets, arrays, nested objects |
| `apps/api/src/identity/infrastructure/production-adapters.test.ts` | Argon2id hashing, HIBP checker, SMTP adapter rejection of placeholders |
| `apps/api/src/http/api-error.test.ts` | Error envelope mapping, `ApiError` vs `HttpException` handling |
| `apps/api/src/health/request-id.middleware.test.ts` | Request ID generation, propagation, empty header handling |
| `apps/api/src/health/health.controller.test.ts` | Health endpoint response |
| `apps/api/src/auth/http/auth.controller.test.ts` | Login, logout, session, register, verify, password reset, email change, cookie setting, lockout behavior |
| `apps/api/src/auth/http/auth.guard.test.ts` | Cookie validation, CSRF check, storeId extraction (params/query/header/cookie), membership lookup, permission population |
| `apps/api/src/authorization/http/capabilities.controller.test.ts` | Capabilities endpoint returns permissions from context |
| `apps/api/src/authorization/http/permission.guard.test.ts` | Permission metadata extraction, allow/deny logic, cross-Store denial |
| `apps/api/src/main.test.ts` | API bootstrap with valid/invalid environment |

### Integration Tests

| Test File | Coverage |
|---|---|
| `apps/api/test/persistence.integration-spec.ts` | Migration application, constraint verification, transaction rollback, idempotency index, final-Owner trigger, store delete trigger |

### E2E Tests

| Test File | Coverage |
|---|---|
| `apps/api/test/app.e2e-spec.ts` | AppModule bootstrap, health endpoint |
| `apps/api/test/auth-store-rbac.e2e-spec.ts` | Full registration → verification → login → Store creation → selection → deactivation → reactivation → logout flow; idempotency; unverified user blocking; cross-Store denial |
| `apps/api/test/security.e2e-spec.ts` | Store isolation, suspended membership, permission revocation, invitation lifecycle, final-Owner protection, CSRF rejection, anonymous rejection, audit record verification |
| `apps/api/test/concurrency.e2e-spec.ts` | Concurrent final-Owner role changes, concurrent idempotent Store creation, concurrent invitation acceptance, concurrent password reset |

### Frontend Tests

| Test File | Coverage |
|---|---|
| `apps/web/features/auth/api.test.ts` | Register, login, logout, password reset, email change, session query, CSRF header inclusion, error handling |
| `apps/web/features/auth/queries.test.tsx` | React Query hooks for auth flows, loading/error/success states |
| `apps/web/features/stores/api.test.ts` | List Stores, select Store, create Store, accept invitation, capabilities query |
| `apps/web/features/stores/queries.test.tsx` | React Query hooks for Store flows, loading/error/success states |

---

## 4. Security Verification Checklist

| Control | Evidence |
|---|---|
| No raw token persistence | `sessions.session_hash` is SHA-256; `email_tokens.token_hash` is SHA-256 |
| No secret logging | `AuditService.sanitizeObject()` redacts password/token/hash/secret/csrf/cookie fields |
| Store isolation | E2E `security.e2e-spec.ts` — cross-Store access returns generic `403` |
| CSRF protection | `AuthGuard` requires `X-CSRF-Token` header for mutations; bound to session via HMAC |
| Login lockout | `User.recordFailedLogin()`; `429` after 5 attempts; 15-minute window |
| Final-Owner protection | DB trigger + advisory lock + application count check; concurrency E2E verifies serialization |
| Generic error messages | `401` for all invalid credentials; `403` for all authorization failures |
| Password policy | >= 12 chars, common password rejection, HIBP compromised check, Argon2id hashing |
| Session security | Opaque IDs, HttpOnly, Secure in production, SameSite=Lax, 24h idle / 30d absolute |
| Migration rollback | `pnpm infra:rollback` rolls back one migration; verified in CI and locally |

---

## 5. Files Changed in This Task

- `README.md` — local Auth configuration, session behavior, recovery testing
- `infra/postgres/README.md` — migration catalog, rollback commands, table descriptions
- `docs/06-acceptance-and-development.md` — API endpoints, status/error semantics, role capabilities, Store isolation, final-Owner protection
- `docs/traceability/auth-store-rbac-traceability.md` — this file
