# Local development

## Demo sign-in

Enter a username and the shared access secret `chat-demo-2026`. The server keeps
the demo constant in `server/src/auth.ts`; it is not bundled into the frontend.
Usernames use 3–32 ASCII letters, numbers, or underscores and are trimmed and
lowercased. First login creates the user; later logins reuse it.

This intentionally does not prove ownership of a username: anyone who knows the
shared secret can use any username. It is a local assessment demo, not individual
password authentication. Login rate limiting is not implemented yet.

Authentication uses a seven-day HMAC-SHA256 signed cookie containing the user ID,
username, and expiry (a signed payload, not a JWT). No sessions table is needed;
`/api/auth/me` verifies the signature and expiry without a database lookup. The
cookie remains HttpOnly and SameSite=Strict. Set `COOKIE_SECURE=true` over HTTPS.
Login still queries the users table. Profile changes or deleted users are not
reflected in an existing token until it expires or the user signs in again.

Generate a private signing key with `openssl rand -hex 32` and set
`AUTH_SIGNING_SECRET` in the root `.env` for Compose, or `server/.env` for local
server execution. Keep the same key across restarts and server instances. Never
use the shared demo login secret as this key. Changing it invalidates all tokens.
Logout only clears the browser cookie; a copied token remains valid until expiry.

The removal migration drops only the sessions table and invalidates previous
sessions; existing users and messages remain. The earlier migration is preserved
so already-deployed migration histories stay consistent.

The API exposes `POST /api/auth/login` (`{ username, secret }`),
`GET /api/auth/me`, and `POST /api/auth/logout`. Successful sign-in currently opens
a welcome screen; the messaging interface is a separate next step.

## Running the app

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
