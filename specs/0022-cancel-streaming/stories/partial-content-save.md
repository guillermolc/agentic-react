# User Story: Save Partial Content on Cancel

## Summary

**As a** user who cancels an in-progress agent stream,
**I want** the partial response that was already generated to be saved as an assistant message,
**So that** I don't lose the content streamed so far and can reference it before sending a new prompt.

## Description

> Currently, `handleSend` in `app/agents/[slug]/page.tsx` only saves the assistant message after the `while(true)` reader loop completes successfully. When the stream is aborted, an `AbortError` is thrown and the `catch` block runs — but no partial content is saved. This story modifies the abort handling to save `accumulated` (and `accumulatedReasoning`) as an assistant message before returning from the catch.
>
> If `accumulated` is empty at the time of cancellation (e.g., the model was still in the reasoning phase), a minimal placeholder message shall be saved instead so the user can see that a run occurred and was stopped.

## Acceptance Criteria

- [ ] Given the user cancels while `accumulated` is non-empty, when the `AbortError` is caught, then an assistant message is added to the session with `content: accumulated` and `reasoning: accumulatedReasoning || undefined`.
- [ ] Given the user cancels while `accumulated` is empty (model was still reasoning), when the `AbortError` is caught, then an assistant message is added with `content: "⏹ Generation stopped."` (or equivalent brief placeholder).
- [ ] Given an assistant message is saved after cancel, when the messages list re-renders, then the saved message appears in the chat as a normal assistant bubble.
- [ ] Given the message is saved, when the session is inspected in `localStorage`, then the partial message is persisted (uses the existing `addMessageToSession` utility).
- [ ] Given the cancel flow runs, when the `finally` block executes, then `setIsStreaming(false)`, `setStreamingContent("")`, and `setStreamingReasoning("")` are all called (clearing the streaming overlay).
- [ ] Given a real (non-abort) network error occurs, when the catch block runs, then the existing `"⚠️ Error: ..."` error message behaviour is unchanged.

## Tasks

- [ ] In the `catch` block of `handleSend`, add an `AbortError` branch that:
  - Calls `addMessageToSession` with `{ role: "assistant", content: accumulated || "⏹ Generation stopped.", reasoning: accumulatedReasoning || undefined }`
  - Updates `messages` state and `sessionRef.current` with the returned session
  - Returns without adding an error message bubble
- [ ] Ensure `accumulated` and `accumulatedReasoning` variables are in scope in the catch block (they are declared outside the `while` loop — verify no shadowing issue)
- [ ] Confirm the `finally` block clears `isStreaming`, `streamingContent`, and `streamingReasoning` (already present — verify it still runs after the abort catch branch)
- [ ] Write a brief manual test: start a stream, wait for some chunks, click Stop, verify the partial message appears in chat and in `localStorage`
- [ ] Run `npx tsc --noEmit` in `frontend/` and confirm zero errors

## Dependencies

- Depends on: [abort-controller-wiring.md](abort-controller-wiring.md) — `AbortError` can only be thrown once `AbortController` is wired into the fetch call

## Out of Scope

- Visual "cancelled" badge or indicator on the partial message bubble
- Re-run / undo functionality

## Notes

- `accumulated` and `accumulatedReasoning` are `let` variables declared before the `while` loop in `handleSend`. Because the `catch` block is in the same function scope, they are accessible there without any restructuring.
- The placeholder text `"⏹ Generation stopped."` uses a Unicode stop symbol for visual clarity without requiring an icon in the message content. The exact wording can be adjusted during implementation.
- Do not use `streamingContent` state as the source of truth for the partial accumulated string — always use the `accumulated` local variable, which is always in sync with what has been sent to `addMessageToSession`.
