# Feature: SQLite Session Persistence

## Overview

Web-Spec currently stores all session data (chat histories, activity events) in browser `localStorage`. This means sessions are browser-scoped and lost whenever a user clears storage, switches devices, or opens an incognito window. This feature migrates `Session`, `Message`, and `ActivityEvent` storage to the existing SQLite database on the backend — while keeping browser-only data (`ActiveRepo`, `FeatureFlags`) in `localStorage` — so that conversation history survives across browsers and devices.

## Problem Statement

Web-Spec sessions are ephemeral by accident: a user who clears their browser storage, or switches to a different machine, loses all chat history. Since the backend already uses SQLite via `better-sqlite3`, the infrastructure for durable, server-side persistence is in place. The only missing pieces are the schema tables and REST endpoints to serve and mutate session data.

## Goals

- [ ] Persist `Session`, `Message`, and `ActivityEvent` data in the SQLite database at `backend/data/agents.db`.
- [ ] Expose a REST API on the backend for session and activity CRUD operations.
- [ ] Replace `localStorage` usage for sessions and activity in all frontend pages with async API calls.
- [ ] Keep `localStorage` exclusively for `ActiveRepo` and `FeatureFlags` — only sessions and activity move.
- [ ] Handle network errors gracefully in the frontend API client without crashing the app.

## Non-Goals

- Migrating existing `localStorage` sessions to SQLite (existing sessions will no longer appear — documented as a known limitation).
- Multi-user or multi-tenant session isolation.
- Session search, filtering, or pagination beyond ordering by `updatedAt DESC`.
- Authentication / authorisation of the new sessions API (the app already relies on the GitHub PAT for other calls).

## Target Users / Personas

| Persona | Description |
|---|---|
| Developer | Uses Web-Spec daily; currently loses sessions when clearing the browser or switching devices. |
| Admin | Wants to inspect or purge session history from the server side without browser access. |

## Functional Requirements

1. The system shall create `sessions`, `messages`, and `activity` tables in `backend/data/agents.db` at startup using `CREATE TABLE IF NOT EXISTS`.
2. The system shall enable SQLite foreign key enforcement via `db.pragma("foreign_keys = ON")` in `db.ts`.
3. The system shall expose `GET /api/sessions` returning all sessions with a `messageCount` field and an empty `messages` array, ordered by `updatedAt DESC`.
4. The system shall expose `GET /api/sessions/:id` returning a single session with its full `messages` array sorted by `createdAt ASC`, or HTTP 404 if not found.
5. The system shall expose `POST /api/sessions` to create a new session, returning the created record with HTTP 201.
6. The system shall expose `POST /api/sessions/:id/messages` to append a message; if this is the first user message, the session `title` shall be updated to `content.slice(0, 60)` (with `…` suffix when truncated).
7. The system shall expose `DELETE /api/sessions/:id` to delete a session and its messages (via cascade) and return HTTP 204.
8. The system shall expose `DELETE /api/sessions` to delete all sessions (and cascade-delete all messages) and return HTTP 204.
9. The system shall expose `GET /api/activity` returning the 50 most recent activity events ordered by `createdAt DESC`.
10. The system shall expose `POST /api/activity` to append an activity event, returning HTTP 201.
11. The system shall expose `DELETE /api/activity` to delete all activity events and return HTTP 204.
12. The frontend shall call these endpoints via a new `frontend/lib/sessions-api.ts` module, following the same pattern as `frontend/lib/agents-api.ts`.
13. The frontend `app/agents/[slug]/page.tsx` shall use `sessions-api.ts` functions in place of all `storage.ts` session functions.
14. The frontend `app/dashboard/page.tsx` shall use `sessions-api.ts` functions in place of all `storage.ts` session and activity reads/writes.
15. The `storage.ts` module shall retain only `ActiveRepo` and `FeatureFlags` functions; all session and activity exports shall be removed.
16. Network errors in the frontend API client shall be caught and logged to `console.error`; functions shall return safe fallback values (e.g., `null`, `[]`) without throwing.

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Sessions list must load in < 200 ms on localhost; messages query must use an index on `sessionId`. |
| Security | All DB queries must use parameterised `better-sqlite3` prepared statements to prevent SQL injection. Session IDs are server-generated `crypto.randomUUID()` values. |
| Data integrity | The `messages.sessionId` foreign key with `ON DELETE CASCADE` ensures no orphaned messages survive a session deletion. |
| Accessibility | No changes to UI layout or interactive elements; existing accessible markup is preserved as-is. |

## UX / Design Considerations

- No visible UX change for the user — sessions appear and behave identically; they simply survive a browser clear.
- The "Clear all data" button on the dashboard calls `DELETE /api/sessions` + `DELETE /api/activity` instead of `localStorage.removeItem`.
- Error states: if the backend is unreachable, all read functions return empty arrays/null gracefully, and errors are logged to the console.

## Technical Considerations

- **DB module**: Add `foreign_keys` pragma and the three `CREATE TABLE IF NOT EXISTS` blocks to `backend/src/lib/db.ts`, directly after the existing WAL pragma and table definitions.
- **Sessions route**: New file `backend/src/routes/sessions.ts` using synchronous `better-sqlite3` calls, exported as `sessionsRouter`. Activity endpoints are co-located in the same router for simplicity.
- **Registration**: Mount `sessionsRouter` at `/api` in `backend/src/index.ts` alongside the existing `agentRouter`.
- **Frontend API base**: All requests go through `/api/backend/sessions` and `/api/backend/activity` (proxied by the existing Next.js route handler at `frontend/app/api/backend/[...path]/route.ts`).
- **ID generation**: `crypto.randomUUID()` (Node 14.17+); already used in `storage.ts` and supported by the project.
- **Timestamps**: Stored as `INTEGER` (milliseconds since Unix epoch, i.e. `Date.now()`), matching the existing convention in `storage.ts`.
- **Title update logic**: `POST /api/sessions/:id/messages` server-side: count existing messages for the session; if count is 0 and `role === "user"`, run `UPDATE sessions SET title = ?, updatedAt = ? WHERE id = ?`.
- **ESM convention**: All backend imports use `.js` extensions per project standard.

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `better-sqlite3` | External (npm) | Already installed in `backend/`; no new dependency needed. |
| `backend/src/lib/db.ts` | Internal | Extend with three new tables and foreign_keys pragma. |
| `backend/src/index.ts` | Internal | Register `sessionsRouter`. |
| `frontend/lib/agents-api.ts` | Internal | Reference pattern for the new `sessions-api.ts`. |
| Next.js API proxy (`/api/backend/[...path]`) | Internal | Must forward `/sessions` and `/activity` paths to the backend. |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Existing `localStorage` sessions are lost after migration | High | Low | Documented known limitation; no data migration is in scope. |
| `foreign_keys` pragma not enabled causes orphaned messages | Med | Med | Add `db.pragma("foreign_keys = ON")` in `db.ts` immediately after opening the DB, before any table creation. |
| Race condition when two concurrent `POST /messages` target the same session | Low | Low | `better-sqlite3` is synchronous and process-local; no race is possible in a single-process Express app. |
| Backend unreachable on first page load | Low | Med | Frontend returns `[]` / `null` gracefully; `console.error` is called; no page crash. |
| Next.js proxy not forwarding `/sessions` paths | Low | High | Verify early during story 3 by manually hitting the proxy; fix the proxy catch-all if needed. |

## Success Metrics

- Sessions and messages persist across browser-clear and device-switch.
- `npx tsc --noEmit` passes in both `frontend/` and `backend/` with zero errors.
- All existing session interactions (create, send message, resume, delete, clear all) work identically from a UX perspective.
- The dashboard loads sessions and activity from the API with no console errors in the happy path.

## Open Questions

- [ ] Should the sessions API require the GitHub PAT in the `Authorization` header for write operations, or is it open like the other backend routes?
- [ ] Is there a max session retention limit (count or age), or is SQLite the only bound?
- [ ] Should `DELETE /api/sessions` (bulk delete) require a confirmation token in the body to guard against accidental wipes?

## User Stories

| Story | File |
|---|---|
| Extend SQLite schema with sessions, messages, and activity tables | [stories/extend-sqlite-schema.md](stories/extend-sqlite-schema.md) |
| Create backend sessions & activity REST API | [stories/backend-sessions-api.md](stories/backend-sessions-api.md) |
| Create frontend sessions API client | [stories/frontend-sessions-api-client.md](stories/frontend-sessions-api-client.md) |
| Migrate agent page to use sessions API | [stories/migrate-agent-page.md](stories/migrate-agent-page.md) |
| Migrate dashboard page to use sessions API | [stories/migrate-dashboard-page.md](stories/migrate-dashboard-page.md) |
