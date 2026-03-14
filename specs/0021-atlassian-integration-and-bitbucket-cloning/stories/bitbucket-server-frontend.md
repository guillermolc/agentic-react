# User Story: Bitbucket Server Frontend Integration

## Summary

**As an** Engineering Lead,
**I want** to choose between GitHub and Bitbucket Server when searching and selecting a repository in the UI,
**So that** I can seamlessly use my internal Bitbucket Server repos in agent sessions without seeing or entering any credentials.

## Description

Update `frontend/components/RepoSelectorModal.tsx` to show a provider toggle (GitHub / Bitbucket Server) at the top of the modal. When Bitbucket Server is selected, the search box queries `POST /api/backend/repos/search?provider=bitbucket-server`. The clone request passes `provider` and `repoFullName` (`{projectKey}/{repoSlug}`) to the backend. Update `RepoBar.tsx` to display a small provider label when the active repo came from Bitbucket Server.

The frontend must NEVER handle or store Bitbucket credentials. It only passes the `provider` string to the backend.

## Acceptance Criteria

- [ ] Given the `RepoSelectorModal` is open, when the user sees it, then there is a provider toggle with "GitHub" and "Bitbucket Server" options; "GitHub" is selected by default.
- [ ] Given "Bitbucket Server" is selected and the user types a search query, when results appear, then they show Bitbucket Server repos with project key + slug format.
- [ ] Given the user clicks a Bitbucket Server repo and confirms, when the clone request is sent, then the request body includes `provider: "bitbucket-server"` and `repoFullName: "{projectKey}/{repoSlug}"`.
- [ ] Given "GitHub" is selected in the modal, when the user interacts with it, then the existing GitHub search and clone behavior is unchanged.
- [ ] Given a Bitbucket Server repo is the active repo in `RepoBar`, when the bar renders, then a small "Bitbucket" label or `Server` icon appears next to the repo name.
- [ ] Given the active repo is a GitHub repo, when `RepoBar` renders, then no provider label appears (backward compatible).

## Tasks

- [ ] Read `RepoSelectorModal.tsx` fully to understand current state management and API call patterns
- [ ] Add `provider` state (`"github" | "bitbucket-server"`) with default `"github"` to `RepoSelectorModal`
- [ ] Render a two-option toggle/tab above the search box in `RepoSelectorModal`
- [ ] Update the search call to pass `provider` in request body (or query param matching backend route)
- [ ] Update the clone call to pass `provider` and `repoFullName` in request body
- [ ] Normalize Bitbucket Server search results to the same display shape as GitHub results (name, description)
- [ ] Reset search results and input when provider changes
- [ ] Read `RepoBar.tsx` to understand how it reads the active repo
- [ ] Add optional `provider` field to the repo object stored in context/localStorage
- [ ] Render a small `Server` icon (lucide-react) or "Bitbucket" text label in `RepoBar` when provider is `"bitbucket-server"`
- [ ] Ensure label uses `text-muted` token and is visually subtle (does not overshadow repo name)
- [ ] Run `npx tsc --noEmit` in `frontend/` — zero errors

## Dependencies

- Depends on: [Bitbucket Server Backend Foundation](bitbucket-server-backend.md) — backend search + clone endpoints must exist
- Depends on: existing `RepoSelectorModal.tsx`, `RepoBar.tsx`, `context.tsx` repo state

## Out of Scope

- Any frontend display of Bitbucket credentials
- OAuth/SSO Bitbucket Server integration
- Showing Bitbucket Server pull requests or branches

## Notes

- Use the lucide-react `Server` icon for the Bitbucket Server provider label in `RepoBar`
- The provider toggle styling should follow the existing tab/toggle pattern in the app (check `kdb/page.tsx` for a two-tab example)
- The `repoFullName` for Bitbucket Server is `"{projectKey}/{repoSlug}"`. The display name shown in the modal and RepoBar can be the same format
- Store `provider` alongside the repo in `localStorage` (update storage.ts if needed, similar to how session data is stored)
