# User Story: Migrate Dashboard Page to Use Sessions API

## Summary

**As a** user,
**I want** the dashboard to display sessions and activity fetched from the server,
**So that** my history is accurate regardless of which browser or device I used.

## Description

`frontend/app/dashboard/page.tsx` currently reads and mutates sessions and activity exclusively via synchronous `localStorage`-backed functions from `storage.ts`. The reads happen in a `useEffect`, and the writes happen in `onClick` handlers ("Clear all data", "Clear all sessions", and per-session delete). This story replaces all those calls with async equivalents from `sessions-api.ts`. The page layout and visual behaviour remain unchanged.

Affected call sites in `dashboard/page.tsx`:

| Site | Current call | Replacement |
|---|---|---|
| `useEffect` data load | `getSessions()`, `getActivity()` | `await getSessions()`, `await getActivity()` from `sessions-api.ts` |
| "Clear all data" handler | `clearAllSessions()`, `clearAllActivity()` | `await clearAllSessions()`, `await clearAllActivity()` |
| "Clear all sessions" handler | `clearAllSessions()` | `await clearAllSessions()` |
| Per-session delete handler | `deleteSession(id)` | `await deleteSession(id)` |

## Acceptance Criteria

- [ ] Given the dashboard page mounts, when the `useEffect` runs, then `getSessions()` and `getActivity()` from `sessions-api.ts` are awaited and their results used to set state.
- [ ] Given a user clicks "Clear all data", when the handler runs, then `clearAllSessions()` and `clearAllActivity()` are awaited and the component state is updated to `[]` for both lists.
- [ ] Given a user clicks "Clear all sessions", when the handler runs, then `clearAllSessions()` is awaited and `sessions` state is set to `[]`.
- [ ] Given a user clicks the delete icon on a single session, when the handler runs, then `deleteSession(id)` is awaited and the deleted session is removed from the `sessions` state without a full reload.
- [ ] Given the backend is unreachable, when the page loads, then `getSessions()` returns `[]` and `getActivity()` returns `[]`, and the empty-state UI is shown rather than crashing.
- [ ] Given `npx tsc --noEmit` runs in `frontend/`, then it exits with code 0 with no errors in this file.

## Tasks

- [ ] Replace the import `from "@/lib/storage"` for `getSessions`, `getActivity`, `Session`, `ActivityEvent`, `deleteSession`, `clearAllSessions`, `clearAllActivity` with `from "@/lib/sessions-api"`.
- [ ] Convert the `useEffect` callback to `async` and `await getSessions()` and `await getActivity()`.
- [ ] Convert the "Clear all data" `onClick` handler to `async` and `await clearAllSessions()` + `await clearAllActivity()`.
- [ ] Convert the "Clear all sessions" `onClick` handler to `async` and `await clearAllSessions()`.
- [ ] Convert the per-session delete `onClick` handler (the `Trash2` button) to `async` and `await deleteSession(session.id)`.
- [ ] Remove any remaining imports from `@/lib/storage` in this file once all symbols have been replaced.
- [ ] Run `npx tsc --noEmit` in `frontend/` and fix any type errors.

## Dependencies

- Depends on: `frontend-sessions-api-client` — `sessions-api.ts` must export `getSessions`, `getActivity`, `deleteSession`, `clearAllSessions`, `clearAllActivity`, `Session`, and `ActivityEvent`.
- Depends on: `backend-sessions-api` — the backend endpoints must be live for end-to-end testing.

## Out of Scope

- Redesigning the dashboard UI or layout.
- Pagination or infinite scroll for the sessions list.
- Real-time refresh (polling or WebSocket) of sessions and activity.

## Notes

- After this story is complete, `storage.ts` no longer needs to export `getSessions`, `getActivity`, `Session` (for sessions), `ActivityEvent`, `deleteSession`, `clearAllSessions`, or `clearAllActivity`. Those exports can be removed from `storage.ts` as a cleanup step in this story or in a follow-up.
- The `Message` type imported from `storage.ts` is only used indirectly via `Session.messages`; once `Session` is imported from `sessions-api.ts`, the `Message` type comes along with it and no separate import is needed.
- The `clearAllRepoContext()` utility in `storage.ts` currently calls `clearAllSessions()` and `clearAllActivity()` internally. After migration, if `clearAllRepoContext()` is still used anywhere, it must be updated to call the async API versions, or callers must be updated to call them directly.
