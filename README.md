# Drop.it

A no-design file drop: upload a file, hand out the download link. Angular 21
with server-side rendering; the same
Node process serves the pages, the API and an MCP endpoint.

## Running it

```bash
npm install
cp .env.example .env        # set JWT_SECRET and DATABASE_URL
npm run build
npm run serve               # http://localhost:8080
```

A MySQL database (or TiDB, which speaks the MySQL protocol) is required; the
schema is created on boot. For local development you can bring one up with
`docker compose up mysql`.

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
list. Storage is MySQL/TiDB, at the connection string in `DATABASE_URL`; the
schema is created on boot.

## Deploying

**Docker**

```bash
docker compose up --build
```

Development command:

```bash
JWT_SECRET="secret" DATABASE_URL='mysql://dropit:dropit@localhost:3306/dropit' npm run start
```

This also starts a MySQL container; see [docker-compose.yml](docker-compose.yml).

**Fly.io** — see the setup steps at the top of [fly.toml](fly.toml). Attach a
managed MySQL/TiDB instance with `fly postgres attach` (TiDB) and set
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

| Verb | Route                                | Description                                              |
| ---- | ------------------------------------ | -------------------------------------------------------- |
| GET  | `/`                                  | Uploader                                                 |
| GET  | `/f/:id`                             | Share page with the download link                        |
| GET  | `/login`                             | Admin sign-in page                                       |
| GET  | `/dashboard?page=N`                  | Paginated file console (admin)                           |
| GET  | `/logout`                            | Clears the session and redirects to `/` (admin)          |
| GET  | `/api`                               | Swagger UI for the API                                   |
| GET  | `/api/openapi.json`                  | Raw OpenAPI spec                                         |
| POST | `/api/auth/login`                    | Authenticates a user and sets the auth cookie            |
| GET  | `/api/auth/me`                       | Returns the authenticated user's ID and role             |
| GET  | `/api/auth/admin-check`              | Checks that the authenticated user is an admin           |
| POST | `/api/auth/change-password`          | Changes the authenticated user's password                |
| POST | `/api/files/upload`                  | Multipart upload (admin)                                 |
| GET  | `/api/files/view/:id`                | Streams a file inline                                    |
| GET  | `/api/files/download/:id`            | Streams a file inline                                    |
| GET  | `/api/files/dashboard/`              | Lists all file records (admin)                           |
| GET  | `/api/files/dashboard/export`        | Exports all file records (admin)                         |
| POST | `/api/files/dashboard/import`        | Imports file records (admin)                             |
| POST | `/api/files/dashboard/orphans`       | Registers loose files on disk, then redirects (admin)    |
| POST | `/api/files/dashboard/delete/:id`    | Soft-deletes a file and redirects to `/dashboard`        |
| POST | `/api/files/dashboard/delete/fr/:id` | Permanently deletes a file and redirects to `/dashboard` |
| GET  | `/api/files/dashboard/download/:id`  | Streams an admin file by database ID (admin)             |
| GET  | `/api/files/dashboard/:id`           | Streams an admin file by database ID (admin)             |
| GET  | `/dashboard/tokens`                  | API token console (admin)                                |
| GET  | `/dashboard/password`                | Change-password screen (admin)                           |
| GET  | `/api/tokens`                        | Lists API tokens (admin)                                 |
| POST | `/api/tokens`                        | Issues an API token, returning it once (admin)           |
| POST | `/api/tokens/:id/revoke`             | Revokes an API token (admin)                             |
| POST | `/mcp`                               | MCP endpoint, Streamable HTTP (API bearer token)         |
| GET  | `/ping`                              | Health check                                             |

Forked off [ReSendit](https://git.brammie15.dev/brammie15/ReSendit).
