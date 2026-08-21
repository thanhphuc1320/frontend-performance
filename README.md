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

Task 1 workspace discovery verification:

```text
pnpm install
pnpm --filter @commerce/tsconfig exec tsc --version
pnpm turbo run typecheck --dry
```
