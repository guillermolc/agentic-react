# Feature: Export to Markdown

## Overview

Users can export AI-generated artifacts (Deep Research reports, PRDs, Technical Specs) from the Web-Spec chat interface as downloadable `.md` files, or copy individual assistant messages to the clipboard. This eliminates the current copy-paste friction by providing one-click export at both the session and message level, from both the agent chat page and the dashboard sessions list.

## Problem Statement

Users invest significant effort prompting agents and receive high-value output (research reports, PRDs, technical specs), but there is no way to save or share these artifacts beyond manual copy-paste. There is no persistent backend storage, so the only persistence layer is `localStorage`. Once a browser tab closes or storage is cleared the content is gone. An export mechanism lets users capture the output in a portable, reusable format without any backend changes.

## Goals

- [ ] Allow one-click download of a full session as a structured Markdown file from the agent chat page
- [ ] Allow one-click download of a full session as a Markdown file from the Dashboard sessions list
- [ ] Allow copying a single assistant message to the clipboard directly from the chat bubble
- [ ] Provide consistent visual feedback (icon state, tooltip) for all export/copy actions
- [ ] Centralise the Markdown serialisation logic in a single helper module

## Non-Goals

- No server-side file storage or cloud export (e.g. Google Drive, Notion)
- No PDF or HTML export
- No export of reasoning/thinking blocks (only the final message content is exported)
- No batch multi-session export
- No changes to the backend

## Target Users / Personas

| Persona | Description |
|---|---|
| Product Manager | Uses PRD Writer output as a starting draft; needs to paste it into Confluence or share via Slack |
| Engineer | Uses Technical Docs output as a reference; wants to commit the `.md` file to a repo |
| Researcher | Uses Deep Research output for async review; needs to save a snapshot before localStorage is cleared |

## Functional Requirements

1. The system shall provide an "Export" button on the agent chat page (`/agents/[slug]`) that is disabled until at least one assistant message exists in the session.
2. The system shall, when the Export button is clicked, serialise all messages in the current session to a Markdown string and trigger a browser file download.
3. The exported file name shall follow the pattern `{agentSlug}-{repoName}-{YYYY-MM-DD}.md`.
4. The exported Markdown document shall include a top-level heading (`# Session: {agentName} — {repoFullName}`), a metadata block (date, agent), and each message formatted as `## User` or `## {agentName}` sections in chronological order.
5. The system shall render a "Copy" icon button on every assistant `MessageBubble` in the chat, visible on hover.
6. When the Copy button is clicked the system shall write the raw markdown content of the message to the clipboard via `navigator.clipboard.writeText()`.
7. The Copy button shall display a "Copied!" label / changed icon for 1.5 seconds after a successful copy, then revert.
8. The system shall provide a "Download" icon button on each session card in the Dashboard (`/dashboard`) page.
9. When the Dashboard Download button is clicked the system shall serialise the full session and trigger a file download using the same format and naming convention as requirement 3.
10. The Markdown serialisation logic shall live in `frontend/lib/export.ts` and be the single source of truth used by both the agent page and the dashboard.

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Serialisation and Blob creation must be synchronous and complete in < 50ms for sessions up to 100 messages |
| Security | No external network requests during export; all data stays in-browser |
| Accessibility | Export and Copy buttons must have descriptive `aria-label` attributes; icon-only buttons must be keyboard-focusable |
| Compatibility | Must work in Chromium, Firefox, and Safari; `navigator.clipboard` usage guarded with a try/catch fallback |

## UX / Design Considerations

- **Export button (agent page):** Placed in the `ChatInterface` header area (or surfaced through the `agentActions` prop on the agent page). Uses the `Download` icon from `lucide-react`. Disabled (visually muted, `cursor-not-allowed`) when no assistant message exists. Tooltip: "Export session as Markdown".
- **Copy button (message bubble):** Small icon button (`Copy` icon, 14px) positioned in the top-right corner of each assistant bubble, visible `opacity-0 group-hover:opacity-100` transition. On success, swaps to `Check` icon for 1.5s with green tint.
- **Download button (dashboard):** Small `Download` icon button (16px) aligned to the right of the session card, next to the existing `Trash2` delete button. Same `text-text-secondary hover:text-accent` tokens.
- Theme tokens to use: `text-text-secondary`, `hover:text-accent`, `bg-surface-2`, `border-border`, `text-accent`.

## Technical Considerations

- Create `frontend/lib/export.ts` with:
  - `sessionToMarkdown(session: Session, agentName: string): string` — pure serialisation function
  - `downloadMarkdown(filename: string, content: string): void` — creates a `Blob`, a temporary `<a>` element, clicks it, and revokes the URL
- The agent page passes `session` (type `Session`) and `agent.name` into the export helper; the dashboard reads sessions from `getSessions()` and the agent name from `getAgent(session.agentSlug, agentRecords)`.
- `ChatInterface` receives an optional `onExport?: () => void` prop; the agent page wires it to the export helper. Alternatively, the Download icon can be placed directly in the agent page header outside `ChatInterface` to avoid prop drilling.
- No `"use client"` changes required beyond the existing component boundaries.
- Use `Date.toISOString().slice(0, 10)` for the date suffix in the filename.

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `lucide-react` | External | `Download`, `Copy`, `Check` icons — already installed |
| `frontend/lib/storage.ts` | Internal | `Session`, `Message` types; `getSessions()`, `getSession()` |
| `frontend/components/ChatInterface.tsx` | Internal | MessageBubble — needs Copy button added |
| `frontend/app/agents/[slug]/page.tsx` | Internal | Needs Export button wired to export helper |
| `frontend/app/dashboard/page.tsx` | Internal | Needs Download button on each session card |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `navigator.clipboard` not available (non-HTTPS or old browser) | Low | Med | Wrap in try/catch; fall back to `document.execCommand("copy")` with a textarea |
| Very large sessions causing UI jank during serialisation | Low | Low | Serialisation is synchronous string concatenation; 100 messages is well within budget |
| Blob URL leak if `revokeObjectURL` not called | Low | Low | Call `URL.revokeObjectURL` immediately after programmatic click in `downloadMarkdown` |
| Export button prop-drilling complexity through ChatInterface | Med | Low | Place Export button directly on the agent page header, outside ChatInterface, to avoid touching the component's existing interface |

## Success Metrics

- Metric 1: Export button is present and functional on all agent pages when an assistant message exists
- Metric 2: Downloaded `.md` file contains all messages in correct order with valid Markdown headings
- Metric 3: Copy button appears on hover for every assistant bubble and clipboard write succeeds
- Metric 4: Dashboard download button triggers file download without navigating away

## Open Questions

- [ ] Should reasoning/thinking blocks be optionally included in the export (behind a checkbox or config flag)?
- [ ] Should the Export button also appear in the `ActionPanel` output so users can save agent-action results?

## User Stories

| Story | File |
|---|---|
| Export current session as Markdown from agent page | [stories/export-session-agent-page.md](stories/export-session-agent-page.md) |
| Copy single assistant message to clipboard | [stories/copy-message-clipboard.md](stories/copy-message-clipboard.md) |
| Export session as Markdown from Dashboard | [stories/export-session-dashboard.md](stories/export-session-dashboard.md) |
