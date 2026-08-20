# Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the minimal, verifiable monorepo foundation for Commerce Control Center without implementing business modules.

**Architecture:** Use a Turborepo + pnpm monorepo with `apps/web`, `apps/api`, and focused shared packages. The API and worker runtime boundaries are established now, while business contexts, database entities, API endpoints, and UI features are deferred to later plans.

**Tech Stack:** Turborepo, pnpm, Next.js, React, TypeScript, NestJS, PostgreSQL, Redis, BullMQ, Docker Compose, GitHub Actions, Vitest for packages/web tests, Jest for NestJS tests, Playwright-ready test configuration.

**Spec:** `docs/superpowers/specs/2026-08-20-commerce-control-center-design.md`

## Global Constraints

- Use a modular monolith with independently deployable API and worker processes.
- Use Turborepo + pnpm.
- Use NestJS for the backend.
- Use PostgreSQL as the transactional database.
- Use Redis + BullMQ for background jobs.
- Do not implement Product, Inventory, Order, Payment, Customer, Channel, Livestream, Analytics or Dashboard business behavior in Phase 0.
- Do not create business database tables in Phase 0; only establish migration infrastructure and a verifiable empty baseline.
- Keep all configuration validated at process startup; never commit secrets.
- Every task must leave the repository installable, typecheckable and testable.
- Do not add compatibility layers or duplicate package managers.

## File Map

### Repository files

- Create: `package.json` - root scripts and package manager declaration.
- Create: `pnpm-workspace.yaml` - workspace package globs.
- Create: `turbo.json` - task dependency and cache pipeline.
- Create: `.gitignore` - dependency, build, environment and local infrastructure exclusions.
- Create: `.nvmrc` - the active LTS Node version selected during repository initialization and recorded in `README.md`.
- Create: `README.md` - local setup, verification commands and Phase 0 scope.

### Applications

- Create: `apps/web/package.json` - web application dependencies and scripts.
- Create: `apps/web/tsconfig.json` - strict TypeScript configuration extending shared config.
- Create: `apps/web/next.config.ts` - minimal Next.js configuration.
- Create: `apps/web/app/layout.tsx` - root layout without product UI.
- Create: `apps/web/app/page.tsx` - foundation placeholder page only.
- Create: `apps/web/app/page.test.tsx` - render smoke test.
- Create: `apps/api/package.json` - API application dependencies and scripts.
- Create: `apps/api/tsconfig.json` - strict TypeScript configuration.
- Create: `apps/api/src/main.ts` - NestJS bootstrap and validated configuration startup.
- Create: `apps/api/src/app.module.ts` - root module with health module only.
- Create: `apps/api/src/health/health.module.ts` - health boundary.
- Create: `apps/api/src/health/health.controller.ts` - `GET /health` endpoint.
- Create: `apps/api/src/health/health.controller.test.ts` - health endpoint test.
- Create: `apps/api/test/app.e2e-spec.ts` - API boot and health E2E test.

### Shared packages

- Create: `packages/config/package.json` - shared validated configuration package.
- Create: `packages/config/src/index.ts` - environment schema and typed config loader.
- Create: `packages/config/src/index.test.ts` - valid and invalid environment tests.
- Create: `packages/types/package.json` - shared transport-independent foundation types only.
- Create: `packages/types/src/index.ts` - health/status and request ID types; no business entities.
- Create: `packages/ui/package.json` - shared UI package scaffold without product components.
- Create: `packages/api-client/package.json` - API client package scaffold without domain endpoints.
- Create: `packages/utils/package.json` - utility package scaffold with no business logic.
- Create: `packages/tsconfig/package.json` - shared TypeScript presets.
- Create: `packages/tsconfig/base.json` - strict base compiler options.
- Create: `packages/tsconfig/nextjs.json` - web compiler preset.
- Create: `packages/tsconfig/nestjs.json` - API compiler preset.

### Infrastructure and CI

- Create: `infra/docker-compose.yml` - local PostgreSQL and Redis services only.
- Create: `infra/postgres/README.md` - local database lifecycle and migration commands.
- Create: `infra/postgres/migrations/0001_baseline.sql` - empty migration baseline with migration metadata only.
- Create: `infra/postgres/migrations/0001_baseline.down.sql` - safe baseline rollback.
- Create: `infra/postgres/migrate.mjs` - idempotent migration/rollback runner.
- Create: `infra/redis/README.md` - local Redis purpose and reset instructions.
- Create: `scripts/verify-infra.mjs` - PostgreSQL and Redis health/migration verification.
- Create: `.env.example` - non-secret configuration names and safe local defaults.
- Create: `.github/workflows/ci.yml` - install, lint, typecheck, unit test, integration test and build jobs.

## Task 1: Initialize the Monorepo Contract

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `README.md`
- Create: `packages/tsconfig/package.json`
- Create: `packages/tsconfig/base.json`
- Create: `packages/tsconfig/nextjs.json`
- Create: `packages/tsconfig/nestjs.json`

**Interfaces:**
- Produces workspace scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format:check`.
- Produces package manager contract: pnpm only, with the selected pnpm version pinned in `package.json`.
- Produces strict TypeScript presets consumed by every application and package.

- [ ] **Step 1: Select and record the runtime versions**

Select the active LTS Node version supported by the chosen Next.js and NestJS releases, pin it in `.nvmrc`, pin the matching pnpm version in `package.json`, and record both values in `README.md`. The same values must be used by CI.

- [ ] **Step 2: Write the repository contract checklist**

Document the required root scripts and workspace package globs in `README.md`, including the exact verification command:

```text
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

- [ ] **Step 3: Create root workspace metadata**

Define only the approved workspaces and configure Turborepo task dependencies so `build` depends on upstream package builds, while `lint`, `typecheck` and `test` can run per package.

- [ ] **Step 4: Add strict shared TypeScript presets**

Enable strict checking, no unchecked implicit behavior, consistent module resolution and declaration-compatible output. Keep framework-specific settings in `nextjs.json` and `nestjs.json` rather than duplicating them in application configs.

- [ ] **Step 5: Verify workspace discovery**

Run:

```bash
pnpm install
pnpm --filter @commerce/config exec tsc --version
pnpm turbo run typecheck --dry
```

Expected: pnpm resolves the workspace and Turbo prints tasks without missing-package errors.

- [ ] **Step 6: Commit the repository contract**

If the project has been initialized as a Git repository, commit only the Task 1 files:

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore .nvmrc README.md packages/tsconfig
git commit -m "chore: initialize monorepo contract"
```

## Task 2: Add Empty Web and API Applications

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/page.test.tsx`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.controller.test.ts`
- Create: `apps/api/test/app.e2e-spec.ts`

**Interfaces:**
- Produces web dev command on port 3000.
- Produces API dev command on port 4000.
- Produces `GET /health` returning `{ "status": "ok", "requestId": "..." }`.
- Produces a web foundation page with no product component or business interaction.

- [ ] **Step 1: Write the API health test**

Test that the health controller returns HTTP 200, status `ok`, and a non-empty request ID. Test the controller with a mocked request ID provider so the test does not depend on network state.

- [ ] **Step 2: Run the API test and verify failure**

Run:

```bash
pnpm --filter @commerce/api test -- health.controller.test.ts
```

Expected: FAIL because the API application and health controller do not exist yet.

- [ ] **Step 3: Implement the minimal health module**

Create the NestJS root module, health module and controller. Add request ID middleware/interceptor at the foundation boundary. Do not add auth, database repositories or domain modules.

- [ ] **Step 4: Write the web smoke test**

Test that the root page renders the foundation heading and does not require a network request. The test must not assert final dashboard copy or visual design.

- [ ] **Step 5: Implement the empty web application**

Create the root layout and a deliberately minimal foundation page. Do not create the application shell, sidebar, KPI cards or any product component in this task.

- [ ] **Step 6: Run application verification**

Run:

```bash
pnpm --filter @commerce/api test
pnpm --filter @commerce/web test
pnpm --filter @commerce/api build
pnpm --filter @commerce/web build
```

Expected: all tests pass and both applications build.

- [ ] **Step 7: Commit the application foundation**

```bash
git add apps packages/types packages/ui packages/api-client packages/utils
git commit -m "chore: add empty web and api apps"
```

## Task 3: Add Validated Environment Configuration

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/src/index.test.ts`
- Create: `.env.example`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/web/next.config.ts`
- Modify: `README.md`

**Interfaces:**
- Produces `loadApiConfig(env): ApiConfig`.
- `ApiConfig` includes `NODE_ENV`, `API_PORT`, `DATABASE_URL`, `REDIS_URL`, `SESSION_COOKIE_NAME` and `CORS_ORIGIN`.
- Invalid required values throw a startup-safe validation error.
- `.env.example` contains names only and no credentials.

- [ ] **Step 1: Write valid and invalid config tests**

Cover a valid development environment, missing `DATABASE_URL`, invalid `API_PORT`, invalid URL values and production mode requiring non-placeholder secret configuration.

- [ ] **Step 2: Run the config tests and verify failure**

Run:

```bash
pnpm --filter @commerce/config test
```

Expected: FAIL because the loader and schema are not implemented.

- [ ] **Step 3: Implement the typed config loader**

Use one schema definition in `packages/config/src/index.ts`. Return a typed object and never expose the raw environment object to application modules.

- [ ] **Step 4: Wire API startup validation**

Load API configuration before creating the NestJS application. On invalid configuration, fail startup with field names and safe validation messages, never secret values.

- [ ] **Step 5: Add the example environment file**

Document local PostgreSQL, Redis, API, web and session configuration names with safe local values. Confirm `.env*` secret files are ignored except `.env.example`.

- [ ] **Step 6: Run config and application checks**

Run:

```bash
pnpm --filter @commerce/config test
pnpm typecheck
pnpm build
```

Expected: PASS, with startup validation covered by tests.

- [ ] **Step 7: Commit configuration foundation**

```bash
git add packages/config .env.example apps/api/src/main.ts apps/web/next.config.ts README.md
git commit -m "chore: add validated environment configuration"
```

## Task 4: Add PostgreSQL and Redis Local Infrastructure

**Files:**
- Create: `infra/docker-compose.yml`
- Create: `infra/postgres/README.md`
- Create: `infra/postgres/migrations/0001_baseline.sql`
- Create: `infra/postgres/migrations/0001_baseline.down.sql`
- Create: `infra/redis/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces local PostgreSQL and Redis services addressable by the URLs in `.env.example`.
- Produces a repeatable migration command that applies and rolls back the empty baseline.
- Produces health checks for both services.
- Does not create any business tables.

- [ ] **Step 1: Write the infrastructure verification script/test**

Implement the test fixture in `scripts/verify-infra.mjs` so it verifies that PostgreSQL accepts a connection, Redis responds to `PING`, the baseline migration records once, and rollback removes only the migration record.

- [ ] **Step 2: Run the verification and verify failure**

Run:

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm infra:verify
```

Expected: FAIL before service definitions and migration runner exist.

- [ ] **Step 3: Define local services**

Configure non-production PostgreSQL and Redis containers with persistent named volumes, health checks and ports documented for local development. Do not put credentials in committed files beyond safe local defaults.

- [ ] **Step 4: Add the migration baseline**

Create `infra/postgres/migrate.mjs` with `up` and `down` commands, a migration metadata table and an empty baseline migration. The baseline must be safe to apply twice and safe to roll back once. Do not add users, stores, products, orders or any other business schema yet.

- [ ] **Step 5: Add service documentation**

Document start, stop, reset and migration commands. State clearly that local containers are not a production deployment design.

- [ ] **Step 6: Run infrastructure verification**

Run:

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm infra:migrate
pnpm infra:verify
docker compose -f infra/docker-compose.yml down
```

Expected: services become healthy, migration is idempotent, verification passes, and containers stop cleanly.

- [ ] **Step 7: Commit local infrastructure**

```bash
git add infra README.md
git commit -m "chore: add local postgres and redis infrastructure"
```

## Task 5: Add CI Quality Gates

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces CI jobs for install, lint, typecheck, unit tests, integration tests and build.
- Produces a separate critical E2E job that can start API/web and required local services.
- Uses the same commands developers run locally.

- [ ] **Step 1: Add the CI command contract to README**

Document the exact local equivalents for every CI job and the required service startup command for integration tests.

- [ ] **Step 2: Create the workflow**

Use a pinned Node and pnpm setup consistent with repository metadata. Cache pnpm dependencies. Run jobs in dependency order and fail the workflow on any lint, typecheck, test or build error.

- [ ] **Step 3: Add integration service lifecycle**

Start PostgreSQL and Redis using the repository compose file for integration tests. Ensure the workflow waits for health checks before running tests and always tears services down.

- [ ] **Step 4: Add the critical E2E gate**

Run only the foundation health flow in Phase 0: API boots, `GET /health` succeeds, web boots and the root page renders. Do not add business E2E cases before their domain plans exist.

- [ ] **Step 5: Run the complete local quality gate**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Expected: all commands pass from a clean install with local services available where required.

- [ ] **Step 6: Commit CI configuration**

```bash
git add .github/workflows/ci.yml package.json README.md
git commit -m "ci: add phase zero quality gates"
```

## Task 6: Phase 0 Completion Review

**Files:**
- Modify: `README.md`
- Modify: `README.md` - record Phase 0 verification and the next plan boundary.

- [ ] **Step 1: Run the complete verification from a clean checkout**

Run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

- [ ] **Step 2: Verify infrastructure reset and repeatability**

Run the documented container start, migration, verification, rollback and stop sequence twice. Expected: the second run produces the same healthy state without duplicate migration or leaked data.

- [ ] **Step 3: Confirm scope protection**

Review the tree and confirm Phase 0 contains no business database tables, business API endpoints, dashboard widgets, authentication flow, external credentials or domain mutation logic.

- [ ] **Step 4: Update the foundation README**

Record the successful verification commands, the selected Node and pnpm versions, known local prerequisites and the next plan boundary: Authentication and Store Membership.

- [ ] **Step 5: Commit the Phase 0 review**

```bash
git add README.md
git commit -m "docs: complete phase zero foundation review"
```

## Later Plans

This plan intentionally stops at foundation. Create separate plans in this order so each subsystem remains independently testable:

1. Authentication, Store Membership and fixed-role RBAC.
2. Design system and application shell.
3. Catalog and Product/SKU management.
4. Global Inventory, reservations and safety-buffer publication.
5. Orders, payments, refunds and customer workflows.
6. TikTok, Shopee and Website channel integrations.
7. Sync, webhook recovery and notifications.
8. Dashboard analytics read models and polling UI.
9. Active livestream snapshot and control-room transition.
10. Production hardening, security, load testing and deployment.

## Plan Self-Review

- Spec coverage: Phase 0 tasks cover repository, environment, PostgreSQL/migration, Redis, CI and foundation acceptance gates from the approved specification. Business contexts are intentionally assigned to later plans.
- Placeholder scan: no `TBD`, `TODO`, `FIXME` or unspecified implementation step is used.
- Type consistency: the only cross-package foundation interface is `loadApiConfig(env): ApiConfig`; business types are explicitly excluded until their plans define them.
- Scope check: this is one independently testable foundation plan, not a combined implementation plan for all product modules.
