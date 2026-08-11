# Drop.it

A no-design file drop: upload a file, hand out the download link, keep the
deletion link to yourself. Angular 22 with server-side rendering; the same
Node process serves the pages and the API.

## Running it

```bash
npm install
cp .env.example .env        # set JWT_SECRET
npm run build
npm run serve               # http://localhost:8080
```

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
list. Storage is SQLite, at the file path in `DATABASE_URL`; the schema is
created on boot and is compatible with databases written by the previous Go
implementation.

## Deploying

**Docker**

```bash
docker compose up --build
```

**Fly.io** — see the setup steps at the top of [fly.toml](fly.toml). Uploads and
the SQLite file live on a mounted volume, so keep it to a single machine unless
you move to Postgres.

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

| Route                                                         | What it does                                    |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `GET /`                                                       | Uploader                                        |
| `GET /f/:viewId`                                              | Share page with the download and deletion links |
| `GET /login`                                                  | Admin sign-in                                   |
| `GET /admin`                                                  | File console (admin)                            |
| `GET /logout`                                                 | Clears the session (admin)                      |
| `POST /api/files/upload`                                      | Multipart upload (admin)                        |
| `GET /api/files/view/:id`, `GET /api/files/download/:id`      | Serves a file                                   |
| `GET /api/files/delete/:deletionId`                           | Soft-deletes and shows a confirmation (admin)   |
| `GET /api/files/admin/export`, `POST /api/files/admin/import` | Record export/import (admin)                    |
| `GET /ping`                                                   | Health check                                    |

Forked off [ReSendit](https://git.brammie15.dev/brammie15/ReSendit).
