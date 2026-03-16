# User Story: Add Stop Button to ChatInterface

## Summary

**As a** user running an agent prompt,
**I want** a "Stop" button to appear in the chat input area while the agent is streaming,
**So that** I can cancel the generation at any time without refreshing the page.

## Description

> `ChatInterface.tsx` currently disables the textarea and hides/disables the Send button while `isStreaming === true`. A new "Stop" button must appear in place of the Send button during streaming, using the `Square` icon from `lucide-react` and the existing Tailwind theme tokens. An `onCancel` prop must be added to the `ChatInterfaceProps` interface and wired through from `app/agents/[slug]/page.tsx`.
>
> The button must be accessible and must not shift the layout — it occupies the same grid slot as the Send button.

## Acceptance Criteria

- [ ] Given `isStreaming === false`, when the input area renders, then the Send button is visible and the Stop button is not.
- [ ] Given `isStreaming === true`, when the input area renders, then the Stop button is visible and the Send button is not.
- [ ] Given the Stop button is visible and clicked, when the click handler fires, then `onCancel()` is called exactly once.
- [ ] Given `onCancel` is called, when `isStreaming` transitions to `false` (set by the parent after abort), then the Send button reappears and the textarea becomes enabled.
- [ ] Given the Stop button is rendered, when inspected for accessibility, then it has `aria-label="Stop generation"`.
- [ ] Given `disabled === true` (no repo selected), when the Stop button is rendered, then it is also disabled and visually muted.
- [ ] Given the user presses `Escape` while the textarea is focused and `isStreaming === true`, when the key event fires, then `onCancel()` is called (optional enhancement).

## Tasks

- [ ] Add `onCancel?: () => void` to the `ChatInterfaceProps` interface in `ChatInterface.tsx`
- [ ] Import `Square` from `lucide-react` in `ChatInterface.tsx`
- [ ] In the input row JSX, replace the current Send button conditional with: show the Stop button when `isStreaming`, show the Send button otherwise
- [ ] Style the Stop button to match the Send button's dimensions (`w-10 h-auto` or equivalent) using `bg-surface-2 border border-border rounded-xl` base classes, with `hover:border-red-400 hover:text-red-400` for hover state
- [ ] Add `aria-label="Stop generation"` to the Stop button element
- [ ] Add the `onCancel` prop to the `handleKeyDown` / `Escape` key handler in the textarea (optional — treat as stretch task)
- [ ] Add `onCancel` prop to the `<ChatInterface>` usage in `app/agents/[slug]/page.tsx`, wiring it to a `handleCancel` function
- [ ] Implement `handleCancel` in `app/agents/[slug]/page.tsx`: call `abortControllerRef.current?.abort()`
- [ ] Run `npx tsc --noEmit` in `frontend/` and confirm zero errors

## Dependencies

- Depends on: [abort-controller-wiring.md](abort-controller-wiring.md) — `abortControllerRef` must exist before `handleCancel` can call `.abort()`

## Out of Scope

- Saving partial content when cancelled — handled in `partial-content-save.md`
- Any backend changes

## Notes

- The `onCancel` prop is optional (`?`) so existing usages (if any other pages use `ChatInterface`) do not break.
- Icon choice: `Square` is a solid square that universally signals "stop". `StopCircle` is an acceptable alternative if preferred visually — confirm with design before implementing.
- Colour tokens to use: `text-text-secondary` default, `hover:text-red-400` hover — avoid raw `red-500` or `red-600` to keep the action from feeling overly alarming.
- The button must be `type="button"` to avoid accidentally submitting any surrounding form.
