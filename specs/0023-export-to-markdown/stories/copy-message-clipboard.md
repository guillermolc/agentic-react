# User Story: Copy Single Assistant Message to Clipboard

## Summary

**As a** user reading an agent response in the chat,
**I want** to copy the raw markdown content of an individual assistant message with one click,
**So that** I can quickly paste a specific section into another tool without exporting the entire session.

## Description

Each assistant `MessageBubble` in `ChatInterface` gains a `Copy` icon button that appears on hover. When clicked, the raw markdown string (`msg.content`) is written to the clipboard via `navigator.clipboard.writeText()`. The button swaps to a `Check` icon with a green tint for 1.5 seconds as visual confirmation, then reverts. User messages do not get a Copy button. WorkIQ context messages do not get a Copy button.

## Acceptance Criteria

- [ ] Given an assistant message bubble, when the user hovers over it, then the Copy button becomes visible (`opacity-100`) in the top-right corner of the bubble.
- [ ] Given the Copy button is visible, when the user does not hover the bubble, then the Copy button is hidden (`opacity-0`).
- [ ] Given the Copy button is clicked, when the clipboard write succeeds, then the button icon changes to `Check` with `text-green-400` styling for exactly 1.5 seconds, then reverts to `Copy`.
- [ ] Given the Copy button is clicked, when the clipboard write fails (non-HTTPS or denied permission), then a try/catch silently swallows the error and the button does not change state.
- [ ] Given the Copy button is rendered, when a keyboard user focuses it, then it is reachable via Tab and has `aria-label="Copy message"`.
- [ ] Given a user message bubble, when it is rendered, then no Copy button is present.
- [ ] Given a WorkIQ context message bubble, when it is rendered, then no Copy button is present.

## Tasks

- [ ] Add `group` class to the assistant `MessageBubble` wrapper `div` in `ChatInterface.tsx`
- [ ] Add local `copied` boolean state with `useState(false)` inside `MessageBubble`
- [ ] Import `Copy` and `Check` icons from `lucide-react`
- [ ] Render a `<button>` with `absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity` inside the assistant bubble
- [ ] Wire button `onClick` to `navigator.clipboard.writeText(msg.content)` inside a try/catch
- [ ] On success, call `setCopied(true)` and schedule `setCopied(false)` after 1500ms via `setTimeout`
- [ ] Conditionally render `Check` (green) vs `Copy` (text-secondary) based on `copied` state
- [ ] Add `aria-label="Copy message"` to the button
- [ ] Ensure the button is not rendered when `isUser` or `isWorkIQ` is true

## Dependencies

- Depends on: Story `export-session-agent-page.md` — no hard dependency, but both touch `ChatInterface.tsx`; do in same PR to avoid conflicts.

## Out of Scope

- Copying reasoning/thinking block content
- Copy button on user messages
- Toast notification library — use local state only

## Notes

- The bubble wrapper currently uses `max-w-[80%] rounded-xl` — add `relative group` to that class list to enable the absolute-positioned button and hover group.
- Clear the `setTimeout` handle in a cleanup if the component unmounts before 1500ms to avoid a state update on an unmounted component: capture the return value of `setTimeout` in a `ref` or use a cleanup flag.
- Use `size={13}` for the `Copy` / `Check` icon to keep it unobtrusive within the bubble.
