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

### Phase 0 Review

Phase 0 foundation verification was completed on Node.js `24.7.0` and pnpm
`10.14.0`. The clean-install quality gate passed:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The local infrastructure lifecycle was also repeated twice using Docker
Compose: start with `up -d --wait`, run `pnpm infra:migrate`,
`pnpm infra:verify`, and `pnpm infra:rollback`, then stop with `down`. Both
runs reached healthy PostgreSQL and Redis services, applied the empty baseline
idempotently, passed verification, rolled back cleanly, and left no containers
running. Docker is a local prerequisite; `.env.example` must be copied to
`.env` for local development.

The Phase 0 scope remains protected: there are no business tables, business
endpoints, dashboard widgets, authentication flow, external credentials, or
domain mutation logic. Generated TypeScript build metadata (`*.tsbuildinfo`)
and build output remain ignored.

The next plan boundary is **Authentication and Store Membership**, including
fixed-role RBAC. Product, inventory, order, payment, customer, channel,
livestream, analytics, and dashboard work remains deferred to later plans.

Task 1 workspace discovery verification:

```text
pnpm install
pnpm --filter @commerce/tsconfig exec tsc --version
pnpm turbo run typecheck --dry
```
