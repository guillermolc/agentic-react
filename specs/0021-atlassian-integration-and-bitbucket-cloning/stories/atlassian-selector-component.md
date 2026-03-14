# User Story: AtlassianSelector Frontend Component

## Summary

**As a** Product Manager or Business Analyst,
**I want** a toolbar dropdown in the chat interface where I can search Jira or Confluence, select items, and download them as context,
**So that** I can attach relevant Jira stories and Confluence pages to my agent session without leaving the Web-Spec UI.

## Description

Create `frontend/components/AtlassianSelector.tsx` following the same toolbar dropdown pattern as `SpaceSelector.tsx` and `KDBSelector.tsx`. On first open, it checks `GET /api/backend/atlassian/status` — if neither Jira nor Confluence is configured, it shows a configuration hint. Otherwise, it displays a search box with Jira/Confluence toggle, multi-select checkbox results, a "Download selected" button, and a badge showing the count of already-downloaded documents.

Reference: `agentic-web-spec-custom/frontend/components/AtlassianSelector.tsx` for the overall UX flow, `frontend/components/KDBSelector.tsx` and `SpaceSelector.tsx` for the exact toolbar dropdown pattern to follow in this codebase.

## Acceptance Criteria

- [ ] Given the toolbar is rendered and Jira is configured, when the user clicks the AtlassianSelector button, then a dropdown opens showing a Jira/Confluence toggle (only tabs for configured services) and a search box.
- [ ] Given neither Jira nor Confluence is configured, when the dropdown is opened, then a message appears: "Jira/Confluence not configured. Set JIRA_URL, JIRA_PAT, CONFLUENCE_URL, CONFLUENCE_PAT in backend .env".
- [ ] Given the user types a query and selects "Jira", when they stop typing (300ms debounce), then results appear as a checkbox list with issue key, title, and a short summary.
- [ ] Given the user types a query and selects "Confluence", when they stop typing, then results appear as a checkbox list with page title and summary.
- [ ] Given the user checks 2 items and clicks "Download selected", when the download completes, then a success state is shown and the badge count increments.
- [ ] Given a download is in progress, when the button is visible, then a spinner replaces the download button label.
- [ ] Given items are already downloaded (they appear in `GET /api/backend/atlassian/documents`), when the dropdown opens, then the badge on the toolbar button shows the document count.
- [ ] Given the dropdown is open and the user clicks outside, when a click-outside event fires, then the dropdown closes.
- [ ] Given `disabled` prop is true, when rendered, then the toolbar button is visually disabled and clicking does not open the dropdown.

## Tasks

- [ ] Read `frontend/components/KDBSelector.tsx` and `SpaceSelector.tsx` for exact dropdown structure, state patterns, and token usage
- [ ] Create `frontend/components/AtlassianSelector.tsx` with `AtlassianSelectorProps { disabled?: boolean }`
- [ ] Implement status check on first open: `GET /api/backend/atlassian/status` — cache result in component state to avoid re-fetching
- [ ] Implement Jira/Confluence toggle (`activeService: "jira" | "confluence"`) — only show tabs for configured services; default to `"jira"` if configured, else `"confluence"`
- [ ] Implement search with 300ms debounce and `POST /api/backend/atlassian/search` call
- [ ] Render checkbox result list with key (Jira) or title (Confluence), summary, and check state
- [ ] Implement `selectedItems` state as `Set<string>` keyed by item id
- [ ] Implement "Download selected" button: `POST /api/backend/atlassian/download`, loading state, success feedback
- [ ] On mount (or dropdown open), call `GET /api/backend/atlassian/documents` to populate badge count
- [ ] Refresh badge count after successful download
- [ ] Implement click-outside handler to close dropdown
- [ ] Use Tailwind tokens only: `bg-surface-2`, `border-border`, `text-text-primary`, `text-text-secondary`, `text-muted`, `text-accent`, `bg-background`
- [ ] Use lucide-react for icons: `BookOpen` or `FileText` for the toolbar button, `Check`, `Download`, `Loader2` for states
- [ ] Add `"use client"` directive at top of file
- [ ] Run `npx tsc --noEmit` in `frontend/` — zero errors

## Dependencies

- Depends on: [Atlassian Backend Client & Status](atlassian-backend-client.md) — status endpoint
- Depends on: [Atlassian Search API](atlassian-search-api.md) — search endpoint
- Depends on: [Atlassian Download, Parser & Document Store](atlassian-download-and-parser.md) — download endpoint
- Depends on: [Atlassian Document Management API](atlassian-document-management.md) — list endpoint for badge count
- Follows patterns from: `KDBSelector.tsx`, `SpaceSelector.tsx`

## Out of Scope

- Displaying the list of already-downloaded documents with delete buttons (future story or settings page)
- Any credential input in the frontend
- Showing download progress per-item (just a global spinner on the button is enough)

## Notes

- `"use client"` is required — uses state, effects, event handlers
- API calls go through `/api/backend/*` (Next.js route handler proxy to `localhost:3001`)
- The debounce can be implemented with `useEffect` + `setTimeout`/`clearTimeout` — no new dependency needed
- Clear search results and selected items when the toggle switches between Jira and Confluence
- Empty state when search returns no results: "No results for '{query}'" in `text-muted`
- Loading state during search: show a small `Loader2` spinner next to the search box
- The badge on the toolbar button should show `0` hidden (no badge) and show the count only when `> 0`
