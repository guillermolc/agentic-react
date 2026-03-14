# User Story: Atlassian Search API

## Summary

**As a** Product Manager or Business Analyst,
**I want** to search Jira issues and Confluence pages from the Web-Spec interface,
**So that** I can find relevant content to attach as context to agent sessions without leaving the app.

## Description

Add `POST /api/atlassian/search` to the atlassian router with full Jira (JQL) and Confluence (CQL + title fallback) search. Auth headers are built server-side from env vars. The endpoint normalizes results to a simple list shape so the frontend `AtlassianSelector` renders a uniform list regardless of source.

Reference: `agentic-web-spec-custom/backend/src/routes/atlassian.ts` — port search logic, replacing all credential-from-body and Cloud detection logic with the server-side env var helpers from `atlassian-client.ts`.

Confluence 6.x has limited CQL support — implement the CQL-first with title-based fallback strategy.

## Acceptance Criteria

- [ ] Given `POST /api/atlassian/search` with `{ query: "auth service", type: "jira" }`, when Jira is configured, then it calls `{JIRA_URL}/rest/api/2/search?jql=...&maxResults=20` with `Authorization: Bearer {JIRA_PAT}` and returns a normalized list.
- [ ] Given `POST /api/atlassian/search` with `{ query: "auth service", type: "confluence" }`, when Confluence is configured, then it first tries CQL search; if that fails (non-200 or error), it falls back to title-based search.
- [ ] Given a Jira search succeeds, then results are normalized to `[{ id, key, title, summary, url, type: "jira" }]` where `url` is `{JIRA_URL}/browse/{key}`.
- [ ] Given a Confluence search succeeds, then results are normalized to `[{ id, title, summary, url, type: "confluence" }]` where `summary` is the first 200 chars of plain text stripped from HTML.
- [ ] Given `type: "jira"` but `isAtlassianConfigured("jira")` returns false, when the endpoint is called, then it returns HTTP 503 with message "Jira is not configured".
- [ ] Given `type: "confluence"` but `isAtlassianConfigured("confluence")` returns false, when the endpoint is called, then it returns HTTP 503 with message "Confluence is not configured".
- [ ] Given network error or SSL error during search, when the error is thrown, then the endpoint returns HTTP 502 with the error message (not a 500 crash).
- [ ] Given `query` is an empty string, when the endpoint is called, then it returns HTTP 400.

## Tasks

- [ ] Add `POST /search` route to `backend/src/routes/atlassian.ts`
- [ ] Implement Jira search: build JQL `text ~ "{query}" OR summary ~ "{query}"`, call `{JIRA_URL}/rest/api/2/search` with `getJiraHeaders()`, map `issues[].{ id, key, fields.summary, fields.description, links }` to normalized shape
- [ ] Add `{JIRA_URL}/browse/{key}` as the `url` in Jira results
- [ ] Implement Confluence CQL search: call `{CONFLUENCE_URL}/rest/api/content/search?cql=...&limit=20&expand=body.view`
- [ ] Implement Confluence title fallback: if CQL returns non-2xx or empty array, call `{CONFLUENCE_URL}/rest/api/content?title={query}&limit=20&expand=body.view`
- [ ] Map Confluence results: `results[].{ id, title, body.view.value → strip HTML → first 200 chars → summary, _links.webui → url }`
- [ ] Build full Confluence `url` as `{CONFLUENCE_URL}{_links.webui}`
- [ ] Add input validation: require non-empty `query` and `type` in `"jira" | "confluence"`
- [ ] Add configured-check guards before making API calls
- [ ] Handle SSL errors and network errors — return 502 with message, not 500 crash
- [ ] Install no new dependencies (use built-in `fetch` available in Node 18+)
- [ ] Run `npx tsc --noEmit` in `backend/` — zero errors

## Dependencies

- Depends on: [Atlassian Backend Client & Status](atlassian-backend-client.md) — `getJiraHeaders()`, `getConfluenceHeaders()`, `isAtlassianConfigured()`

## Out of Scope

- Downloading or storing Jira/Confluence content (handled in download story)
- Pagination beyond `maxResults=20`/`limit=20`
- Searching Confluence spaces or Jira projects by name

## Notes

- Jira JQL: `text ~ "query" OR summary ~ "query"` — use double quotes inside the JQL string, pass as `jql` query param
- Confluence CQL: `type=page AND (title~"query" OR text~"query")` — URL-encode the full CQL string
- Confluence fallback uses `content` endpoint with `title` param — only matches title, not full text
- Strip HTML for `summary` using a simple regex: `str.replace(/<[^>]*>/g, '')` is sufficient for the summary preview (full parsing happens in download)
- Jira `fields.description` can be null — handle with optional chaining
- Reference: `agentic-web-spec-custom/backend/src/routes/atlassian.ts` for JQL/CQL construction, but replace all credential/host logic with the atlassian-client.ts helpers
