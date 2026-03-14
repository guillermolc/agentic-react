# User Story: External KDB CRUD API

## Summary

**As a** user,
**I want** REST API endpoints to manage external KDB configurations,
**So that** the frontend can register, list, and remove external KDB connections without directly touching the database.

## Description

Create `backend/src/routes/kdb-external.ts` exporting a named `kdbExternalRouter` (Express `Router`). Mount it inside the existing `kdbRouter` in `backend/src/routes/kdb.ts` at the `/external` sub-path, so effective URLs are `/api/kdb/external`.

Three endpoints:
- `GET /` returns all KDB records with `apiKey` masked to `"••••••"` (or omitted) if set.
- `POST /` creates a new record; generates a UUID `id` and ISO `createdAt`.
- `DELETE /:id` deletes a record by `id`; returns `404` if not found.

Pattern mirrors `backend/src/routes/admin.ts`.

## Acceptance Criteria

- [ ] Given `GET /api/kdb/external`, when the table is empty, then it returns `200` with an empty array `[]`.
- [ ] Given `GET /api/kdb/external`, when records exist, then it returns them all with `apiKey` replaced by `"••••••"` if non-null, or `null` if null.
- [ ] Given `POST /api/kdb/external` with `{ name, baseUrl, repoId }`, when the body is valid, then a new record is created and returned with `201` status and a generated `id`.
- [ ] Given `POST /api/kdb/external` without a required field (`name`, `baseUrl`, or `repoId`), when the request body is invalid, then `400` is returned with an `error` message.
- [ ] Given `DELETE /api/kdb/external/:id` with a valid ID, when the record exists, then it is deleted and `200` is returned with `{ success: true }`.
- [ ] Given `DELETE /api/kdb/external/:id` with an unknown ID, when the record does not exist, then `404` is returned.
- [ ] Given `npx tsc --noEmit` in `backend/`, when run, then zero type errors.

## Tasks

- [ ] Create `backend/src/routes/kdb-external.ts` with `GET /`, `POST /`, and `DELETE /:id` handlers
- [ ] In `GET /` handler: query all rows, map through them replacing non-null `apiKey` with `"••••••"`
- [ ] In `POST /` handler: validate required fields, generate `id` via `crypto.randomUUID()`, insert row, return created record (masked)
- [ ] In `DELETE /:id` handler: check existence, delete row, return 404 if not found
- [ ] Import and mount `kdbExternalRouter` in `backend/src/routes/kdb.ts` at path `/external`
- [ ] Ensure `kdb-external.ts` uses `.js` extension for all local ESM imports (e.g., `from "../lib/db.js"`)
- [ ] Run `npx tsc --noEmit` in `backend/` and fix any type errors

## Dependencies

- Depends on: [external-kdb-db-model.md](external-kdb-db-model.md) — `ExternalKdb` interface and table must exist

## Out of Scope

- Update endpoint (`PUT /:id`) — fields rarely change; users can delete and re-add
- Pagination — the list is expected to be small (< 20 entries)

## Notes

- Use `crypto.randomUUID()` (built into Node 18+, already used in the project) — no additional package needed.
- The `apiKey` masking should happen in a helper function (e.g., `toResponse`) similar to `admin.ts`.
- The frontend Next.js rewrite (`/api/backend/*` → `http://localhost:3001/api/*`) already handles routing — no frontend proxy changes needed.
