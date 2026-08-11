# Drop.it

A no-design file drop: upload a file, hand out the download link, keep the
deletion link to yourself. Angular 21 with server-side rendering; the same
Node process serves the pages, the API and an MCP endpoint.

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

## MCP server

Drop.it speaks [MCP](https://modelcontextprotocol.io) over Streamable HTTP at
`/mcp`, so an AI agent can store a file and get back a share link without going
through the browser.

Mint a token at **`/admin/mcp`** (linked from the admin console). The secret is
shown once, at creation, and cannot be recovered afterwards — only revoked.

```bash
claude mcp add --transport http dropit https://drop.example/mcp \
  --header "Authorization: Bearer dropit_mcp_…"
```

| Tool | What it does |
| --- | --- |
| `upload_file` | Stores content (base64 or plain text) and returns its share link |
| `list_files` | Paginated listing with sizes, download counts and expiry |
| `get_file` | Reads a file back — text inline, anything else as base64 |

Live files are also exposed as browsable resources under `dropit://files/{id}`.

Reading a file over MCP deliberately does *not* count as a download and will not
consume a delete-after-download file. Share links returned by these tools are
public; the deletion link that comes with an upload still requires an admin
browser session, exactly as it does in the UI.

The endpoint is stateless — no sessions, so no sticky routing needed — and is
disabled entirely with `MCP_ENABLED=false`. Adding a tool means adding one file
under `src/server/mcp/tools/` and one entry in that folder's `index.ts`.

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
    mcp/                MCP endpoint: tool registry, transport, access tokens
  shared/               types crossing the server/client boundary
static/                 logo and favicon, served from /static
```

Page data is computed in Express, passed to Angular through `REQUEST_CONTEXT`,
and replayed to the browser via `TransferState` — so the server and the client
render the same markup without a second round trip. See
[src/shared/page-context.ts](src/shared/page-context.ts).

## Routes

| Route | What it does |
| --- | --- |
| `GET /` | Uploader |
| `GET /f/:viewId` | Share page with the download and deletion links |
| `GET /login` | Admin sign-in |
| `GET /admin` | File console (admin) |
| `GET /admin/mcp` | MCP token console (admin) |
| `GET /logout` | Clears the session (admin) |
| `POST /api/files/upload` | Multipart upload (admin) |
| `GET /api/files/view/:id`, `GET /api/files/download/:id` | Serves a file |
| `GET /api/files/delete/:deletionId` | Soft-deletes and shows a confirmation (admin) |
| `GET /api/files/admin/export`, `POST /api/files/admin/import` | Record export/import (admin) |
| `GET`, `POST /api/mcp-tokens`, `POST /api/mcp-tokens/:id/revoke` | MCP token management (admin) |
| `POST /mcp` | MCP endpoint (bearer token) |
| `GET /ping` | Health check |

Forked off [ReSendit](https://git.brammie15.dev/brammie15/ReSendit).
