# User Story: Wire Atlassian Context into Agent

## Summary

**As a** Product Manager,
**I want** downloaded Jira and Confluence documents to be automatically injected into the agent's system prompt when I run an agent session,
**So that** I don't have to copy and paste Jira content manually — the agent already has the context from the documents I downloaded.

## Description

Update `backend/src/routes/agent.ts` to check the Atlassian context folder and inject its contents into the system prompt. Also add the `AtlassianSelector` to `frontend/components/ChatInterface.tsx` next to the existing `KDBSelector`. No `onSelectionChange` prop is needed since the backend automatically reads all downloaded documents — the frontend just surfaces the download UI.

Note: This story wires the "auto-inject" path. The full parallelization refactor is the in the Context Orchestrator story — this story does the minimal `agent.ts` change needed to make Atlassian context work. The orchestrator story will then refactor it cleanly.

## Acceptance Criteria

- [ ] Given the `{WORK_DIR}/context/atlassian/` folder has 2 downloaded documents, when a `POST /api/agent/run` request is made, then the agent system prompt contains the contents of those documents under an "Atlassian Context" heading.
- [ ] Given the atlassian context folder is empty or does not exist, when the agent runs, then no atlassian block is added and the agent runs normally without error.
- [ ] Given the total document content exceeds 8000 chars, when the block is built, then it is truncated with a notice (handled by `readAllDocuments()` in document-store).
- [ ] Given `AtlassianSelector` is rendered in the `ChatInterface` toolbar, when the component is visible, then it appears next to the `KDBSelector` and behaves correctly (open/close, search, download).
- [ ] Given `disabled` is `true` on `ChatInterface` (e.g., while streaming), when the toolbar is rendered, then `AtlassianSelector` is also disabled.

## Tasks

- [ ] Read `backend/src/routes/agent.ts` fully to understand current context assembly pattern
- [ ] Import `readAllDocuments` from `document-store.ts` in `agent.ts`
- [ ] Add atlassian context block: call `readAllDocuments()` — if non-empty, append `"\n\nAtlassian Context (Jira/Confluence documents):\n{content}"` to system prompt
- [ ] Guard the call with a try/catch — if `readAllDocuments()` throws (folder missing, I/O error), log the error and continue without the block
- [ ] Read `frontend/components/ChatInterface.tsx` to identify where `KDBSelector` is placed in the toolbar
- [ ] Add `AtlassianSelector` import to `ChatInterface.tsx`
- [ ] Render `<AtlassianSelector disabled={isLoading} />` next to `<KDBSelector>` in the toolbar
- [ ] Run `npx tsc --noEmit` in both `backend/` and `frontend/` — zero errors

## Dependencies

- Depends on: [Atlassian Download, Parser & Document Store](atlassian-download-and-parser.md) — `readAllDocuments()` from document-store
- Depends on: [AtlassianSelector Frontend Component](atlassian-selector-component.md) — component must exist
- Note: The Context Orchestrator story will later refactor the sequential context injection in `agent.ts` into `gatherAllContext()`. This story does the minimal working change first.

## Out of Scope

- Parallelization of context gathering (handled in Context Orchestrator story)
- Any new request body fields for controlling atlassian context
- Per-session document scoping (all downloaded docs are shared across sessions)

## Notes

- Place the atlassian block after the existing `kdbContextBlock` and before the final prompt in the system message
- The block label: `"Atlassian Context (Jira/Confluence documents):\n"` keeps it consistent with the kdb and workiq block labels already in the file
- `readAllDocuments()` handles the 8000 char cap internally — no need to add a limit here
- If this is the first story to run after the download story, verify the `WORK_DIR` expansion works correctly (e.g., `~/work` → `/Users/username/work`) using `os.homedir()`
