# User Story: Wire AbortController into handleSend

## Summary

**As a** developer working on the agent page,
**I want** `handleSend` to create and track an `AbortController` for every fetch request,
**So that** any component or handler can cancel the in-progress stream by calling `.abort()` on the stored ref.

## Description

> `handleSend` in `frontend/app/agents/[slug]/page.tsx` currently calls `fetch("/api/agent/run", ...)` with no cancellation mechanism. An `AbortController` must be created at the start of each invocation, its `.signal` passed to the `fetch` options, and the controller itself stored in a `useRef` so the cancel handler (added in a separate story) can access it without triggering a re-render.
>
> The `AbortError` that `fetch` throws when `.abort()` is called must be handled separately from real errors: it should **not** produce a `"⚠️ Error: ..."` message to the user.

## Acceptance Criteria

- [ ] Given a new `handleSend` call starts, when the fetch is created, then a fresh `AbortController` is instantiated and its `.signal` is passed to the fetch options.
- [ ] Given the `AbortController` is created, when the call is stored, then it is written into a `useRef<AbortController | null>` so no re-render is triggered.
- [ ] Given `abort()` is called on the ref while the stream is active, when `fetch` rejects, then the rejection is identified as an `AbortError` (via `err.name === "AbortError"`).
- [ ] Given an `AbortError` is caught, when the catch block runs, then no `"⚠️ Error:"` assistant message is added to the chat.
- [ ] Given the `handleSend` call finishes (any outcome), when the `finally` block runs, then `abortControllerRef.current` is set to `null`.
- [ ] Given `handleSend` is called while a previous run is somehow still in flight, when a new controller is created, then the previous ref is replaced (the new controller is the active one).

## Tasks

- [ ] Add `const abortControllerRef = useRef<AbortController | null>(null)` to the `AgentPage` component state declarations
- [ ] At the start of `handleSend`, instantiate `new AbortController()`, store it in `abortControllerRef.current`, and capture `const signal = abortControllerRef.current.signal`
- [ ] Pass `signal` in the `fetch` options object: `fetch("/api/agent/run", { method: "POST", signal, ... })`
- [ ] In the `catch` block of `handleSend`, add a guard: `if (err instanceof Error && err.name === "AbortError") return;` (or restructure to skip the error message path)
- [ ] In the `finally` block of `handleSend`, add `abortControllerRef.current = null`
- [ ] Run `npx tsc --noEmit` in the `frontend/` directory and confirm zero errors

## Dependencies

> This story has no dependencies on other cancel-streaming stories — it is the foundational change that all other stories build upon.

- Depends on: none (can be implemented first)

## Out of Scope

- UI changes (Stop button rendering) — handled in `stop-button-ui.md`
- Saving partial content — handled in `partial-content-save.md`
- Route handler signal forwarding — handled in `route-handler-signal-propagation.md`

## Notes

- `AbortError` detection: in the browser, `err.name === "AbortError"` is the standard check. Alternatively, `signal.aborted` can be checked in the catch block.
- The ref approach (rather than `useState`) is intentional: the abort controller is an implementation detail of the current fetch, not UI state, so it must not cause re-renders.
- In React Strict Mode (dev), effects run twice but `handleSend` is a `useCallback` — the ref will simply be overwritten on the second call, which is fine.
