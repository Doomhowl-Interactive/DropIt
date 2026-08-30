# Drop.it

File uploading service, forked off [ReSendit](https://git.brammie15.dev/brammie15/ReSendit)
and rewritten in Angular. Does not have all features!

## Routes

| Verb | Route                                | Description                                              |
| ---- | ------------------------------------ | -------------------------------------------------------- |
| GET  | `/`                                  | Uploader                                                 |
| GET  | `/login`                             | Admin sign-in page                                       |
| GET  | `/dashboard`                         | File console (admin)                                     |
| GET  | `/logout`                            | Clears the session and redirects to `/` (admin)          |
| GET  | `/api`                               | Swagger UI for the API                                   |
| GET  | `/api/openapi.json`                  | Raw OpenAPI spec                                         |
| POST | `/api/auth/login`                    | Authenticates a user and sets the auth cookie            |
| GET  | `/api/auth/me`                       | Returns the authenticated user's ID and role             |
| GET  | `/api/auth/admin-check`              | Checks that the authenticated user is an admin           |
| POST | `/api/auth/change-password`          | Changes the authenticated user's password                |
| POST | `/api/files/upload`                  | Multipart upload (admin)                                 |
| GET  | `/api/files/view/:id`                | Streams a file; admins may view disabled files           |
| GET  | `/api/files/dashboard/`              | Lists all file records (admin)                           |
| GET  | `/api/files/dashboard/export`        | Exports all file records (admin)                         |
| POST | `/api/files/dashboard/import`        | Imports file records (admin)                             |
| POST | `/api/files/dashboard/orphans`       | Registers loose files on disk, then redirects (admin)    |
| PATCH | `/api/files/dashboard/:id`          | Enables or disables a file (admin)                       |
| POST | `/api/files/dashboard/delete/fr/:id` | Permanently deletes a file and redirects to `/dashboard` |
| GET  | `/dashboard/tokens`                  | API token console (admin)                                |
| GET  | `/dashboard/password`                | Change-password screen (admin)                           |
| GET  | `/api/tokens`                        | Lists API tokens (admin)                                 |
| POST | `/api/tokens`                        | Issues an API token, returning it once (admin)           |
| POST | `/api/tokens/:id/revoke`             | Revokes an API token (admin)                             |
| POST | `/mcp`                               | MCP endpoint, Streamable HTTP (API bearer token)         |
| GET  | `/ping`                              | Health check                                             |

## Configuration

Storage is selected by `STORAGE_DRIVER` (`local` or `s3`). An explicit value
always wins: `STORAGE_DRIVER=local` keeps local storage even when `S3_BUCKET`
is set. When `STORAGE_DRIVER` is unset, setting `S3_BUCKET` switches storage
to S3; otherwise local storage is used. See `.env.example` for all variables.
