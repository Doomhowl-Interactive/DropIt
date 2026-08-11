# Drop.it

A no-design file drop: upload a file, hand out the download link, keep the
deletion link to yourself. Angular 21 with server-side rendering; the same
Node process serves the pages, the API and an MCP endpoint.

## Running it

```bash
npm install
cp .env.example .env        # set JWT_SECRET and DATABASE_URL
npm run build
npm run serve               # http://localhost:8080
```

A Postgres database is required; the schema is created on boot. For local
development you can bring one up with `docker compose up postgres`.

For development with live reload:

```bash
npm start                   # ng serve, SSR included
```

On first boot an `admin` account is created. Its password comes from
`ADMIN_PASSWORD`, or — when that is empty — a random one is generated and
printed to the log **once**:

```
Admin user created with random password: kC4t9kYxqheQfuVa
```

Uploading and the admin console both require that account (`/login`).

## Configuration

Everything is environment driven; see [.env.example](.env.example) for the full
list. Storage is Postgres, at the connection string in `DATABASE_URL`; the
schema is created on boot.

## Deploying

**Docker**

```bash
docker compose up --build
```

This also starts a Postgres container; see [docker-compose.yml](docker-compose.yml).

**Fly.io** — see the setup steps at the top of [fly.toml](fly.toml). Attach a
Fly Postgres (or other managed Postgres) with `fly postgres attach`, which sets
`DATABASE_URL` as a secret. Uploads live on a mounted volume, so keep the app
to a single machine.

## Layout

```
src/
  index.html            shell document
  styles.css            global styles (page CSS + Tailwind)
  main.ts               browser bootstrap
  main.server.ts        server bootstrap
  server.ts             Express wiring: static files, API, pages
  app/                  Angular pages and helpers
  server/               API, persistence, auth, uploads
  shared/               types crossing the server/client boundary
static/                 logo and favicon, served from /static
```

Page data is computed in Express, passed to Angular through `REQUEST_CONTEXT`,
and replayed to the browser via `TransferState` — so the server and the client
render the same markup without a second round trip. See
[src/shared/page-context.ts](src/shared/page-context.ts).

## Routes

| Verb | Route                            | Description                                           |
| ---- | -------------------------------- | ----------------------------------------------------- |
| GET  | `/`                              | Uploader                                              |
| GET  | `/f/:id`                         | Share page with the download and deletion links       |
| GET  | `/login`                         | Admin sign-in page                                    |
| GET  | `/admin?page=N`                  | Paginated file console (admin)                        |
| GET  | `/logout`                        | Clears the session and redirects to `/` (admin)       |
| POST | `/api/auth/login`                | Authenticates a user and sets the auth cookie         |
| GET  | `/api/auth/me`                   | Returns the authenticated user's ID and role          |
| GET  | `/api/auth/admin-check`          | Checks that the authenticated user is an admin        |
| POST | `/api/files/upload`              | Multipart upload (admin)                              |
| GET  | `/api/files/view/:id`            | Streams a file inline                                 |
| GET  | `/api/files/download/:id`        | Streams a file inline                                 |
| GET  | `/api/files/delete/:del_id`      | Soft-deletes and shows a confirmation (admin)         |
| GET  | `/api/files/admin/`              | Lists all file records (admin)                        |
| GET  | `/api/files/admin/export`        | Exports all file records (admin)                      |
| POST | `/api/files/admin/import`        | Imports file records (admin)                          |
| POST | `/api/files/admin/delete/:id`    | Soft-deletes a file and redirects to `/admin`         |
| POST | `/api/files/admin/delete/fr/:id` | Permanently deletes a file and redirects to `/admin`  |
| GET  | `/api/files/admin/download/:id`  | Streams an admin file by database ID (admin)          |
| GET  | `/api/files/admin/:id`           | Streams an admin file by database ID (admin)          |
| GET  | `/admin/mcp`                     | MCP token console (admin)                             |
| GET  | `/api/mcp-tokens`                | Lists the MCP access tokens (admin)                   |
| POST | `/api/mcp-tokens`                | Issues an MCP access token, returning it once (admin) |
| POST | `/api/mcp-tokens/:id/revoke`     | Revokes an MCP access token (admin)                   |
| POST | `/mcp`                           | MCP endpoint, Streamable HTTP (bearer token)          |
| GET  | `/ping`                          | Health check                                          |

Forked off [ReSendit](https://git.brammie15.dev/brammie15/ReSendit).
