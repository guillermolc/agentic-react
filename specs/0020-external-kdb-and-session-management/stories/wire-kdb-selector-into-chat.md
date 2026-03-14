# User Story: Wire KDB Selector into Chat

## Summary

**As a** user chatting with an agent,
**I want** the `KDBSelector` visible in the chat input toolbar next to the `SpaceSelector`,
**So that** I can attach external KDB context to any agent conversation and have it reflected in the agent's response.

## Description

Add `KDBSelector` to the chat input toolbar — the component that renders the textarea and the send button. Examining `frontend/components/AgentForm.tsx` and `frontend/app/agents/[slug]/page.tsx` to find where `SpaceSelector` is rendered. Mount `KDBSelector` adjacent to it, manage `selectedKdbIds: string[]` in the parent component's state, and include `kdbRefs: selectedKdbIds` in the body of the `POST /api/agent/run` (or the Next.js proxy `POST /api/agent/run`) request.

The `kdbRefs` field must be passed alongside `spaceRefs`, `workiqContext`, `provider`, and `model` so the backend can resolve and query each registered KDB before invoking the runner.

## Acceptance Criteria

- [ ] Given the chat input toolbar renders, when the component mounts, then the `KDBSelector` button is visible to the left of the `SpaceSelector` button (or in a consistent toolbar position).
- [ ] Given the user selects one KDB in the dropdown, when the form is submitted, then the `POST /api/agent/run` request body includes `kdbRefs: ["<selected-id>"]`.
- [ ] Given no KDBs are selected, when the form is submitted, then `kdbRefs` is either absent or an empty array in the request body.
- [ ] Given the user selects multiple KDBs, when the form is submitted, then `kdbRefs` contains all selected IDs.
- [ ] Given a new conversation starts (user navigates to an agent page), when the page first renders, then `selectedKdbIds` is empty.
- [ ] Given `npx tsc --noEmit` in `frontend/`, when run after this change, then zero type errors.

## Tasks

- [ ] Read `frontend/components/AgentForm.tsx` (or the relevant component) to locate where `SpaceSelector` is rendered and where the run request body is assembled
- [ ] Add `selectedKdbIds: string[]` state (initialized to `[]`) in the component that owns the run request
- [ ] Import `KDBSelector` from `@/components/KDBSelector`
- [ ] Render `<KDBSelector onSelectionChange={setSelectedKdbIds} disabled={isStreaming} />` immediately before or after `<SpaceSelector .../>`
- [ ] Update the request body object sent to `/api/agent/run` (or the proxy route) to include `kdbRefs: selectedKdbIds`
- [ ] Run `npx tsc --noEmit` in `frontend/` and fix any type errors

## Dependencies

- Depends on: [kdb-selector-component.md](kdb-selector-component.md) — `KDBSelector` component must exist
- Depends on: [external-kdb-agent-integration.md](external-kdb-agent-integration.md) — backend must accept `kdbRefs`

## Out of Scope

- Displaying KDB context chips in the chat (like WorkIQ chips) — KDB context is silently injected into the system prompt, not shown in the conversation UI
- Resetting KDB selection when the agent handoff happens (can be a follow-up)

## Notes

- The exact file to edit depends on the current codebase structure. Likely candidates are `frontend/components/AgentForm.tsx` or `frontend/app/agents/[slug]/page.tsx`. Read both before editing.
- The `disabled` prop on `KDBSelector` should be set to `true` while the SSE stream is active (agent is generating a response), the same condition used for `SpaceSelector`.
- No visual KDB context chips need to be rendered in the message thread — unlike WorkIQ, KDB results are used purely as invisible grounding context.
