# User Story: Create Frontend Sessions API Client

## Summary

**As a** frontend developer,
**I want** a typed async API client module for session and activity operations,
**So that** page components can call the backend without duplicating `fetch` logic or importing from `storage.ts`.

## Description

Create `frontend/lib/sessions-api.ts` that exports async functions mirroring the existing `storage.ts` session and activity functions. Each function calls the corresponding `/api/backend/sessions` or `/api/backend/activity` endpoint (proxied by the existing Next.js catch-all route handler). Network errors are caught and logged via `console.error`; functions return safe fallback values (`null`, `[]`) so no call site needs a try/catch. The TypeScript interfaces `Message`, `Session`, and `ActivityEvent` are declared in (or re-exported from) this module so that `storage.ts` session/activity exports can be removed without breaking imports elsewhere.

## Acceptance Criteria

- [ ] Given the backend is running, when `getSessions()` is called, then it returns `Session[]` from `GET /api/backend/sessions`.
- [ ] Given the backend is running, when `getSession(id)` is called with a valid id, then it returns `Session` from `GET /api/backend/sessions/:id`.
- [ ] Given the backend is running, when `getSession(id)` is called with an unknown id, then it returns `null`.
- [ ] Given the backend is running, when `createSession(agentSlug, agentName, repoFullName)` is called, then it POSTs to `/api/backend/sessions` and returns the created `Session`.
- [ ] Given the backend is running, when `addMessageToSession(sessionId, { role, content, reasoning? })` is called, then it POSTs to `/api/backend/sessions/:id/messages` and returns the updated `Session`.
- [ ] Given the backend is running, when `addMessageToSession(sessionId, ...)` is called with an unknown sessionId, then it returns `null`.
- [ ] Given the backend is running, when `deleteSession(id)` is called, then it sends `DELETE /api/backend/sessions/:id` with no return value.
- [ ] Given the backend is running, when `clearAllSessions()` is called, then it sends `DELETE /api/backend/sessions`.
- [ ] Given the backend is running, when `getActivity()` is called, then it returns `ActivityEvent[]` from `GET /api/backend/activity`.
- [ ] Given the backend is running, when `addActivity(event)` is called, then it POSTs to `/api/backend/activity`.
- [ ] Given the backend is running, when `clearAllActivity()` is called, then it sends `DELETE /api/backend/activity`.
- [ ] Given the backend is unreachable, when any function is called, then it logs to `console.error` and returns the safe fallback (e.g. `[]` for lists, `null` for single items, `undefined` for void functions).
- [ ] Given `npx tsc --noEmit` runs in `frontend/`, then it exits with code 0 with no errors touching this file.

## Tasks

- [ ] Create `frontend/lib/sessions-api.ts`.
- [ ] Declare (or re-export from `storage.ts`) the `Message`, `Session`, and `ActivityEvent` TypeScript interfaces in `sessions-api.ts`.
- [ ] Define `const SESSIONS_BASE = "/api/backend/sessions"` and `const ACTIVITY_BASE = "/api/backend/activity"`.
- [ ] Implement `getSessions(): Promise<Session[]>` — `GET ${SESSIONS_BASE}`; on non-2xx or catch return `[]`.
- [ ] Implement `getSession(id: string): Promise<Session | null>` — `GET ${SESSIONS_BASE}/:id`; on 404 or catch return `null`.
- [ ] Implement `createSession(agentSlug: string, agentName: string, repoFullName: string): Promise<Session>` — `POST ${SESSIONS_BASE}` with generated `id = crypto.randomUUID()`, `createdAt = Date.now()`, `updatedAt = Date.now()`, `title = "New session"`; return the parsed response.
- [ ] Implement `addMessageToSession(sessionId: string, message: Omit<Message, "id" | "createdAt">): Promise<Session | null>` — `POST ${SESSIONS_BASE}/${sessionId}/messages`; on 404 or catch return `null`.
- [ ] Implement `deleteSession(id: string): Promise<void>` — `DELETE ${SESSIONS_BASE}/:id`.
- [ ] Implement `clearAllSessions(): Promise<void>` — `DELETE ${SESSIONS_BASE}`.
- [ ] Implement `getActivity(): Promise<ActivityEvent[]>` — `GET ${ACTIVITY_BASE}`; on non-2xx or catch return `[]`.
- [ ] Implement `addActivity(event: Omit<ActivityEvent, "id" | "createdAt">): Promise<void>` — `POST ${ACTIVITY_BASE}` with generated `id` and `createdAt`.
- [ ] Implement `clearAllActivity(): Promise<void>` — `DELETE ${ACTIVITY_BASE}`.
- [ ] Wrap every `fetch` call in a try/catch block; on catch `console.error` and return the fallback.
- [ ] Verify the Next.js proxy catch-all route (`frontend/app/api/backend/[...path]/route.ts`) forwards `/sessions` and `/activity` paths; fix if needed.
- [ ] Run `npx tsc --noEmit` in `frontend/` and fix any type errors.

## Dependencies

- Depends on: `backend-sessions-api` — the endpoints at `/api/sessions` must exist on the backend.
- Depends on: the Next.js proxy route (`/api/backend/[...path]`) — must forward all sub-paths including `/sessions` and `/activity`.

## Out of Scope

- Retry logic or offline caching.
- Toast notifications for API errors (console.error is sufficient per the spec).
- Optimistic updates.

## Notes

- Follow the same `const BASE = "/api/backend/..."` pattern as `frontend/lib/agents-api.ts` for consistency.
- `Message`, `Session`, and `ActivityEvent` interfaces should be exported from `sessions-api.ts` so that pages previously importing them from `storage.ts` can update their import path without type changes.
- `createSession` generates the `id`, `createdAt`, and `updatedAt` client-side before POSTing, matching the existing `storage.ts` behaviour. The server stores exactly what it receives for these fields.
- The `addMessageToSession` implementation does NOT need to pass `id` or `createdAt` — the server generates those for messages (see backend story notes).
