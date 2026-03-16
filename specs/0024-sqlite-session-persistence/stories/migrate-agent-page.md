# User Story: Migrate Agent Page to Use Sessions API

## Summary

**As a** user of Web-Spec,
**I want** my chat sessions to be saved to the server,
**So that** my conversation history persists across browser clears and device switches.

## Description

`frontend/app/agents/[slug]/page.tsx` currently calls `createSession`, `addMessageToSession`, `addActivity`, and `getSession` from `storage.ts` synchronously. These must be replaced with async calls from `sessions-api.ts`. Since these calls already live inside `useEffect` callbacks and `useCallback` async functions, the migration amounts to swapping the import path and adding `await` keywords. Page behaviour and UI are unchanged.

The key call sites are:

- `useEffect` init: calls `createSession`, `addMessageToSession` (for handoff context), and `getSession` (for resume).
- `handleSend` (already `async`): calls `addMessageToSession` for user and assistant messages.
- `handleWorkIQAttach` (sync `useCallback`): calls `addMessageToSession` for each attached item.

## Acceptance Criteria

- [ ] Given a user opens an agent page with an active repo, when the init `useEffect` runs, then a session is created via `POST /api/backend/sessions`.
- [ ] Given the `web_spec_resume_<slug>` key is in `sessionStorage`, when the init effect runs, then the session is loaded via `GET /api/backend/sessions/:id` and its messages are displayed.
- [ ] Given the `web_spec_handoff_<slug>` key is in `sessionStorage`, when the init effect runs, then the handoff context is attached to the new session via `POST /api/backend/sessions/:id/messages`.
- [ ] Given a user sends a message, when `handleSend` is called, then the message is persisted via `POST /api/backend/sessions/:id/messages` before the SSE stream begins.
- [ ] Given a WorkIQ context item is attached, when `handleWorkIQAttach` runs, then the assistant message is persisted via `addMessageToSession` from `sessions-api.ts`.
- [ ] Given the API call to `addMessageToSession` returns `null` (e.g. backend unreachable), when `handleSend` is called, then the function returns early without crashing the page.
- [ ] Given `npx tsc --noEmit` runs in `frontend/`, then it exits with code 0 with no errors in this file.

## Tasks

- [ ] Replace the import `from "@/lib/storage"` for `createSession`, `addMessageToSession`, `addActivity`, `getSession`, `Message`, `Session` with `from "@/lib/sessions-api"`.
- [ ] In the init `useEffect`, convert the callback to `async` and `await createSession(...)`.
- [ ] In the init `useEffect`, `await getSession(resumeSessionId)` for the resume branch.
- [ ] In the init `useEffect`, `await addMessageToSession(newSession.id, ...)` for the handoff branch.
- [ ] In `handleSend`, replace `addMessageToSession(session.id, { role: "user", content })` with `await addMessageToSession(...)` (the function is already `async`).
- [ ] In `handleSend`, replace the assistant message `addMessageToSession` call (inside `onDone` or after stream completes) with `await addMessageToSession(...)`.
- [ ] In `handleWorkIQAttach`, convert the callback to `async` and `await addMessageToSession(...)` for each item.
- [ ] Replace `addActivity(...)` calls (triggered inside `createSession` in `storage.ts`) with explicit `await addActivity(...)` calls from `sessions-api.ts` at the relevant call sites in the page (e.g., after creating a session).
- [ ] Ensure `sessionRef.current` is still updated after every `await addMessageToSession(...)` call, so closures in `handleSend` always have the latest session state.
- [ ] Run `npx tsc --noEmit` in `frontend/` and fix any type errors.

## Dependencies

- Depends on: `frontend-sessions-api-client` — `sessions-api.ts` must be importable with the correct exported types.

## Out of Scope

- Changing the UX of the agent page.
- Adding toast notifications for API failures.
- Refactoring `handleSend` or the streaming logic beyond the storage swap.

## Notes

- The `sessionRef.current` pattern exists so closures in `handleSend` always have the latest session without stale refs — this does not change with the migration; it still holds the `Session` object returned by `addMessageToSession`.
- After this migration, `storage.ts` should no longer have `createSession`, `addMessageToSession`, `getSession`, or `addActivity` called from this file.
- `addActivity` was previously called inside `storage.ts > createSession` automatically. With the migration, it must be called explicitly at the page level after `await createSession(...)`, or it can be called from within `sessions-api.ts > createSession` (either approach is acceptable; document the decision in the implementation PR).
