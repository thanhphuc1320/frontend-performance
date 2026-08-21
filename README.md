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

Copy `.env.example` to `.env` for local development. The API validates its environment before NestJS starts; keep local credentials in `.env`, which is ignored by Git.

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
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d --wait
set -a
. ./.env
set +a
pnpm --filter @commerce/api dev > /tmp/commerce-api.log 2>&1 &
echo $! > /tmp/commerce-api.pid
pnpm --filter @commerce/web dev > /tmp/commerce-web.log 2>&1 &
echo $! > /tmp/commerce-web.pid
for attempt in {1..30}; do
  curl --fail --silent http://127.0.0.1:4000/health && break
  sleep 2
done
curl --fail --silent http://127.0.0.1:4000/health
for attempt in {1..30}; do
  curl --fail --silent http://127.0.0.1:3000/ && break
  sleep 2
done
curl --fail --silent http://127.0.0.1:3000/ | grep -q "Foundation"
pnpm test:e2e
terminate_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    terminate_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}
if [ -f /tmp/commerce-api.pid ]; then terminate_tree "$(cat /tmp/commerce-api.pid)"; fi
if [ -f /tmp/commerce-web.pid ]; then terminate_tree "$(cat /tmp/commerce-web.pid)"; fi
docker compose -f infra/docker-compose.yml down -v
```

The API command uses the variables exported from `.env` and listens on port
`4000`; the web command listens on port `3000`. Record each background process
ID immediately after starting it, as in the CI workflow. The `terminate_tree`
function kills each launcher and all descendants after the probes and E2E
command, then the Compose cleanup command removes the required services.

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
