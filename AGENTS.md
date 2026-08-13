# Agent Instructions

- After every change, check whether `README.md` is out of date.
- Do not add new information to `README.md` unless explicitly asked.
- The OpenAPI spec at `src/server/api/openapi.ts` (served at `/api/openapi.json`
  and rendered as Swagger UI at `/api`) must be kept in sync with the routes
  under `src/server/api` whenever they change.
