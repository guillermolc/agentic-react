# User Story: Atlassian Backend Client & Status

## Summary

**As a** developer,
**I want** a shared backend module that provides auth headers, base URLs, and configuration status for Jira and Confluence Server,
**So that** all Atlassian routes can use a single, consistent source of truth for credentials — read from env vars, never from the request body.

## Description

Create `backend/src/lib/atlassian/atlassian-client.ts` with helpers that return the correct Bearer auth headers and base URLs for Jira Server (`JIRA_URL` / `JIRA_PAT`) and Confluence Server (`CONFLUENCE_URL` / `CONFLUENCE_PAT`). Also expose a `GET /api/atlassian/status` endpoint that the frontend uses to determine whether to show/hide the `AtlassianSelector` component.

This is the foundation that all other Atlassian backend stories depend on.

## Acceptance Criteria

- [ ] Given `getJiraHeaders()` is called, then it returns `{ Authorization: "Bearer {JIRA_PAT}", Accept: "application/json" }` reading from `process.env.JIRA_PAT`.
- [ ] Given `getConfluenceHeaders()` is called, then it returns `{ Authorization: "Bearer {CONFLUENCE_PAT}", Accept: "application/json" }` reading from `process.env.CONFLUENCE_PAT`.
- [ ] Given `getJiraUrl()` is called, then it returns the value of `process.env.JIRA_URL`.
- [ ] Given `getConfluenceUrl()` is called, then it returns the value of `process.env.CONFLUENCE_URL`.
- [ ] Given `isAtlassianConfigured("jira")`, then it returns `true` only if both `JIRA_URL` and `JIRA_PAT` are set and non-empty.
- [ ] Given `isAtlassianConfigured("confluence")`, then it returns `true` only if both `CONFLUENCE_URL` and `CONFLUENCE_PAT` are set and non-empty.
- [ ] Given a `GET /api/atlassian/status` request, when the endpoint is called, then it returns `{ jira: boolean, confluence: boolean }` based on the configured env vars.
- [ ] Given `JIRA_URL` has a trailing slash, then `getJiraUrl()` strips it before returning (prevent double-slash URLs).
- [ ] Given env vars are missing, then the status endpoint returns `{ jira: false, confluence: false }` — no 500 error.

## Tasks

- [ ] Create `backend/src/lib/atlassian/` directory
- [ ] Create `backend/src/lib/atlassian/atlassian-client.ts` with `getJiraHeaders()`, `getConfluenceHeaders()`, `getJiraUrl()`, `getConfluenceUrl()`, `isAtlassianConfigured(service)`
- [ ] Strip trailing slashes from URL helpers
- [ ] Create `backend/src/routes/atlassian.ts` with an Express Router
- [ ] Add `GET /status` route on the atlassian router returning `{ jira, confluence }` from `isAtlassianConfigured`
- [ ] Mount `atlassianRouter` in `backend/src/index.ts` under `/api/atlassian`
- [ ] Add `JIRA_URL`, `JIRA_PAT`, `CONFLUENCE_URL`, `CONFLUENCE_PAT` to `backend/.env` (with placeholder values and comments)
- [ ] Run `npx tsc --noEmit` in `backend/` — zero errors

## Dependencies

- Depends on: `backend/src/index.ts` for route mounting
- All other Atlassian backend stories depend on: this story

## Out of Scope

- Actual Jira or Confluence API calls (handled in search and download stories)
- Any frontend component changes

## Notes

- All local imports in backend use `.js` extension (ESM)
- The helper module uses simple function exports — no class, no singleton
- If `process.env.JIRA_URL` includes a trailing slash, strip it: `url.replace(/\/$/, '')`
- Only verify env vars are set (truthy string check) — do not make a network call to verify connectivity in the status endpoint
