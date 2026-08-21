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

The final command resets the local database volume. Migrations are intentionally empty in Phase 0: no business tables are created. This compose setup is not a production deployment design.
