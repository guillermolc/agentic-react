# User Story: Session Delete Buttons

## Summary

**As a** power user,
**I want** to delete individual sessions or clear all sessions from the dashboard,
**So that** I can keep my session list clean and free of stale or unwanted entries.

## Description

The dashboard (`frontend/app/dashboard/page.tsx`) reads sessions from localStorage via `getSessions()` and renders them as a list. Currently there is no deletion mechanism — sessions only disappear if `clearAllRepoContext()` is triggered elsewhere. This story adds per-row delete plus a bulk "Clear all" button.

The `storage.ts` module already has `clearAllSessions()` but is missing `deleteSession(id)`. That function must be added. All state changes must also update the local React state so the UI reflects the deletion immediately without requiring a page reload.

## Acceptance Criteria

- [ ] Given the dashboard has sessions, when the user clicks the trash icon on a session row, then that session is removed from `localStorage` and disappears from the list immediately.
- [ ] Given the dashboard has sessions, when the user clicks "Clear all", then all sessions are removed from localStorage and the list shows the empty state.
- [ ] Given clicking the trash icon on a session row, when the click event fires, then the user is NOT navigated to the agent page (event propagation is stopped).
- [ ] Given the session list is empty, when the page renders, then the "Clear all" button is NOT visible.
- [ ] Given the dashboard has sessions, when sessions exist, then the "Clear all" button is visible next to the "Recent Sessions" heading.

## Tasks

- [ ] Add `deleteSession(id: string): void` to `frontend/lib/storage.ts` — filters the session out of `web_spec_sessions` in localStorage by ID
- [ ] Update `frontend/app/dashboard/page.tsx` to import `deleteSession` and `clearAllSessions`
- [ ] Add a `Trash2` icon button to each session row with `onClick` that calls `deleteSession(session.id)`, updates local `sessions` state, and calls `e.stopPropagation()` and `e.preventDefault()`
- [ ] Style the delete button as `text-muted hover:text-red-400 transition-colors p-1 rounded flex-shrink-0`; position it after the message count badge
- [ ] Add a "Clear all" button in the "Recent Sessions" header row, only rendered when `sessions.length > 0`; on click calls `clearAllSessions()` and `setSessions([])`
- [ ] Style the "Clear all" button as `text-xs text-red-400/70 hover:text-red-400 transition-colors ml-auto`

## Dependencies

- No dependencies on other stories in this spec.

## Out of Scope

- Confirmation dialog before deletion
- Undoing a deletion
- Deleting activity log entries alongside sessions

## Notes

- `clearAllSessions()` already exists in `storage.ts` — reuse it.
- The session `<a>` tag that wraps each row handles navigation; the trash button must stop propagation so clicking it doesn't also trigger the link.
- Keep the `<a>` tag as the outer wrapper. Make the delete button a `<button>` inside it with `onClick={(e) => { e.preventDefault(); e.stopPropagation(); ... }}`.
