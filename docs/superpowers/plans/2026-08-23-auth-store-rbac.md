# Authentication, Store Membership & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement secure self-registration, email verification, PostgreSQL sessions, Store onboarding, multi-Store membership and fixed-role authorization on the Phase 0 foundation.

**Architecture:** Extend the NestJS modular monolith with Identity/Auth, Store/Membership, Authorization and Audit boundaries. PostgreSQL owns global users, sessions, tokens, Stores, memberships and fixed-role permission data; the API derives a Store-scoped request context from the session and membership rather than trusting client claims. The Next.js app consumes the REST API and server capabilities without duplicating authorization logic.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Next.js, React, TanStack Query, REST `/api/v1`, the existing validated configuration package, existing Turborepo + pnpm workspace, Jest and Vitest, Playwright-ready E2E setup, and the email delivery adapter selected in Task 1.

**Spec:** `docs/superpowers/specs/2026-08-23-auth-store-rbac-design.md`

## Global Constraints

- Self-registration is enabled.
- Email verification is required before Store creation or application use.
- The verified User creates the first Store and becomes Owner.
- Passwords require at least 12 characters; common/compromised passwords are rejected.
- Session idle timeout is 24 hours; absolute lifetime is 30 days.
- Invitation tokens expire after 7 days and support resend/revoke.
- Members may leave a Store; the final Owner cannot be removed.
- Only Owner can deactivate/reactivate a Store.
- Login is rate-limited, temporary lockout is used, and password reset/email change require email verification.
- User is a global identity; email is trimmed and lowercased; uniqueness is global.
- Authentication is implemented in-house in the NestJS modular monolith.
- Sessions are stored in PostgreSQL and cookies contain only opaque session identifiers.
- The backend is authoritative at the controller boundary and again in application services for critical mutations.
- A resource ID never proves ownership.
- Cross-Store failures do not reveal resource metadata.
- Store and Owner membership creation are one transaction.
- Passwords, raw tokens, cookies and reset URLs must never be logged.
- Phase 0 foundation behavior and its no-business-schema baseline must remain intact.

## File Map

### ADR and shared foundation

- Create: `docs/adr/0001-auth-security-and-persistence.md` - finalized hash, lockout, token, email, CSRF and ORM/migration choices.
- Modify: `packages/config/src/index.ts` - add only approved Auth/Store configuration fields.
- Modify: `.env.example` - document non-secret local values for the selected email adapter and Auth settings.

### API domain and application modules

- Create: `apps/api/src/identity/domain/user.ts` - User status and identity rules.
- Create: `apps/api/src/identity/domain/email.ts` - email normalization and value object.
- Create: `apps/api/src/identity/domain/password-policy.ts` - minimum length and compromised-password policy port.
- Create: `apps/api/src/identity/domain/auth-token.ts` - hashed token and expiry rules.
- Create: `apps/api/src/identity/application/identity.service.ts` - registration, verification and email-change use cases.
- Create: `apps/api/src/identity/application/recovery.service.ts` - password-reset use cases.
- Create: `apps/api/src/identity/application/ports/password-hasher.ts` - password hash interface.
- Create: `apps/api/src/identity/application/ports/email-delivery.ts` - verification, reset and invitation email interface.
- Create: `apps/api/src/identity/infrastructure/identity.repository.ts` - User and token persistence.
- Create: `apps/api/src/identity/identity.module.ts` - Identity/Auth dependency composition.
- Create: `apps/api/src/auth/application/session.service.ts` - session creation, validation, activity and revocation.
- Create: `apps/api/src/auth/infrastructure/session.repository.ts` - PostgreSQL session persistence.
- Create: `apps/api/src/auth/http/auth.controller.ts` - public auth endpoints.
- Create: `apps/api/src/auth/http/auth.guard.ts` - authenticated request guard.
- Create: `apps/api/src/auth/auth.module.ts` - Auth dependency composition.
- Create: `apps/api/src/stores/domain/store.ts` - Store lifecycle rules.
- Create: `apps/api/src/stores/domain/membership.ts` - membership and final-Owner rules.
- Create: `apps/api/src/stores/application/store.service.ts` - Store creation, selection and lifecycle.
- Create: `apps/api/src/stores/application/membership.service.ts` - membership operations.
- Create: `apps/api/src/stores/application/invitation.service.ts` - invitation lifecycle.
- Create: `apps/api/src/stores/infrastructure/store.repository.ts` - Store, membership and invitation persistence.
- Create: `apps/api/src/stores/http/store.controller.ts` - Store endpoints.
- Create: `apps/api/src/stores/http/membership.controller.ts` - membership/invitation endpoints.
- Create: `apps/api/src/stores/stores.module.ts` - Store/Membership dependency composition.
- Create: `apps/api/src/authorization/domain/permission.ts` - permission codes and fixed-role catalog.
- Create: `apps/api/src/authorization/application/authorization.service.ts` - capability and action evaluation.
- Create: `apps/api/src/authorization/http/permission.guard.ts` - route permission enforcement.
- Create: `apps/api/src/authorization/authorization.module.ts` - authorization dependency composition.
- Modify: `apps/api/src/app.module.ts` - import Identity, Auth, Stores, Authorization and Audit modules.

### Persistence

- Create: `infra/postgres/migrations/0002_auth_store_rbac.sql` - Auth/Store/RBAC tables, constraints and fixed-role seed data.
- Create: `infra/postgres/migrations/0002_auth_store_rbac.down.sql` - safe rollback for the migration.
- Modify: `infra/postgres/README.md` - migration and local email configuration instructions.

### Frontend

- Create: `apps/web/features/auth/api.ts` - typed auth API calls.
- Create: `apps/web/features/auth/queries.ts` - session query and auth mutations.
- Create: `apps/web/features/auth/components/register-form.tsx` - registration form.
- Create: `apps/web/features/auth/components/login-form.tsx` - login form.
- Create: `apps/web/features/auth/components/recovery-form.tsx` - reset request/confirmation forms.
- Create: `apps/web/features/auth/components/verification-state.tsx` - verification pending/success/error states.
- Create: `apps/web/features/stores/api.ts` - Store and membership API calls.
- Create: `apps/web/features/stores/queries.ts` - Store context and capability queries.
- Create: `apps/web/features/stores/components/create-store-form.tsx` - first Store onboarding.
- Create: `apps/web/features/stores/components/store-switcher.tsx` - Store selection.
- Create: `apps/web/features/stores/components/invitation-acceptance.tsx` - invitation acceptance.
- Create: `apps/web/features/stores/components/access-denied.tsx` - `401`/`403` state presentation.
- Modify: `apps/web/app/layout.tsx` - auth/session provider boundary only.
- Modify: `apps/web/app/page.tsx` - route authenticated users to the permitted foundation destination without adding dashboard UI.

### Tests

- Create: `apps/api/src/identity/domain/email.test.ts` - email normalization tests.
- Create: `apps/api/src/identity/domain/user.test.ts` - User status tests.
- Create: `apps/api/src/identity/domain/password-policy.test.ts` - password policy tests.
- Create: `apps/api/src/identity/domain/auth-token.test.ts` - token lifecycle tests.
- Create: `apps/api/src/auth/application/session.service.test.ts` - session lifecycle tests.
- Create: `apps/api/src/auth/http/auth.controller.test.ts` - auth endpoint tests.
- Create: `apps/api/src/identity/application/recovery.service.test.ts` - recovery tests.
- Create: `apps/api/src/stores/domain/membership.test.ts` - membership invariant tests.
- Create: `apps/api/src/stores/application/membership.service.test.ts` - membership use-case tests.
- Create: `apps/api/src/stores/application/invitation.service.test.ts` - invitation tests.
- Create: `apps/api/src/authorization/application/authorization.service.test.ts` - policy tests.
- Create: `apps/api/src/authorization/http/permission.guard.test.ts` - guard tests.
- Create: `apps/api/test/auth-store-rbac.e2e-spec.ts` - critical API flows and isolation tests.
- Create: `apps/api/test/persistence.integration-spec.ts` - migration, constraints and fixed-role seed tests.
- Create: `apps/api/test/security.e2e-spec.ts` - cross-Store, session and permission security tests.
- Create: `apps/web/features/auth/api.test.ts` - auth API client tests.
- Create: `apps/web/features/auth/queries.test.tsx` - auth query/mutation tests.
- Create: `apps/web/features/auth/components/register-form.test.tsx` - registration form tests.
- Create: `apps/web/features/auth/components/login-form.test.tsx` - login form tests.
- Create: `apps/web/features/auth/components/recovery-form.test.tsx` - recovery form tests.
- Create: `apps/web/features/auth/components/verification-state.test.tsx` - verification state tests.
- Create: `apps/web/features/stores/api.test.ts` - Store API client tests.
- Create: `apps/web/features/stores/queries.test.tsx` - Store query/reconciliation tests.
- Create: `apps/web/features/stores/components/create-store-form.test.tsx` - onboarding form tests.
- Create: `apps/web/features/stores/components/store-switcher.test.tsx` - Store switch tests.
- Create: `apps/web/features/stores/components/invitation-acceptance.test.tsx` - invitation UI tests.
- Create: `apps/web/features/stores/components/access-denied.test.tsx` - access state tests.
- Modify: `apps/api/test/app.e2e-spec.ts` - preserve health coverage and share test bootstrap utilities only.

## Task 1: Finalize Security and Persistence ADRs

**Files:**
- Create: `docs/adr/0001-auth-security-and-persistence.md`
- Modify: `packages/config/src/index.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces the approved `PasswordHasher` contract consumed by Identity.
- Produces the approved `EmailDelivery` contract consumed by Identity and Stores.
- Produces concrete lockout, token TTL, CSRF, ORM/migration and email-adapter decisions for later tasks.

- [ ] **Step 1: Record the security decisions**

Document the selected adaptive password-hash algorithm, compromised-password source, temporary-lock threshold/duration, verification/reset/email-change token TTLs, and `401`/`423` error convention. The password policy must remain at least 12 characters and the token rules must remain hashed, single-use and expiring.

- [ ] **Step 2: Record the persistence and delivery decisions**

Document the PostgreSQL access/migration approach, email adapter, CSRF strategy for cookie mutations and local test delivery behavior. Define how tests assert email payloads without sending real messages.

- [ ] **Step 3: Add only approved configuration fields**

Extend the existing config schema with the exact values needed by the chosen decisions. Keep secrets out of `.env.example` and ensure invalid production settings fail before NestJS startup.

- [ ] **Step 4: Verify the decision/config boundary**

Run:

```bash
pnpm --filter @commerce/config test
pnpm typecheck
pnpm lint
```

Expected: existing foundation tests pass and the ADR contains no unresolved decision language.

- [ ] **Step 5: Commit the ADR and configuration contract**

```bash
git add docs/adr/0001-auth-security-and-persistence.md packages/config/src/index.ts .env.example README.md
git commit -m "docs: finalize auth security decisions"
```

## Task 2: Implement Identity Domain Primitives

**Files:**
- Create: `apps/api/src/identity/domain/email.ts`
- Create: `apps/api/src/identity/domain/user.ts`
- Create: `apps/api/src/identity/domain/password-policy.ts`
- Create: `apps/api/src/identity/domain/auth-token.ts`
- Create: `apps/api/src/identity/application/ports/password-hasher.ts`
- Create: `apps/api/src/identity/application/ports/email-delivery.ts`
- Create: `apps/api/src/identity/domain/email.test.ts`
- Create: `apps/api/src/identity/domain/user.test.ts`
- Create: `apps/api/src/identity/domain/password-policy.test.ts`
- Create: `apps/api/src/identity/domain/auth-token.test.ts`

**Interfaces:**
- Consumes: ADR decisions from Task 1.
- Produces: `normalizeEmail(value): string`, `validatePassword(value): PasswordPolicyResult`, `UserStatus`, `AuthTokenType`, `PasswordHasher`, and `EmailDelivery` interfaces.

- [ ] **Step 1: Write failing tests for email normalization**

Cover trim/lowercase, empty values and invalid email formats. Assert that the normalized value is the one used for uniqueness checks.

- [ ] **Step 2: Run the normalization tests and verify failure**

Run:

```bash
pnpm --filter @commerce/api test -- email
```

Expected: FAIL because the identity value object does not exist.

- [ ] **Step 3: Implement email normalization**

Implement the smallest value object that returns a normalized email or a validation error without exposing unrelated account state.

- [ ] **Step 4: Write failing tests for password/token rules**

Cover 12-character minimum, compromised/common password rejection through the selected port, token hash comparison, expiry, consumed state and single-use behavior.

- [ ] **Step 5: Implement domain primitives**

Implement User statuses and transitions, password policy delegation, and one-time token state. Keep hashing behind ports; do not couple the domain to a library or email provider.

- [ ] **Step 6: Run identity tests and quality checks**

Run:

```bash
pnpm --filter @commerce/api test -- identity
pnpm --filter @commerce/api typecheck
pnpm --filter @commerce/api lint
```

Expected: all identity tests pass.

- [ ] **Step 7: Commit identity primitives**

```bash
git add apps/api/src/identity
git commit -m "feat: add identity domain primitives"
```

## Task 3: Add Auth/Store/RBAC Persistence

**Files:**
- Create: `infra/postgres/migrations/0002_auth_store_rbac.sql`
- Create: `infra/postgres/migrations/0002_auth_store_rbac.down.sql`
- Create: `apps/api/src/identity/infrastructure/identity.repository.ts`
- Create: `apps/api/src/auth/infrastructure/session.repository.ts`
- Create: `apps/api/src/stores/infrastructure/store.repository.ts`
- Create: `apps/api/src/authorization/domain/permission.ts`
- Create: `apps/api/test/persistence.integration-spec.ts`

**Interfaces:**
- Consumes: Identity primitives and ADR persistence decisions.
- Produces repositories for User, auth tokens, sessions, Store, memberships and invitations.
- Produces fixed roles: Owner, Admin, Staff, Warehouse, Customer Support and Analyst.
- Produces permission seed codes from the approved catalog.

- [ ] **Step 1: Write failing migration/repository tests**

Test migration application/rollback, global normalized-email uniqueness, one membership per User/Store, unique session/token hashes, invitation expiry columns, Store status and fixed-role seed data.

- [ ] **Step 2: Run the persistence tests and verify failure**

Run:

```bash
pnpm infra:migrate
pnpm test:integration
```

Expected: FAIL because migration `0002` and repositories do not exist.

- [ ] **Step 3: Implement migration 0002**

Create only the tables required by the approved spec. Add foreign keys, unique constraints, status checks, expiry/consumption fields and indexes for normalized email, session lookup, token lookup and Store membership queries.

- [ ] **Step 4: Seed fixed roles and permissions**

Seed deterministic role and permission codes idempotently. Do not create custom-role mutation paths.

- [ ] **Step 5: Implement repositories**

Implement repository methods with explicit Store scope where applicable. Return domain-safe not-found/conflict results without leaking cross-Store metadata.

- [ ] **Step 6: Run migration and repository verification**

Run:

```bash
docker compose -f infra/docker-compose.yml up -d --wait
pnpm infra:migrate
pnpm test:integration
pnpm infra:rollback
docker compose -f infra/docker-compose.yml down
```

Expected: migration is idempotent, rollback is safe, and all repository tests pass.

- [ ] **Step 7: Commit persistence**

```bash
git add infra/postgres apps/api/src/identity/infrastructure apps/api/src/auth/infrastructure apps/api/src/stores/infrastructure apps/api/src/authorization/domain
git commit -m "feat: add auth store rbac persistence"
```

## Task 4: Implement Registration, Verification and First Store Onboarding

**Files:**
- Create: `apps/api/src/identity/application/identity.service.ts`
- Create: `apps/api/src/identity/identity.module.ts`
- Create: `apps/api/src/stores/domain/store.ts`
- Create: `apps/api/src/stores/application/store.service.ts`
- Create: `apps/api/src/stores/stores.module.ts`
- Create: `apps/api/src/auth/http/auth.controller.ts`
- Create: `apps/api/src/stores/http/store.controller.ts`
- Create: `apps/api/src/identity/application/identity.service.test.ts`
- Create: `apps/api/src/stores/application/store.service.test.ts`
- Create: `apps/api/test/auth-store-rbac.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: repositories from Task 3, `EmailDelivery`, `PasswordHasher`, `normalizeEmail` and `loadApiConfig`.
- Produces use cases for `register`, `verifyEmail`, `createFirstStore`, `listStores` and `selectStore`.

- [ ] **Step 1: Write failing registration tests**

Cover valid registration creating `UNVERIFIED`, normalized global email, hashed password and verification email; invalid password; duplicate public registration response; and no Store creation before verification.

- [ ] **Step 2: Implement registration**

Create the User and hashed verification token in one transaction, call the email port after persistence, and return a generic public response. Never return password or token values.

- [ ] **Step 3: Write failing verification tests**

Cover valid single-use token, expired token, consumed token and invalid token. Assert activation occurs only once.

- [ ] **Step 4: Implement email verification**

Consume the token atomically, transition User to `ACTIVE`, and return a safe verification result.

- [ ] **Step 5: Write failing first-Store onboarding tests**

Cover unverified rejection, valid Store creation, default `Asia/Ho_Chi_Minh`/`VND`, Owner membership creation, transaction rollback and duplicate Store request idempotency behavior.

- [ ] **Step 6: Implement first Store onboarding**

Use one database transaction for Store and Owner membership. Reject deactivated/invalid context and never accept Store ownership from client-provided role data.

- [ ] **Step 7: Add application module wiring and run tests**

Run:

```bash
pnpm --filter @commerce/api test -- identity store
pnpm --filter @commerce/api typecheck
pnpm --filter @commerce/api build
```

- [ ] **Step 8: Commit onboarding**

```bash
git add apps/api/src/identity apps/api/src/stores apps/api/src/auth
git commit -m "feat: add registration and store onboarding"
```

## Task 5: Implement Sessions, Login, Logout and Recovery

**Files:**
- Create: `apps/api/src/auth/application/session.service.ts`
- Create: `apps/api/src/auth/http/auth.guard.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/identity/application/recovery.service.ts`
- Modify: `apps/api/src/auth/http/auth.controller.ts`
- Create: `apps/api/src/auth/application/session.service.test.ts`
- Create: `apps/api/src/auth/http/auth.controller.test.ts`
- Create: `apps/api/src/identity/application/recovery.service.test.ts`

**Interfaces:**
- Consumes: User/repository and password/token ports from Tasks 2-4.
- Produces authenticated `RequestContext` containing `userId`, optional active `storeId`, membership status, role and permissions.
- Produces session operations: `create`, `validate`, `touch`, `revoke`.

- [ ] **Step 1: Write failing session tests**

Cover opaque identifier hashing, 24-hour idle timeout, 30-day absolute expiry, revoked session, activity touch and logout invalidation.

- [ ] **Step 2: Implement session service**

Store only the session token hash. Set `lastActivityAt`, `absoluteExpiresAt` and safe metadata. Reject expired/revoked sessions before creating a request context.

- [ ] **Step 3: Write failing login/logout API tests**

Cover valid login, invalid credentials with generic `401`, rate limit `429`, temporary lock, secure cookie attributes, logout and session endpoint.

- [ ] **Step 4: Implement login/logout/session endpoints**

Use the approved cookie/CSRF strategy, set no sensitive response fields, and recheck account status on every authenticated request.

- [ ] **Step 5: Write failing recovery tests**

Cover password reset request enumeration safety, token expiry/consumption, password replacement, old-session revocation, email-change verification and new-email uniqueness conflict.

- [ ] **Step 6: Implement recovery flows**

Use hashed one-time tokens and generic public responses. Never log or return raw token material.

- [ ] **Step 7: Run auth verification**

Run:

```bash
pnpm --filter @commerce/api test -- auth recovery
pnpm --filter @commerce/api test:e2e -- auth
pnpm typecheck
pnpm lint
```

- [ ] **Step 8: Commit authentication**

```bash
git add apps/api/src/auth apps/api/src/identity
git commit -m "feat: add authentication and session flows"
```

## Task 6: Implement Membership and Invitation Lifecycle

**Files:**
- Create: `apps/api/src/stores/domain/membership.ts`
- Create: `apps/api/src/stores/application/membership.service.ts`
- Create: `apps/api/src/stores/application/invitation.service.ts`
- Create: `apps/api/src/stores/http/membership.controller.ts`
- Create: `apps/api/src/stores/domain/membership.test.ts`
- Create: `apps/api/src/stores/application/membership.service.test.ts`
- Create: `apps/api/src/stores/application/invitation.service.test.ts`

**Interfaces:**
- Consumes: `RequestContext`, Store repository, fixed roles, session service and email port.
- Produces invitation and membership operations with `storeId` and actor context required.

- [ ] **Step 1: Write failing membership invariant tests**

Cover one membership per User/Store, leave, suspend, remove, role change, final-Owner protection, deactivated Store rejection and permission recheck after revoke.

- [ ] **Step 2: Implement membership service**

Enforce Store scope and final-Owner rules in the application service and database constraints. Retain `LEFT`/`REMOVED` history rather than hard-delete.

- [ ] **Step 3: Write failing invitation tests**

Cover 7-day expiry, resend/revoke, token single-use, existing global User acceptance, new User acceptance, deactivated Store rejection and duplicate membership prevention.

- [ ] **Step 4: Implement invitation service/endpoints**

Store only token hashes, revalidate inviter permission and Store status at acceptance, and make resend/revoke/accept operations safe under duplicate requests.

- [ ] **Step 5: Run membership verification**

Run:

```bash
pnpm --filter @commerce/api test -- membership invitation
pnpm --filter @commerce/api test:e2e -- membership invitation
```

- [ ] **Step 6: Commit membership lifecycle**

```bash
git add apps/api/src/stores
git commit -m "feat: add membership and invitation lifecycle"
```

## Task 7: Implement Fixed-Role Authorization and Store Context

**Files:**
- Create: `apps/api/src/authorization/application/authorization.service.ts`
- Create: `apps/api/src/authorization/http/permission.guard.ts`
- Create: `apps/api/src/authorization/authorization.module.ts`
- Modify: `apps/api/src/auth/http/auth.guard.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/src/authorization/application/authorization.service.test.ts`
- Create: `apps/api/src/authorization/http/permission.guard.test.ts`
- Modify: `apps/api/test/security.e2e-spec.ts`

**Interfaces:**
- Consumes: `RequestContext`, fixed-role/permission repositories and controller metadata.
- Produces `authorizationService.can(context, permission, resourceStoreId): boolean` and capability response for the frontend.

- [ ] **Step 1: Write failing policy tests**

Cover Owner full access, Admin restrictions, Staff, Warehouse, Customer Support and Analyst matrix, financial/livestream restrictions, and policy-scoped `orders.update`/`members.manage`.

- [ ] **Step 2: Implement authorization service**

Evaluate membership, fixed role, permission and resource Store scope. Never use client role/permission claims as authority.

- [ ] **Step 3: Write failing Store-isolation API tests**

Cover Store A requesting Store B resource IDs, missing membership, suspended/left/removed membership, deactivated Store, revoked permission and last-Owner mutations.

- [ ] **Step 4: Implement guards and request context**

Authenticate the session, derive active membership, attach request context, enforce route permissions and recheck critical mutations in application services.

- [ ] **Step 5: Add capabilities endpoint**

Return only the current User/Store capability set. Do not expose role internals or permissions from another Store.

- [ ] **Step 6: Run security verification**

Run:

```bash
pnpm --filter @commerce/api test -- authorization
pnpm --filter @commerce/api test:e2e -- auth-store-rbac
pnpm typecheck
pnpm lint
```

- [ ] **Step 7: Commit authorization**

```bash
git add apps/api/src/authorization apps/api/src/auth apps/api/src/app.module.ts
git commit -m "feat: enforce store scoped authorization"
```

## Task 8: Add Auth and Store Frontend Flows

**Files:**
- Create: `apps/web/features/auth`
- Create: `apps/web/features/stores`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/features/auth/api.test.ts`
- Create: `apps/web/features/auth/queries.test.tsx`
- Create: `apps/web/features/auth/components/register-form.test.tsx`
- Create: `apps/web/features/auth/components/login-form.test.tsx`
- Create: `apps/web/features/auth/components/recovery-form.test.tsx`
- Create: `apps/web/features/auth/components/verification-state.test.tsx`
- Create: `apps/web/features/stores/api.test.ts`
- Create: `apps/web/features/stores/queries.test.tsx`
- Create: `apps/web/features/stores/components/create-store-form.test.tsx`
- Create: `apps/web/features/stores/components/store-switcher.test.tsx`
- Create: `apps/web/features/stores/components/invitation-acceptance.test.tsx`
- Create: `apps/web/features/stores/components/access-denied.test.tsx`

**Interfaces:**
- Consumes: REST endpoints and capability response from Tasks 4-7.
- Produces UI flows for registration, verification, login, recovery, invitation, first Store, Store switch and access denied.

- [ ] **Step 1: Write failing UI state tests**

Cover loading, validation, generic error, success, expired-token, `401`, `403`, empty Store list and Store-switch reconciliation states.

- [ ] **Step 2: Implement typed auth/store API clients**

Use the existing frontend conventions and credentials-aware requests. Do not duplicate password, token or permission logic in the browser.

- [ ] **Step 3: Implement auth forms and verification states**

Render only the flows in the approved spec. Preserve safe form state after session expiry where possible.

- [ ] **Step 4: Implement Store onboarding/switch/invitation states**

After Store switch, invalidate all Store-scoped queries. Hide unauthorized actions based on server capabilities and retain explicit access-denied states.

- [ ] **Step 5: Run frontend verification**

Run:

```bash
pnpm --filter @commerce/web test
pnpm --filter @commerce/web typecheck
pnpm --filter @commerce/web lint
pnpm build
```

- [ ] **Step 6: Commit frontend flows**

```bash
git add apps/web
git commit -m "feat: add auth and store onboarding flows"
```

## Task 9: Add Audit, Security and End-to-End Hardening

**Files:**
- Create: `apps/api/src/audit/audit.service.ts`
- Create: `apps/api/src/audit/audit.module.ts`
- Create: `apps/api/src/audit/audit.repository.ts`
- Modify: `apps/api/src/identity/application/identity.service.ts` - emit identity audit events.
- Modify: `apps/api/src/identity/application/recovery.service.ts` - emit recovery audit events.
- Modify: `apps/api/src/auth/application/session.service.ts` - emit session/auth audit events.
- Modify: `apps/api/src/stores/application/store.service.ts` - emit Store lifecycle audit events.
- Modify: `apps/api/src/stores/application/membership.service.ts` - emit membership audit events.
- Modify: `apps/api/src/stores/application/invitation.service.ts` - emit invitation audit events.
- Create: `apps/api/src/audit/audit.service.test.ts`
- Modify: `apps/api/test/auth-store-rbac.e2e-spec.ts`
- Modify: `apps/api/test/persistence.integration-spec.ts`
- Create: `apps/api/test/security.e2e-spec.ts`
- Create: `apps/api/test/concurrency.e2e-spec.ts`

**Interfaces:**
- Consumes: all critical Auth/Store/RBAC application services.
- Produces immutable audit records and complete critical-flow test coverage.

- [ ] **Step 1: Write failing audit tests**

Cover registration, verification, login failures, lockout, logout, password reset, email change, Store lifecycle, invitations, membership lifecycle and role changes.

- [ ] **Step 2: Implement audit persistence and service**

Write actor, Store, action, resource, timestamp, request ID and safe before/after data. Never persist passwords, raw tokens or cookies.

- [ ] **Step 3: Write failing security/concurrency tests**

Cover IDOR, broken access control, CSRF, brute force, account enumeration, token replay, duplicate invitation acceptance, concurrent final-Owner removal and concurrent membership/Store mutations.

- [ ] **Step 4: Add critical E2E scenarios**

Cover registration → verification → first Store → Owner session, login/recovery, invitation for new/existing User, Store switch, leave/remove, role change and deactivation/reactivation.

- [ ] **Step 5: Run complete subsystem verification**

Run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
docker compose -f infra/docker-compose.yml up -d --wait
pnpm test:integration
pnpm test:e2e
pnpm build
docker compose -f infra/docker-compose.yml down
```

Expected: all foundation and Auth/Store/RBAC tests pass; no Phase 0 health behavior regresses.

- [ ] **Step 6: Commit hardening**

```bash
git add apps/api/src/audit apps/api/test apps/web packages/config infra/postgres
git commit -m "test: harden auth store rbac flows"
```

## Task 10: Documentation and Completion Review

**Files:**
- Modify: `README.md`
- Modify: `infra/postgres/README.md`
- Modify: `docs/06-acceptance-and-development.md`
- Create: `docs/traceability/auth-store-rbac-traceability.md`

- [ ] **Step 1: Document local Auth configuration**

Document email adapter test mode, `.env` setup, migration commands, session cookie behavior and safe local recovery testing.

- [ ] **Step 2: Document API and permission matrix**

Document endpoint groups, status/error semantics, fixed-role capabilities, Store isolation and final-Owner protection.

- [ ] **Step 3: Write requirement traceability**

Map each approved BUS/REQ/EDGE/AC item to domain code, API/UI behavior and automated test names. Include deferred ADR choices and their final records.

- [ ] **Step 4: Run final verification from a clean checkout**

Run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Also verify Store isolation, no secret logging, no raw token persistence, migration rollback and a clean worktree.

- [ ] **Step 5: Commit documentation and completion review**

```bash
git add README.md infra/postgres/README.md docs/06-acceptance-and-development.md docs/traceability
git commit -m "docs: complete auth store rbac traceability"
```

## Plan Self-Review

- Spec coverage: identity, registration, verification, password policy, sessions, recovery, Store onboarding, membership, invitations, fixed roles, authorization, Store isolation, frontend states, audit, security tests and traceability each have assigned tasks.
- Scope check: this is one subsystem plan with independently testable domain, persistence, API, frontend and hardening deliverables; Products, Orders, Inventory and Dashboard business behavior are excluded.
- Placeholder scan: no `TBD`, `TODO`, `FIXME`, “appropriate error handling” or undefined “write tests” step is used. ADR Task 1 resolves implementation choices before dependent code tasks.
- Type consistency: `PasswordHasher`, `EmailDelivery`, `RequestContext` and `authorizationService.can(context, permission, resourceStoreId)` are introduced before their consumers.
- Security consistency: global normalized email, opaque PostgreSQL sessions, hashed one-time tokens, Store-scoped authorization, final-Owner protection and safe audit data are repeated in the binding constraints and task tests.
