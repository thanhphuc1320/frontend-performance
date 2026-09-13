# Commerce Control Center

## Foundation Contract

This repository is a pnpm-only Turborepo monorepo. Phase 0 establishes repository configuration only; business modules, database tables, API endpoints, UI components and authentication are deferred to later tasks.

### Runtime

- Node.js: `24` (active LTS)
- pnpm: `10.14.0`

Use Node 24 and pnpm 10.14.0 locally and in CI. The versions are pinned by `.nvmrc` and the root `package.json` `packageManager` field.

### Workspaces

- `apps/*`
- `packages/*`

The approved shared foundation package is `packages/tsconfig`.

### Root Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm test:integration`
- `pnpm format:check`

### Environment

Copy `.env.example` to `.env` for local development. API startup and the
`infra:migrate`, `infra:rollback`, and `infra:verify` scripts automatically load
the repository `.env` when it exists. Values already exported in the shell are
preserved, and the loader never prints environment values. The API validates
its environment before NestJS starts; keep local credentials in `.env`, which
is ignored by Git.

Authentication configuration is documented in `docs/adr/0001-auth-security-and-persistence.md`. The example file uses in-memory email capture for local development and tests, so no messages are sent; tests inspect captured typed payloads through the delivery port. Do not add `SMTP_URL` or `CSRF_SECRET` to `.env.example`. Production must provide SMTP delivery, a valid `EMAIL_FROM`, and deployment-managed `SMTP_URL` and `CSRF_SECRET`; invalid production settings fail before NestJS startup.

### Auth / Store / RBAC Local Setup

The Auth subsystem uses the same `.env` file and PostgreSQL services. After copying `.env.example` to `.env`:

1. Start PostgreSQL: `docker compose -f infra/docker-compose.yml up -d postgres`
2. Apply migrations: `pnpm infra:migrate`

Migrations are forward-only in deployment; each migration has a paired safe down migration for local/test rollback (`pnpm infra:rollback`). See `infra/postgres/README.md` for migration details.

**Email adapter test mode:** `EMAIL_DELIVERY_MODE=memory` in `.env` captures typed email payloads in-process. No messages are sent. Tests assert recipient, template data and action URL through the memory adapter's captured messages. The frontend can read the test action URL from the same adapter in E2E tests.

**Session cookie behavior:** The API sets two cookies on login:
- `commerce_session` — opaque session identifier, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production.
- `csrf_token` — non-`HttpOnly` double-submit token, required in the `X-CSRF-Token` header for all mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`).

Safe methods (`GET`, `HEAD`) do not require the CSRF header. Session idle timeout is 24 hours, absolute lifetime is 30 days. The session is extended on every authenticated request up to the absolute limit.

**Safe local recovery testing:** Password-reset and email-change tokens expire after 1 hour. To test recovery flows locally, either:
- Use the captured action URL from the memory adapter in tests, or
- Temporarily reduce `AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS` / `AUTH_EMAIL_CHANGE_TOKEN_TTL_SECONDS` in local `.env` (never commit this change).

All tokens are single-use SHA-256 hashes; raw tokens are never persisted. Never log or screenshot URLs containing `token=` query parameters.

### Local Infrastructure

Docker is required for the local PostgreSQL and Redis services. Copy `.env.example` to `.env`, then start both services with `docker compose -f infra/docker-compose.yml up -d`; they bind authenticated services to loopback ports `55432` and `56379` and use named local volumes. Apply the empty migration baseline with `pnpm infra:migrate`, roll it back with `pnpm infra:rollback`, and verify both services with `pnpm infra:verify`. Stop services with `docker compose -f infra/docker-compose.yml down`; add `-v` to reset local data. These containers and credentials are for local development only and are not a production deployment design.

### Verification

The CI quality gates use these same local commands:

```text
pnpm install
pnpm lint
pnpm typecheck
pnpm test
docker compose -f infra/docker-compose.yml up -d --wait
pnpm test:integration
docker compose -f infra/docker-compose.yml down
pnpm test:e2e
pnpm build
```

The integration test command requires the authenticated local PostgreSQL and
Redis services to be running. CI starts those services with the repository
compose file and waits for their health checks before running the command. The
critical foundation E2E gate additionally boots the API on port `4000` and the
web app on port `3000`, then verifies `GET /health` and the root page. It does
not include business E2E cases.

To run that foundation E2E flow locally with the same commands as CI:

```text
pnpm build
set -Eeuo pipefail
api_pid=''
web_pid=''
web_response_file=''
terminate_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    terminate_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}
cleanup() {
  local status=$?
  trap - EXIT
  set +e
  if [ -n "$api_pid" ]; then terminate_tree "$api_pid"; fi
  if [ -n "$web_pid" ]; then terminate_tree "$web_pid"; fi
  if [ -n "$web_response_file" ]; then rm -f "$web_response_file"; fi
  docker compose -f infra/docker-compose.yml down -v
  if [ -f /tmp/commerce-api.log ]; then tail -n 100 /tmp/commerce-api.log; fi
  if [ -f /tmp/commerce-web.log ]; then tail -n 100 /tmp/commerce-web.log; fi
  exit "$status"
}
trap cleanup EXIT
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d --wait
pnpm --filter @commerce/api dev > /tmp/commerce-api.log 2>&1 &
api_pid=$!
pnpm --filter @commerce/web dev > /tmp/commerce-web.log 2>&1 &
web_pid=$!
web_response_file=$(mktemp)
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:4000/health; then break; fi
  sleep 2
done
curl --fail --silent http://127.0.0.1:4000/health
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:3000/; then break; fi
  sleep 2
done
curl --fail --silent --output "$web_response_file" http://127.0.0.1:3000/
grep -qi "Foundation" "$web_response_file"
pnpm test:e2e
```

The API command automatically loads `.env` and listens on port `4000`; the web
command listens on port `3000`. Keep startup, readiness, E2E, and cleanup in one
shell so the background processes remain owned by the controlled lifecycle.
The exception-safe `cleanup` trap kills each launcher and all descendants, then
the Compose cleanup command removes the required services even after a failure.

### Auth / Store / RBAC Completion Review

The Auth, Store Membership and fixed-role RBAC subsystem was implemented across
Tasks 1-9 and verified in Task 10. The clean-install quality gate passed:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The implemented scope includes:

- **Identity:** email normalization, Argon2id password hashing, Have I Been Pwned
  compromised-password checking, login lockout after 5 failed attempts.
- **Registration and verification:** user creation with `UNVERIFIED` status,
  single-use SHA-256 verification tokens (24h expiry), email verification before
  Store creation.
- **Sessions:** opaque PostgreSQL session records with SHA-256 hashed tokens,
  24h idle / 30d absolute expiry, CSRF double-submit protection, secure cookie
  settings.
- **Recovery:** password-reset and email-change tokens (1h expiry), session
  revocation on completion.
- **Store onboarding:** first-Store creation with idempotency key, transactional
  Store + Owner membership creation.
- **Membership:** fixed roles (`OWNER`, `ADMIN`, `STAFF`, `WAREHOUSE`,
  `CUSTOMER_SUPPORT`, `ANALYST`), invitation lifecycle (7-day tokens), accept/
  suspend/remove/leave/role-change flows.
- **Authorization:** Store-scoped permission checks, `AuthGuard` + `PermissionGuard`,
  capabilities endpoint for frontend permission awareness.
- **Store isolation:** backend-enforced Store boundary on every request; cross-Store
  access returns generic `403` with no metadata leakage.
- **Final-Owner protection:** database trigger + application-level advisory-lock
  pattern prevents the final Owner from being removed, suspended or downgraded.
- **Audit:** `audit_logs` table with actor, action, resource, before/after data;
  automatic redaction of password, token, hash, secret and cookie fields.

Excluded scope (deferred to later plans): Products, Orders, Inventory, Channels,
Payments, Customers, Livestream, Analytics, Dashboard and Notifications.

Task 1 workspace discovery verification:

```text
pnpm install
pnpm --filter @commerce/tsconfig exec tsc --version
pnpm turbo run typecheck --dry
```
