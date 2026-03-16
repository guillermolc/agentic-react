# User Story: Create Backend Sessions & Activity REST API

## Summary

**As a** frontend developer,
**I want** REST endpoints for managing sessions, messages, and activity events,
**So that** the frontend can create, read, and delete session data without touching `localStorage`.

## Description

Create a new Express router at `backend/src/routes/sessions.ts` that exposes all session and activity CRUD operations. The router is registered in `backend/src/index.ts` at `/api`. All DB queries use parameterised `better-sqlite3` prepared statements to prevent injection. The JSON shape returned by each endpoint mirrors the `Session`, `Message`, and `ActivityEvent` TypeScript interfaces in `frontend/lib/storage.ts`, so the frontend migration is a drop-in replacement. Activity endpoints are co-located in this router for simplicity.

## Acceptance Criteria

- [ ] Given `GET /api/sessions`, when sessions exist, then the response is a JSON array ordered by `updatedAt DESC`, each entry having a `messageCount: number` field and an empty `messages: []` array.
- [ ] Given `GET /api/sessions`, when no sessions exist, then the response is an empty JSON array `[]` with HTTP 200.
- [ ] Given `GET /api/sessions/:id`, when that session exists, then the response includes the full `messages` array sorted by `createdAt ASC`.
- [ ] Given `GET /api/sessions/:id`, when that session does not exist, then the response is `{ "error": "Not found" }` with HTTP 404.
- [ ] Given `POST /api/sessions` with a valid JSON body `{ id, agentSlug, agentName, title, repoFullName, createdAt, updatedAt }`, when the insert succeeds, then the response is the created session object with `messages: []` and HTTP 201.
- [ ] Given `POST /api/sessions/:id/messages` with body `{ role, content }` (and optional `reasoning`), when the session has zero existing messages and `role === "user"`, then the session `title` is updated to `content.slice(0, 60)` (with `…` appended when truncated).
- [ ] Given `POST /api/sessions/:id/messages`, when the session does not exist, then the response is `{ "error": "Not found" }` with HTTP 404.
- [ ] Given `POST /api/sessions/:id/messages` with a valid body, then the response includes the full updated session (with all messages) and HTTP 201.
- [ ] Given `DELETE /api/sessions/:id`, when called, then the session and all its messages are removed (via cascade) and HTTP 204 is returned with no body.
- [ ] Given `DELETE /api/sessions`, when called, then all sessions (and all messages via cascade) are removed and HTTP 204 is returned.
- [ ] Given `GET /api/activity`, when activity exists, then it returns up to 50 events ordered by `createdAt DESC`.
- [ ] Given `POST /api/activity` with a valid body `{ id, type, description, createdAt, agentSlug?, repoFullName? }`, then it returns the inserted event with HTTP 201.
- [ ] Given `DELETE /api/activity`, when called, then all activity rows are removed and HTTP 204 is returned.
- [ ] Given any endpoint, when a `better-sqlite3` error is thrown, then the response is `{ "error": "Internal server error" }` with HTTP 500.
- [ ] Given `npx tsc --noEmit` runs in `backend/`, then it exits with code 0.

## Tasks

- [ ] Create `backend/src/routes/sessions.ts` and export `sessionsRouter = Router()`.
- [ ] Implement `GET /api/sessions` — query `sessions` with a subquery or JOIN for `messageCount`, order by `updatedAt DESC`, return each session with `messages: []`.
- [ ] Implement `GET /api/sessions/:id` — select the session row; if not found return 404; select all messages `WHERE sessionId = ?` ORDER BY `createdAt ASC`; return the merged object.
- [ ] Implement `POST /api/sessions` — insert the full session row from request body; return the new session with `messages: []` and HTTP 201.
- [ ] Implement `POST /api/sessions/:id/messages` — validate session exists (404 if not); count existing messages; generate `id = crypto.randomUUID()` and `createdAt = Date.now()` server-side; insert message; if first user message, run `UPDATE sessions SET title = ?, updatedAt = ?`; return the full updated session.
- [ ] Implement `DELETE /api/sessions/:id` — `DELETE FROM sessions WHERE id = ?`; return 204.
- [ ] Implement `DELETE /api/sessions` — `DELETE FROM sessions`; return 204.
- [ ] Implement `GET /api/activity` — `SELECT * FROM activity ORDER BY createdAt DESC LIMIT 50`; return array.
- [ ] Implement `POST /api/activity` — insert the full activity row from request body; return the new event with HTTP 201.
- [ ] Implement `DELETE /api/activity` — `DELETE FROM activity`; return 204.
- [ ] Wrap all route handlers in try/catch; on error log to `console.error` and send HTTP 500.
- [ ] Register `sessionsRouter` in `backend/src/index.ts`: `app.use("/api", sessionsRouter)`.
- [ ] Run `npx tsc --noEmit` in `backend/` and fix any type errors.

## Dependencies

- Depends on: `extend-sqlite-schema` — `sessions`, `messages`, and `activity` tables must exist in the DB before these endpoints can be tested.

## Out of Scope

- Pagination or cursor-based listing of sessions.
- Authentication / rate limiting of the sessions API.
- Bulk message insertion.

## Notes

- Message `id` and `createdAt` are generated **server-side** in `POST /api/sessions/:id/messages`, not passed by the client. This mirrors the pattern in `storage.ts` where `addMessageToSession` assigns `id: crypto.randomUUID()` and `createdAt: Date.now()`.
- ESM convention: import `db` from `"../lib/db.js"` (`.js` extension required).
- The `content` truncation for title sets `session.title = content.length > 60 ? content.slice(0, 60) + "…" : content`, matching the existing `storage.ts` logic exactly.
- Use `db.prepare(...).run(...)` and `db.prepare(...).all(...)` from `better-sqlite3` for all queries — never string interpolation.
