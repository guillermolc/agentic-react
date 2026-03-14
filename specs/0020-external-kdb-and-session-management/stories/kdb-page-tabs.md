# User Story: KDB Page Tabs

## Summary

**As a** user,
**I want** the KDB page to show separate tabs for Copilot Spaces and External KDBs,
**So that** I can manage all my knowledge base connections from one place without mixing two different data sources.

## Description

`frontend/app/kdb/page.tsx` currently only renders Copilot Spaces. This story refactors it to show two tab panels:

1. **Copilot Spaces** — existing functionality (moved into a tab panel, no behaviour change)
2. **External KDBs** — new panel that fetches from `GET /api/backend/kdb/external`, renders the list of registered KDBs, and provides an inline add/delete form

The tab switcher sits between the page header and the content area. Use local `useState` to track the active tab — no router involvement needed.

The external KDB list/form makes direct `fetch` calls to `/api/backend/kdb/external` (which is proxied to the backend by Next.js rewrites).

## Acceptance Criteria

- [ ] Given the KDB page loads, when it renders, then a two-tab switcher is shown: "Copilot Spaces" and "External KDBs", with "Copilot Spaces" active by default.
- [ ] Given "Copilot Spaces" tab is active, when the page renders, then the existing spaces list UI (unchanged) is shown.
- [ ] Given "External KDBs" tab is active, when the page renders, then the list of registered external KDBs is fetched from the backend and shown.
- [ ] Given the external KDB list is empty, when the tab is shown, then an empty state message is displayed prompting the user to add their first KDB.
- [ ] Given the add KDB form is submitted with valid fields (name, baseUrl, repoId), when the form submits, then `POST /api/backend/kdb/external` is called, the form clears, and the new KDB appears in the list.
- [ ] Given the add KDB form is submitted without a required field, when the form submits, then client-side validation blocks submission and shows an inline error.
- [ ] Given a KDB row has a delete button, when it is clicked, then `DELETE /api/backend/kdb/external/:id` is called and the row is removed from the list.
- [ ] Given the API call fails, when the error occurs, then an inline error message is displayed and the form/list remain usable.

## Tasks

- [ ] Add a `activeTab: "spaces" | "external"` state to `frontend/app/kdb/page.tsx`
- [ ] Render a tab switcher UI (two pill buttons) with appropriate active/inactive styling using existing design tokens
- [ ] Wrap existing Copilot Spaces content in a conditional block shown only when `activeTab === "spaces"`
- [ ] Create the "External KDBs" tab panel as an inline section within the same file (no separate component needed)
- [ ] Implement `fetchExternalKdbs()` using `fetch("/api/backend/kdb/external")` and manage `externalKdbs` state
- [ ] Call `fetchExternalKdbs()` lazily on first tab activation (only fetch when tab is first opened)
- [ ] Render each external KDB row: `name`, `baseUrl`, `repoId`, masked `apiKey` (`••••••` if set, `—` if not), `description`, and a `Trash2` delete button
- [ ] Implement `deleteExternalKdb(id)` calling `DELETE /api/backend/kdb/external/:id` and updating local state
- [ ] Add an "Add External KDB" inline form with fields: Name (required), Base URL (required, placeholder `http://localhost:8000`), Repo ID (required, placeholder `e.g. mall`), API Key (optional), Description (optional)
- [ ] Implement form submission: `POST /api/backend/kdb/external`, clear form on success, refresh list
- [ ] Add loading and error states for the external KDBs list and form

## Dependencies

- Depends on: [external-kdb-crud-api.md](external-kdb-crud-api.md) — backend endpoints must exist

## Out of Scope

- Editing an existing external KDB (users delete and re-add)
- Fetching `GET /repos` from the KDB to populate a `repoId` dropdown
- Displaying KDB health status

## Notes

- The `ExternalKdb` data shape from the backend response: `{ id, name, baseUrl, repoId, apiKey: "••••••" | null, description, createdAt }`.
- Design tokens to use: `bg-surface`, `bg-surface-2`, `border-border`, `text-text-primary`, `text-text-secondary`, `text-muted`, `text-accent`.
- The tab switcher can be implemented as two `<button>` elements; no third-party tabs library needed.
- Follow the same section/card layout style as the existing Copilot Spaces content.
