# Local PostgreSQL

PostgreSQL runs locally through `infra/docker-compose.yml` on loopback port `55432`, using the database `commerce` and the safe local password in `.env.example`. The non-default host port avoids collisions with an existing local PostgreSQL installation. The committed defaults are for local development only and are not production credentials.

The password-auth setup uses the explicitly new `commerce-postgres-auth-data` volume, so it cannot reuse the previous `infra_commerce-postgres-data` trust-auth volume. A normal `docker compose -f infra/docker-compose.yml down -v` resets the current auth volume; remove the old volume separately only after confirming it is no longer needed.

```bash
docker compose -f infra/docker-compose.yml up -d postgres
pnpm infra:migrate
pnpm infra:rollback
docker compose -f infra/docker-compose.yml down
docker compose -f infra/docker-compose.yml down -v
```

The final command resets the local database volume.

## Migrations

The Auth/Store/RBAC subsystem introduced four migrations:

| Migration | Purpose | Key objects |
|---|---|---|
| `0001_baseline` | Empty Phase 0 baseline | No business tables |
| `0002_auth_store_rbac` | Users, sessions, tokens, Stores, roles, permissions, memberships, invitations | `users`, `sessions`, `email_tokens`, `stores`, `roles`, `permissions`, `role_permissions`, `store_memberships`, `invitations`; seed data for 6 fixed roles and 24 permissions; `prevent_final_owner_change()` trigger; `prevent_store_hard_delete()` trigger |
| `0003_store_onboarding_idempotency` | Idempotency key for first-Store creation | `stores.onboarding_idempotency_key` with partial unique index |
| `0004_audit` | Audit log table | `audit_logs` with actor, store, action, resource, before/after JSONB |

### Rollback

Each migration has a paired `.down.sql` file consumed by the migration runner:

```bash
pnpm infra:rollback   # rolls back one migration
pnpm infra:migrate    # re-applies forward
```

Down migrations are safe for local development and test cleanup only. Production deployments are forward-only.

### Table descriptions

- `users` — global identity. `email_normalized` is globally unique and lowercased. Status enum: `UNVERIFIED`, `ACTIVE`, `TEMPORARILY_LOCKED`, `DISABLED`.
- `sessions` — opaque session records. `session_hash` is SHA-256 of the raw token. Idle expiry (24h) and absolute expiry (30d) are enforced by the application.
- `email_tokens` — single-use hashed tokens for verification, password reset, email change and invitations. Consumed or revoked tokens are rejected.
- `stores` — tenant boundary. `status` is `ACTIVE` or `DEACTIVATED`. Hard-delete is blocked by trigger.
- `roles` — fixed system roles (`OWNER`, `ADMIN`, `STAFF`, `WAREHOUSE`, `CUSTOMER_SUPPORT`, `ANALYST`). `is_system` is always `true`.
- `permissions` — fixed permission catalog (24 codes).
- `role_permissions` — many-to-many mapping seeded in `0002`.
- `store_memberships` — user membership in a Store with a role. Status enum: `INVITED`, `ACTIVE`, `SUSPENDED`, `LEFT`, `REMOVED`. Final-Owner changes are blocked by trigger.
- `invitations` — pending invitations with hashed token and 7-day expiry.
- `audit_logs` — append-only audit records with automatic redaction of secret fields in application layer.

All monetary values, inventory and order data remain deferred to later migrations.
