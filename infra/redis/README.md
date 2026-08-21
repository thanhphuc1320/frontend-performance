# Local Redis

Redis runs locally through `infra/docker-compose.yml` on loopback port `56379` and requires the safe local password in `.env.example`. It is addressable as `redis://:commerce_local@127.0.0.1:56379`.

Redis data uses the explicitly named `commerce-redis-auth-data` volume. Use `docker compose -f infra/docker-compose.yml down -v` to reset it.

```bash
docker compose -f infra/docker-compose.yml up -d redis
docker compose -f infra/docker-compose.yml down
docker compose -f infra/docker-compose.yml down -v
```

The volume reset removes local Redis data. This container is for development and verification only; it is not a production deployment design.
