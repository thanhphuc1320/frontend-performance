# Local PostgreSQL

PostgreSQL runs locally through `infra/docker-compose.yml` on port `55432`, using the database `commerce`. The non-default host port avoids collisions with an existing local PostgreSQL installation. The committed defaults are for local development only and are not production credentials.

```bash
docker compose -f infra/docker-compose.yml up -d postgres
pnpm infra:migrate
pnpm infra:rollback
docker compose -f infra/docker-compose.yml down
docker compose -f infra/docker-compose.yml down -v
```

The final command resets the local database volume. Migrations are intentionally empty in Phase 0: no business tables are created. This compose setup is not a production deployment design.
