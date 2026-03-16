# User Story: Export Session as Markdown from Dashboard

## Summary

**As a** user reviewing past sessions on the Dashboard,
**I want** to download any session as a `.md` file directly from the sessions list,
**So that** I can export older sessions without having to navigate back into the agent page.

## Description

Each session card in the Dashboard (`/dashboard`) gains a small `Download` icon button, positioned alongside the existing `Trash2` delete button. Clicking it calls `downloadMarkdown` from `frontend/lib/export.ts` with the full session data, triggering a file download. The page does not navigate and the sessions list remains visible.

## Acceptance Criteria

- [ ] Given the Dashboard sessions list, when at least one session exists, then each session card shows a `Download` icon button to the right of the card.
- [ ] Given the Download button is clicked, when the download is triggered, then the browser downloads a file named `{agentSlug}-{repoName}-{YYYY-MM-DD}.md` without navigating away.
- [ ] Given the downloaded file, when opened, then it has the same structure as a session exported from the agent page (same `sessionToMarkdown` output).
- [ ] Given the Download button, when rendered, then it has `aria-label="Download session as Markdown"` and is keyboard-focusable.
- [ ] Given the Download button is clicked, when the click propagates, then it does not trigger navigation to the session (click event is stopped from bubbling to the parent card link/button if one exists).

## Tasks

- [ ] Import `Download` icon from `lucide-react` in `frontend/app/dashboard/page.tsx`
- [ ] Import `downloadMarkdown` and `sessionToMarkdown` from `frontend/lib/export.ts`
- [ ] Add `Download` icon button to each session card in the sessions list JSX
- [ ] Wire `onClick` to call `downloadMarkdown(filename, sessionToMarkdown(session, agentName))` where `agentName` is resolved via `getAgent(session.agentSlug, agentRecords)?.name ?? session.agentSlug`
- [ ] Derive `repoName` from `session.repoFullName.split("/")[1] ?? session.repoFullName` for the filename
- [ ] Add `e.stopPropagation()` in the button `onClick` handler to prevent parent navigation
- [ ] Apply `text-text-secondary hover:text-accent transition-colors` styling consistent with the Trash2 button
- [ ] Add `aria-label="Download session as Markdown"` to the button

## Dependencies

- Depends on: Story `export-session-agent-page.md` — requires `frontend/lib/export.ts` (`sessionToMarkdown`, `downloadMarkdown`) to exist first.

## Out of Scope

- Bulk download of all sessions
- Any changes to session card layout beyond adding the icon button
- Changing the delete flow

## Notes

- The dashboard session card currently has a `Trash2` delete button; place the `Download` button immediately to its left, using the same size (`size={14}`) and button padding to keep the action group visually consistent.
- Use the same date for the filename as export from the agent page: `new Date().toISOString().slice(0, 10)` (export timestamp, not session creation timestamp).
- `session.repoFullName` is stored as `"owner/repo"` — split on `/` to get the bare repo name for the filename slug.
