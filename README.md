# Local development

Set `POSTGRES_PASSWORD` in the root `.env` (see `.env.example`), then run:

```sh
docker compose up --build
```

Compose automatically loads `compose.override.yaml`. It mounts the backend source
and runs `tsx watch`, so saving files in `server/src` restarts the backend without
rebuilding the image. The server is available at http://localhost:3000.
Dependencies and generated Prisma code stay inside the container.

After changing backend dependencies or frontend code, rebuild:

```sh
docker compose up --build -d server
```

After editing `server/prisma/schema.prisma`, create the migration in the running
development container. The mounted Prisma directory saves it on your host:

```sh
docker compose exec server npm run db:migrate -- --name describe_change
docker compose restart server
```

Restarting regenerates Prisma Client and applies pending migrations before starting
the watcher. See [database integrity notes](server/prisma/README.md) for custom SQL
constraints that must be preserved in migrations.

To run the deployment configuration without development mounts or the watcher,
explicitly select the base file:

```sh
docker compose -f compose.yaml up --build -d
```
