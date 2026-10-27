# Little Chat

A local, full-stack one-to-one messaging project.
React renders the UI, Express handles HTTP requests, PostgreSQL stores users and
messages through Prisma, and Socket.IO delivers live updates. No external SaaS
service is required.

## Coding styles

Follows principle of proximity by grouping related codes together. Easier to manage and understand.

## How it works
- For simplicity on Auth flow, a hardcoded `chat-demo-2026` as the access secret. On login page, user need to key in user id (3–32 letters, numbers, or underscores. Case insensitive) and demo access secret to login.
- if it is a new user it create a user and save to DB
- if it is a existing user, log in the user
- Once login, user can see full list of existing user on the side bar and click on the user name to start chatting.

### Note
the .env.sample should contains working env. it is not supposed happend in Prod. For the ease of setup, working envs are saved in .env.example

## Run with Docker

Requires Docker with Compose. From the project root:

1. Copy `server/.env.example` to `server/.env` if you do not already have one.
2. Copy `.env.example` to `.env` if you do not already have one.
3. Start the base configuration:

```sh
docker compose --env-file server/.env -f compose.yaml up --build
```

Open http://localhost:3000. This command builds the frontend into the server image,
generates Prisma Client, waits for PostgreSQL to become healthy, applies pending
migrations, and starts the server. Explicitly selecting `compose.yaml` skips the
local development override. PostgreSQL data persists in the `postgres_data` volume.
The database port is not exposed to the host.

Sign in with a username and the demo access secret **`chat-demo-2026`**. Use a second
browser profile or an incognito window to sign in as another user; ordinary tabs
share the same cookie. Select the other user in the sidebar and send a message.

## Local development

Local frontend development requires Node.js 22.23.4 or newer and npm.

The automatically loaded `compose.override.yaml` mounts backend source and Prisma
files for local development. The frontend build remains in the server image, so
you do not need to build it separately on the host.

```sh
docker compose --env-file server/.env up --build
```

Backend source edits restart the server through `tsx watch`. To update the frontend
served at port 3000, rebuild the server image with `docker compose --env-file
server/.env up --build` and refresh the browser. Rebuild the server image after
changing backend or frontend dependencies.

For frontend hot reload, run in another terminal:

```sh
npm --prefix app run dev
```

Open the URL printed by Vite (normally http://localhost:5173). Vite proxies `/api`
and `/socket.io` to port 3000, including WebSocket upgrades. Restart Vite after
changing its proxy configuration.

### Environment files

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER` | Compose database name and initial user; default to `chat_app` |
| `POSTGRES_PASSWORD` | Required by Compose for database initialization and the server connection URL |
| `AUTH_SIGNING_SECRET` | Private HMAC signing key; required by the backend |
| `COOKIE_SECURE` | `false` for local HTTP; set to `true` when serving over HTTPS |
| `CLIENT_ORIGIN` | Allowed configured browser origin; Compose defaults to `http://localhost:3000` |
| `DATABASE_URL` | Required for local backend/database commands; Compose constructs it using hostname `db` |
| `PORT` | Backend port; Compose uses `3000` |

Compose normally reads a project-root `.env` for `${...}` interpolation. Pass
`--env-file server/.env` to make Compose use the server's environment file instead,
so one file can provide values to Compose and direct server commands. Compose's
`env_file:` service option is different: it only injects variables into a container
and does not provide values for `${...}` interpolation in the Compose YAML. The
server service already maps the required variables explicitly. Do not commit
`server/.env`. Changing PostgreSQL initialization variables does not change
credentials already stored in an existing database volume.

To run the backend outside Docker, install its dependencies, configure
`server/.env`, and run the following from `server/` against a reachable PostgreSQL
instance. The supplied Compose database is not reachable through localhost unless
you explicitly publish its port.

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

## Implemented behavior

- `/signin` combines registration and login. Usernames are trimmed, lowercased,
  unique, and limited to 3–32 ASCII letters, numbers, or underscores.
- `/chat` lists other registered users with a local search field.
- `/chat/:id` selects a **user ID**, keeps the sidebar visible, and shows that
  user's direct conversation with the signed-in user.
- The first message creates the direct conversation and both memberships.
- Messages are trimmed, limited to 4,000 characters, and persisted before broadcast.
  History loads the latest 100 messages in chronological order.
- Header/logout and footer stay visible while the message area scrolls.

### Authentication

The backend compares the submitted access secret against the demo constant in
`server/src/auth/login.ts`, then finds or creates the user. Anyone who knows this
shared secret can sign in as any username: this is deliberately demo access, not
individual account ownership.

The `chat_session` cookie contains a Base64URL payload and HMAC-SHA256 signature.
It includes the user ID, username, and seven-day expiry. It is **signed, not encrypted,
and is not a JWT**. The cookie is HttpOnly and SameSite=Strict; its Secure flag is
controlled by `COOKIE_SECURE`.

On full page load, `/api/auth/me` verifies the signature and expiry without querying
the database, and the frontend restores the profile into an in-memory Zustand store.
Protected chat HTTP requests and socket handshakes also check that the user exists
in the database. The backend derives the sender from the cookie, not request data.

Logout clears the browser cookie and the frontend disconnects its socket. There is
no sessions table or per-token revocation: a copied token remains valid until
expiry. Rotating the signing key invalidates all tokens. Use the same key across
restarts. Embedded profile information may become stale until a new token is issued.

### Live updates and caching

TanStack Query caches users and messages. Zustand holds authentication UI state;
the URL holds the selected user. Neither frontend cache is persistent across a
full refresh.

The chat layout opens one authenticated Socket.IO connection using WebSocket
transport, with no HTTP polling fallback. Initial chat queries mount after the
connection is ready, avoiding a fetch followed immediately by another connect-time
fetch. Reconnection invalidates chat queries and refetches active data to recover
missed events.

| Socket event | Behavior |
| --- | --- |
| `users:changed` | Emitted after successful login/upsert, including existing-user logins; clients refetch the users query |
| `messages:changed` | Contains the saved message and peer user ID; delivered only to the two participants' connected clients |
| `auth:expired` | Server notifies and disconnects a socket whose cookie has expired; frontend returns to sign-in |

Both the send response and socket message update the message cache directly.
Messages are deduplicated by ID, sorted, and capped at 100. Receiving a message
does not trigger another history GET. Sends have no automatic retry, because a
lost response could otherwise create duplicate messages.

The server validates socket origins and authentication. It checks connected cookie
expiry every second and validates cookies before emitting updates. HTTP endpoints
still enforce conversation membership. Deployment reverse proxies must forward
WebSocket upgrades. A connection banner appears while live updates are unavailable;
the initial chat view waits for a successful connection.

## API

| Method | Endpoint | Input / result |
| --- | --- | --- |
| POST | `/api/auth/login` | JSON `{ username, secret }`; returns `{ user }` and sets the cookie |
| GET | `/api/auth/me` | Returns `{ user }`, or 401 for invalid/expired cookies |
| POST | `/api/auth/logout` | Clears the cookie; returns 204 |
| GET | `/api/chat/users` | Returns `{ users }`, excluding the authenticated user |
| GET | `/api/chat/users/:id/messages` | Returns `{ messages }` for the selected peer |
| POST | `/api/chat/users/:id/messages` | JSON `{ content }`; returns `{ message }` with status 201 |

All chat endpoints require authentication. Message endpoints reject self-chat,
malformed user IDs, nonexistent users, and unauthorized conversation access.

## Project structure

```text
app/src/
  components/       Shared Button, Input, Textarea, and PageLayout
  lib/auth/         Auth API, query keys, and individual auth hooks
  pages/Signin/     Sign-in UI and styles
  pages/Chat/       Chat API, cache helpers, sidebar, route definitions, hooks
    Conversation/   Conversation UI and nested routes
  store/            Zustand authentication store
server/src/
  auth/             Separate login, current-user, and logout handlers
  chat/             User/message handlers and peer validation
  middleware/       Protected API authentication
  utils/            Signed-token helpers and cookie settings
  web-socket/       Socket.IO setup and in-process notification bus
server/prisma/      Schema and versioned SQL migrations
```

Code follows proximity: feature-specific APIs, hooks, styles, and helpers live with
their consumers. Shared controls and authentication live higher in the tree. Tests
are colocated in backend feature `tests/` folders.

## Database and migrations

The current models are `User`, `Conversation`, `ConversationMember`, and `Message`.
Direct conversations use a unique sorted pair of user IDs. SQL checks and deferred
triggers enforce exactly those two memberships. Composite foreign keys require
message senders to be members and read pointers to reference the same conversation.

The historical session-creation migration is followed by a removal migration.
Keep both so already-applied migration histories remain consistent. The removal
migration drops only the sessions table, not users or messages.

After changing the schema, create a migration in the development container:

```sh
docker compose --env-file server/.env exec server npm run db:migrate -- --name describe_change
docker compose --env-file server/.env restart server
```

The mounted Prisma directory saves migration files on the host. Commit those files
with the schema. `db:migrate` creates development migrations; `db:deploy` applies
existing ones. Container startup runs `db:deploy`, and the development startup also
regenerates Prisma Client. Generated client code is Git-ignored.

Use migrations rather than `prisma db push`: the custom SQL triggers/checks are not
fully represented in the Prisma schema. See [database integrity notes](server/prisma/README.md).

## Validation

Install dependencies in both projects and generate Prisma Client first. From the
project root:

```sh
npm --prefix server ci
npm --prefix server run db:generate
npm --prefix server run typecheck
npm --prefix server test
npm --prefix app ci
cd app
npx tsc --noEmit
npm run build
```

Backend tests cover authentication and token expiry/tampering, chat input and
membership validation, chronological history, concurrent conversation creation,
and notification routing. HTTP tests use a local test listener with mocked Prisma
calls. Socket tests mock the transport boundary and database;
they do not test actual WebSocket networking, browser reconnection, or SQL migrations.
Run `npm --prefix server test`, `npm --prefix server run test:watch`, or
`npm --prefix server run test:coverage`. Jest transforms the TypeScript tests with
SWC; dedicated utility tests cover cookie configuration and session-token
creation, parsing, expiry, and invalid input. The coverage command reports the
auth, chat, middleware, token and socket modules exercised by the backend suites.
Frontend component and page tests use Jest, React Testing Library, and jsdom. Run
`npm --prefix app test`, `npm --prefix app run test:watch`, or
`npm --prefix app run test:coverage`. Tests live alongside components in `tests/`
folders. SWC transforms TypeScript/JSX, and Jest maps the `@/` alias and CSS imports.
The tests cover shared controls, sign-in, the chat shell, the user sidebar,
protected routing, and conversation composition. The chat shell tests mock its
children; the sidebar and conversation are tested separately. A lightweight
router adapter supports page tests in Jest’s jsdom environment.
There is no real-browser end-to-end suite yet.

For a manual end-to-end check, sign in as two different users in separate browser
profiles, send messages both ways, refresh to verify persistence, restart the
backend to verify reconnection, and log out to verify protected-route redirection.

## Scope and next steps

This is an MVP, not a production deployment:

- Shared-secret access, no individual passwords, login rate limiting, or immediate
  token revocation.
- Latest 100 messages only; no older-history pagination, attachments, editing,
  typing indicators, online presence, or read-receipt UI.
- No message idempotency key. A manual retry after an ambiguous failure can duplicate
  a message even though duplicate delivery of the same ID is merged in the UI.
- Database write and notification emission are separate. A process crash between
  them can delay visibility until a later history fetch; there is no durable outbox.
- The in-process event bus supports one backend instance. Multiple replicas need
  shared event distribution; the current broadcaster scans connected sockets.
- Reconnect history recovery is limited to the latest 100 messages. There is no
  complete event replay or durable delivery acknowledgement.
- Production work includes HTTPS termination, secret management, monitoring,
  backups, and real database/browser integration tests.
