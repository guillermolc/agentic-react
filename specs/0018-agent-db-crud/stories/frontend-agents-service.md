# User Story: Replace hardcoded frontend agents with API

## Summary

**As a** developer,
**I want** the frontend to fetch the agents list from the backend API instead of using a hardcoded array,
**So that** any agent added or edited through the CRUD UI is immediately visible across the app without a code change.

## Description

Create `frontend/lib/agents-api.ts` with typed fetch helpers. Update `frontend/lib/context.tsx` to load agents from the API on mount and expose them via `useApp()`. Remove the hardcoded `AGENTS` constant from `frontend/lib/agents.ts` (keep the `AgentConfig` and `AgentAction` interfaces + `getAgent()` helper, which will now query from context). Update all components that reference `AGENTS` directly to use the context instead.

## Acceptance Criteria

- [ ] Given the app loads, when the backend is reachable, then `useApp().agents` is populated with the agents returned by `GET /api/agents`.
- [ ] Given an agent is created via the CRUD UI and the page is refreshed, when the agents list is fetched, then the new agent appears in the nav/pipeline.
- [ ] Given the hardcoded `AGENTS` array is removed, when `npx tsc --noEmit` runs in `frontend/`, then there are no TypeScript errors.
- [ ] Given the backend is unreachable on load, when the fetch fails, then the app does not crash and shows an empty agents list.

## Tasks

- [ ] Create `frontend/lib/agents-api.ts` with `fetchAgents()`, `createAgent()`, `updateAgent(slug, data)`, `deleteAgent(slug)` functions
- [ ] All functions in `agents-api.ts` should call the backend via `/api/backend/agents` (the existing Next.js backend proxy)
- [ ] Define `AgentRecord` interface in `agents-api.ts` matching all DB columns, with `tools` as `string[]`
- [ ] Add `agents: AgentRecord[]` and `setAgents: (agents: AgentRecord[]) => void` to the `AppContext` type in `context.tsx`
- [ ] In `context.tsx`, call `fetchAgents()` inside a `useEffect` on mount and populate context state
- [ ] Update `getAgent(slug)` in `frontend/lib/agents.ts` to accept the agents array from context instead of filtering `AGENTS`
- [ ] Remove the hardcoded `AGENTS` export from `frontend/lib/agents.ts`
- [ ] Find all components that import `AGENTS` directly and update them to use `useApp().agents`
- [ ] Verify `npx tsc --noEmit` passes in `frontend/`

## Dependencies

- Depends on: `backend-crud-api.md` (`GET /api/agents` endpoint must exist)

## Out of Scope

- Optimistic UI updates (fetch after every mutation is sufficient for v1)
- Real-time sync (WebSocket / SSE push for agent changes)
- Local caching beyond the context state

## Notes

- The Next.js `/api/backend/[...path]` proxy already forwards requests to the Express backend — use it to avoid CORS issues
- Keep the `AgentConfig` interface in `agents.ts` for UI-specific fields; `AgentRecord` in `agents-api.ts` is the DB representation
- `tools` comes from the DB as a parsed array (the backend route handles deserialisation)
