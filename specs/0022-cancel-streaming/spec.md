# Feature: Cancel Streaming

## Overview

> When a user submits a prompt to an agent, the backend streams an SSE response until the LLM finishes. Currently there is no way to interrupt an in-progress run. This feature adds a "Stop" button that lets users abort a running agent stream at any time, gracefully stopping the LLM session on the backend and preserving the partial response already rendered so the user doesn't lose generated content.

## Problem Statement

> Long agent runs (especially Deep Research) can take several minutes. If the user realises the prompt was wrong, wants to redirect the agent, or simply needs to move on, they are stuck waiting. There is no escape hatch: the only option is to refresh the page, which also discards all prior conversation history. Adding a cancel mechanism respects the user's time and makes the app feel responsive and trustworthy.

## Goals

- [ ] Show a "Stop" button in the chat input area whenever `isStreaming === true`
- [ ] Clicking "Stop" aborts the active `fetch` request via `AbortController`
- [ ] Partial streamed content is saved as a complete assistant message (not discarded)
- [ ] The abort signal propagates from the browser → Next.js route handler → backend fetch
- [ ] When the backend HTTP connection closes, the Copilot/Vertex client is stopped cleanly via the existing `req.on("close")` handler
- [ ] The UI immediately returns to the idle state (textarea re-enabled, Send button restored)

## Non-Goals

- Does not add a server-side "cancel" API endpoint; disconnect-based cleanup is sufficient
- Does not cancel the repo-clone step (a separate, pre-streaming operation)
- Does not add per-message cancel (only the currently streaming message can be stopped)
- Does not persist the "cancelled" state across sessions or page reloads
- Does not add undo / re-run capabilities

## Target Users / Personas

| Persona | Description |
|---|---|
| Developer | Submitted a prompt with the wrong context and wants to stop early and rephrase without losing earlier conversation history |
| Product Manager | Started a long Deep Research run and realised the scope was wrong; wants to correct the prompt immediately |
| Power User | Wants to read the partial output so far and decide whether to continue or redirect the agent |

## Functional Requirements

1. The system SHALL display a "Stop" button (with a `Square` or `StopCircle` icon from `lucide-react`) in the chat input area whenever `isStreaming === true`.
2. The "Stop" button SHALL replace the Send button while streaming is active, or appear as a distinct secondary button alongside it — never both active at once.
3. Clicking "Stop" SHALL call `AbortController.abort()` on the controller tied to the current fetch request.
4. After abort, the system SHALL set `isStreaming` to `false` and clear `streamingContent` / `streamingReasoning` state.
5. The system SHALL save any accumulated partial content (and reasoning, if present) as an assistant `Message` in the session before clearing streaming state, so the content appears in the chat history.
6. The saved partial message SHALL be visually indistinguishable from any other completed assistant message (no special "truncated" badge required, but open for future enhancement).
7. The `handleSend` function in `app/agents/[slug]/page.tsx` SHALL create an `AbortController` at the start of each run and pass its `.signal` to the `fetch` call.
8. The `AbortController` instance SHALL be stored in a `ref` so the cancel handler can call `.abort()` without triggering a re-render.
9. The Next.js route handler (`app/api/agent/run/route.ts`) SHALL forward the incoming request's `AbortSignal` to the backend `fetch` call so that aborting the browser fetch also closes the backend HTTP connection.
10. The backend `req.on("close")` handler already calls `finish()` / `client.stop()` — the spec SHALL verify this path is exercised on a normal browser disconnect and document it as the cleanup contract.
11. The `onCancel` prop SHALL be added to `ChatInterface` and wired through to a handler in the agent page that calls `abortControllerRef.current?.abort()`.
12. The textarea and Send button SHALL be re-enabled immediately after cancel (no artificial delay).

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Cancel must visually take effect within one render cycle (~16 ms) of the button click |
| Security | The `AbortController` ref must not be exposed outside the component tree; no cancel token stored in `localStorage` or `sessionStorage` |
| Accessibility | The "Stop" button SHALL have an accessible `aria-label="Stop generation"` attribute |
| Reliability | If the fetch has already completed before cancel fires, `abort()` is a no-op and the normal done state should apply unchanged |

## UX / Design Considerations

- The "Stop" button should use the same pill/square styling as the Send button for visual consistency.
- Use `Square` (filled stop icon) from `lucide-react` as the icon; colour it with `text-text-secondary` at rest, `hover:text-red-400` on hover, to signal a destructive-ish action without being alarming.
- The button replaces the Send button in the same grid slot so the layout does not shift during streaming.
- Keyboard shortcut: pressing `Escape` while the textarea is focused and `isStreaming === true` should also trigger cancel (enhancement, listed as a task in the relevant story).
- After a cancel, the partial message appears in the chat as a normal bubble — no modal, no confirmation dialog.

## Technical Considerations

- `AbortController` / `AbortSignal` are natively available in the browser and in Node.js ≥ 20 (used by Next.js route handlers). No polyfill needed.
- The Next.js `POST(request: Request)` handler has access to `request.signal` — this must be forwarded to the inner `fetch` call as `signal: request.signal`.
- On the backend Express side, when the browser disconnects, Node.js HTTP emits `close` on the `req` socket. This already fires `req.on("close")` in `copilot-runner.ts` and `vertex-runner.ts`. No backend code changes are required beyond verification.
- The `AbortError` thrown by `fetch` when aborted must be caught in the `catch` block in `handleSend` — distinguish it from real errors so no "⚠️ Error:" message is added to the chat (the partial content save happens in the `catch` block for abort specifically, or in a dedicated `finally`-like guard).
- The `AbortController` ref should be reset to `null` after each run in the `finally` block of `handleSend`.

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `AbortController` Web API | Browser built-in | Available in all modern browsers and Node.js ≥ 20 |
| `lucide-react` `Square` icon | Internal (already installed) | Use existing icon library |
| `ChatInterface` `onCancel` prop | Internal | New prop added to the component interface |
| Next.js Route Handler `request.signal` | Internal | Forward to downstream `fetch` |
| Backend `req.on("close")` → `finish()` | Internal | Existing cleanup path — verify, no new code needed |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Partial message contains only the `<think>` preamble with no answer content | Med | Low | Save message only if `accumulated` is non-empty; otherwise save a short "(generation stopped)" placeholder so the user knows the run was cancelled |
| Next.js route handler `request.signal` already aborted before forwarding to backend fetch | Low | Low | Standard `AbortSignal` forwarding handles this — if already aborted, `fetch` rejects immediately |
| Backend Copilot client not stopping cleanly, leaking child processes | Low | High | `client.stop()` is already called in `finish()`; add a log line confirming it was reached via `req.close` path during testing |
| Vertex streaming not terminating on disconnect | Med | Med | Verify `vertex-runner.ts` has the same `req.on("close")` pattern; add it if missing |
| Double-cancel (user clicks Stop twice) | Low | Low | Guard `finish()` with the existing `done` boolean; no second stop call propagated |

## Success Metrics

- Metric 1: Clicking "Stop" visually returns the chat to idle state within one frame (< 100 ms perceived).
- Metric 2: The partial streamed content is present as an assistant message in the chat after cancellation.
- Metric 3: No orphaned Copilot SDK child processes remain after a cancelled run (verified via `ps` or process monitor during manual testing).
- Metric 4: TypeScript type-check (`npx tsc --noEmit`) passes with zero errors after implementation.

## Open Questions

- [ ] Should cancelled messages receive a visual badge (e.g. a subtle "⏹ stopped" tag) in the final message bubble? (Deferred — out of scope for this spec, can be a follow-up.)
- [ ] Should pressing `Escape` in the textarea trigger cancel, or is that too easy to hit accidentally? (Included as an optional task in the Stop button UI story.)
- [ ] Does `vertex-runner.ts` already have `req.on("close")` handling equivalent to `copilot-runner.ts`? (Must be verified during implementation of the backend cleanup story.)

## User Stories

| Story | File |
|---|---|
| Wire AbortController into handleSend | [stories/abort-controller-wiring.md](stories/abort-controller-wiring.md) |
| Add Stop button to ChatInterface | [stories/stop-button-ui.md](stories/stop-button-ui.md) |
| Save partial content on cancel | [stories/partial-content-save.md](stories/partial-content-save.md) |
| Propagate abort signal through Route Handler | [stories/route-handler-signal-propagation.md](stories/route-handler-signal-propagation.md) |
| Verify backend cleanup on disconnect | [stories/backend-cleanup-on-disconnect.md](stories/backend-cleanup-on-disconnect.md) |
