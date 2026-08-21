# Local Redis

Redis runs locally through `infra/docker-compose.yml` on port `56379` and is addressable as `redis://127.0.0.1:56379`.

```bash
docker compose -f infra/docker-compose.yml up -d redis
docker compose -f infra/docker-compose.yml down
docker compose -f infra/docker-compose.yml down -v
```

The volume reset removes local Redis data. This container is for development and verification only; it is not a production deployment design.
