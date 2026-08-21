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
- `pnpm format:check`

### Environment

Copy `.env.example` to `.env` for local development. The API validates its environment before NestJS starts; keep local credentials in `.env`, which is ignored by Git.

### Verification

```text
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Task 1 workspace discovery verification:

```text
pnpm install
pnpm --filter @commerce/tsconfig exec tsc --version
pnpm turbo run typecheck --dry
```
