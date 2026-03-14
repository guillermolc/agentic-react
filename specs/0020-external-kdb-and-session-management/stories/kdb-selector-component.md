# User Story: KDB Selector Component

## Summary

**As a** user composing a message in an agent chat,
**I want** a dropdown to select one or more external KDBs to attach to the conversation,
**So that** I can ground the agent's response in my own indexed codebase without leaving the chat.

## Description

Create `frontend/components/KDBSelector.tsx`. It is modeled closely after `SpaceSelector.tsx` but with these key differences:
- Works with **both** Copilot and Vertex providers (no provider gating)
- Fetches from `/api/backend/kdb/external` instead of the spaces endpoint
- Uses `Database` icon (lucide) instead of `BookOpen`
- Shows a tooltip/message when no KDBs are configured, directing the user to `/kdb`
- Each item shows `name` and `repoId` for clarity

An in-memory cache module `frontend/lib/kdb-cache.ts` should be created following the exact pattern of `frontend/lib/spaces-cache.ts`.

## Acceptance Criteria

- [ ] Given no external KDBs are configured, when the component renders, then the button is visually dimmed and a tooltip explains that KDBs must be added on the /kdb page.
- [ ] Given external KDBs exist, when the user clicks the button, then a dropdown opens listing all KDBs with checkboxes.
- [ ] Given a KDB is selected, when toggled, then its ID is included in the `onSelectionChange` callback and a badge count appears on the button.
- [ ] Given multiple KDBs are selected, when the dropdown is open, then all selected items show a checkmark.
- [ ] Given a selection is active, when the user clicks the `X` clear button, then the selection is cleared and `onSelectionChange([])` is called.
- [ ] Given the dropdown is open, when the user clicks outside, then the dropdown closes.
- [ ] Given the component first opens with no prior fetch, when the dropdown is triggered, then `GET /api/backend/kdb/external` is called once; subsequent opens use cached data.
- [ ] Given the fetch fails, when the dropdown is open, then an error message is shown inside the dropdown with no crash.

## Tasks

- [ ] Create `frontend/lib/kdb-cache.ts` with `ExternalKdbEntry` interface (`{ id, name, baseUrl, repoId, description }`) and `fetchKdbsWithCache()` following the same deduplication/TTL pattern as `spaces-cache.ts`
- [ ] Create `frontend/components/KDBSelector.tsx` as a `"use client"` component
- [ ] Declare `KDBSelectorProps`: `{ onSelectionChange: (ids: string[]) => void; disabled?: boolean }`
- [ ] Render a `Database` icon button; show a numeric badge when `selected.size > 0`
- [ ] Implement `open` state toggled by clicking the button; fetch KDBs on first open using `fetchKdbsWithCache()`
- [ ] Render a floating dropdown panel (positioned below the button) with a scroll container
- [ ] For each KDB entry, render a row with `Check` icon (visibility tied to selection), `name` (bold), `repoId` (muted small text), and a click handler calling `toggleKdb(entry.id)`
- [ ] Implement clear (`X`) button in the dropdown header — only visible when `selected.size > 0`
- [ ] Close the dropdown on outside click using a `useRef` + `useEffect` event listener (same pattern as `SpaceSelector`)
- [ ] When KDB list is empty after fetch, render a message: "No external KDBs configured. Add them on the [/kdb](/kdb) page." with `text-muted text-xs`
- [ ] Export the component as a named export

## Dependencies

- Depends on: [external-kdb-crud-api.md](external-kdb-crud-api.md) — `GET /api/kdb/external` endpoint must exist to fetch from

## Out of Scope

- Provider-gating (component works with both Copilot and Vertex)
- Persisting selection in localStorage/sessionStorage

## Notes

- `ExternalKdbEntry` in the cache only needs the fields consumed by the UI; `apiKey` and `createdAt` are not needed.
- The cache TTL can be shorter than spaces (e.g., 5 minutes) since users may add a KDB and expect it to appear quickly.
- `kdb-cache.ts` should export: `ExternalKdbEntry`, `getCachedKdbs()`, `setCachedKdbs()`, `clearKdbCache()`, `fetchKdbsWithCache()`.
- The dropdown positioning (`absolute bottom-full mb-2` or `absolute top-full mt-2`) should be chosen based on the toolbar placement to avoid clipping by the viewport edge.
