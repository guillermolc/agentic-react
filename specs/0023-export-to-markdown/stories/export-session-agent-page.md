# User Story: Export Current Session as Markdown from Agent Page

## Summary

**As a** product manager or engineer using an agent page,
**I want** to download the full chat session as a `.md` file with a single click,
**So that** I can save, share, or commit the AI-generated artifact without copy-pasting.

## Description

On every agent page (`/agents/[slug]`), a `Download` icon button appears in the chat header area. When clicked, it serialises all messages in the current session using the shared `sessionToMarkdown` helper from `frontend/lib/export.ts` and triggers a browser file download. The button is disabled (muted, non-interactive) until at least one assistant message is present in the session.

## Acceptance Criteria

- [ ] Given the agent page has zero assistant messages, when the user views the header, then the Export button is visible but disabled (`opacity-50`, `cursor-not-allowed`).
- [ ] Given the agent page has at least one assistant message, when the user clicks the Export button, then the browser downloads a file named `{agentSlug}-{repoName}-{YYYY-MM-DD}.md`.
- [ ] Given the download is triggered, when the file is opened, then it contains a `# Session: {agentName} — {repoFullName}` heading, a metadata block, and each message as `## User` or `## {agentName}` sections in chronological order.
- [ ] Given the Export button is clicked, when the download starts, then no navigation occurs and the chat remains interactive.
- [ ] Given the `Download` icon button is rendered, when a keyboard user focuses it, then it is reachable via Tab and has a descriptive `aria-label="Export session as Markdown"`.

## Tasks

- [ ] Create `frontend/lib/export.ts` with `sessionToMarkdown(session: Session, agentName: string): string` pure function
- [ ] Add `downloadMarkdown(filename: string, content: string): void` to `frontend/lib/export.ts` (Blob + anchor click + `revokeObjectURL`)
- [ ] Import `Download` icon from `lucide-react` in the agent page
- [ ] Add Export button to the agent page header (outside `ChatInterface` to avoid prop drilling), wired to `downloadMarkdown`
- [ ] Derive `disabled` state from `messages.some(m => m.role === "assistant")`
- [ ] Apply `aria-label`, disabled styles (`opacity-50 cursor-not-allowed`), and `hover:text-accent` when enabled
- [ ] Construct filename as `${slug}-${activeRepo.repoName}-${new Date().toISOString().slice(0, 10)}.md`

## Dependencies

- Depends on: `frontend/lib/storage.ts` — `Session`, `Message` types, `getSession()`
- Depends on: `frontend/lib/export.ts` — must be created in this story (used by subsequent stories)
- Depends on: `frontend/app/agents/[slug]/page.tsx` — button placement

## Out of Scope

- Exporting reasoning/thinking blocks
- Exporting `ActionPanel` streaming output
- Any backend changes

## Notes

- Place the button in the page-level header row (same row as the back arrow and agent name), not inside `ChatInterface`, to keep `ChatInterface` props stable.
- Use `text-text-secondary hover:text-accent transition-colors` for the button styling.
- `repoName` for the filename should come from `activeRepo.repoName` (already available via `useApp()`).
