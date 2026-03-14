# Feature: Atlassian Integration and Bitbucket Server Cloning

## Overview

This feature ports and adapts the integrations from the `agentic-web-spec-custom/` reference project into the main `agentic-web-spec-main` codebase. It adds three capabilities: Bitbucket Server as an alternative repo provider (Part A), Jira and Confluence Server context integration via file-based document download (Part B), and a parallelized context orchestration layer that keeps `agent.ts` clean as new sources are added (Part C). All credentials are backend-only environment variables — the browser never handles secrets.

## Problem Statement

The app currently only clones GitHub repos and has no way to pull Jira issues or Confluence pages as agent context. The team runs Jira Server 7.x, Confluence Server 6.x, and Bitbucket Server on internal subdomains (`*.agile.bns`). Additionally, context assembly in `agent.ts` is sequential string concatenation that becomes hard to maintain as sources grow. This feature unlocks internal tooling for the product team and engineering leads while establishing a clean, parallel context-gathering architecture.

## Goals

- [ ] Support Bitbucket Server as a repo provider alongside GitHub (clone + search)
- [ ] Allow users to search Jira and Confluence, download selected items as plain-text files, and have them auto-injected as agent context
- [ ] Keep all Atlassian and Bitbucket credentials in backend env vars — never in the browser
- [ ] Replace sequential context string-concatenation in `agent.ts` with a parallel, error-isolated context-gatherer
- [ ] Handle self-signed SSL certs and old API versions (Jira REST API v2, Confluence 6.x)

## Non-Goals

- No vector database, embeddings, or LanceDB — documents are plain text files
- No Atlassian Cloud support (no ATATT tokens, no Cloud Basic auth with email:token)
- No shared `buildAtlassianUrl()` Cloud-subdomain construction
- No chat modes (`rag-only`, `api-only`) from the custom project
- No frontend credential storage or handling (no localStorage for secrets)
- No automated Confluence ingestion / background crawling — user selects items explicitly

## Target Users / Personas

| Persona | Description |
|---|---|
| Product Manager | Uses Web-Spec to generate PRDs grounded in Jira stories and Confluence specs from a Bitbucket Server codebase |
| Engineering Lead | Searches Bitbucket Server repos, attaches Jira epics + Confluence architecture docs as context for deep research and technical doc generation |
| Business Analyst | Searches Confluence wiki pages and Jira backlogs, feeds them as context to the PRD writer agent |

## Functional Requirements

1. The system shall accept a `provider` field (`"github" | "bitbucket-server"`) on `POST /api/repos/clone` and `POST /api/repos/search`, defaulting to `"github"` for backward compatibility.
2. The system shall clone Bitbucket Server repos using `git -c http.extraHeader="Authorization: Bearer {PAT}" -c http.sslVerify=false clone --depth 1`.
3. The system shall search Bitbucket Server repos via `{BITBUCKET_SERVER_URL}/rest/api/1.0/repos?name={query}&limit=20` with Bearer auth.
4. The frontend `RepoSelectorModal` shall display a provider picker (GitHub / Bitbucket Server) before showing search results.
5. The frontend `RepoBar` shall show a small provider label for the active repo.
6. The system shall expose `GET /api/atlassian/status` returning `{ jira: boolean, confluence: boolean }` based on configured env vars.
7. The system shall search Jira via JQL (`text ~ "{q}" OR summary ~ "{q}"`) against `{JIRA_URL}/rest/api/2/search` with Bearer auth.
8. The system shall search Confluence via CQL (`type=page AND (title~"{q}" OR text~"{q}")`) against `{CONFLUENCE_URL}/rest/api/content/search`, with a title-based fallback if CQL fails.
9. The system shall download Jira issues (with comments) as plain-text files to `{WORK_DIR}/context/atlassian/jira_{key}.txt`.
10. The system shall download Confluence pages as Markdown files to `{WORK_DIR}/context/atlassian/confluence_{id}_{title_slug}.txt`, using `body.view` with fallback to `body.storage` (NOT `body.export_view`).
11. The system shall convert Confluence HTML to Markdown using Cheerio + Turndown (ported from custom project).
12. The system shall expose `GET /api/atlassian/documents` (list) and `DELETE /api/atlassian/documents/:filename` endpoints.
13. The agent route shall automatically inject downloaded Atlassian documents into the system prompt when the context folder is non-empty.
14. The frontend shall display an `AtlassianSelector` toolbar dropdown allowing search, multi-select, and download of Jira/Confluence items.
15. Context assembly in `agent.ts` shall use a parallel `gatherAllContext()` function with `Promise.allSettled()` so any single source failure does not abort the agent run.

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Security | All Jira, Confluence, and Bitbucket credentials are backend env vars only. The frontend never sees secrets. |
| Security | No credentials logged or returned to the client. |
| SSL | Bitbucket Server git operations use `http.sslVerify=false`. Backend HTTP requests to `*.agile.bns` may need `NODE_TLS_REJECT_UNAUTHORIZED=0` or per-request agent. |
| Compatibility | Jira REST API v2 (Jira Server 7.x). Confluence REST API with `body.view` fallback (Server 6.x, no `export_view`). Bitbucket Server REST API 1.0. |
| Performance | Context gathering (KDB, Atlassian, WorkIQ) runs in parallel via `Promise.allSettled`. Each source has a timeout/error isolation. |
| Maintainability | `agent.ts` registers context sources via the `ContextSource` interface — adding new sources requires no changes to the core flow. |
| Accessibility | `AtlassianSelector` uses proper ARIA labels and keyboard navigation, consistent with `SpaceSelector.tsx` and `KDBSelector.tsx`. |

## UX / Design Considerations

- `RepoSelectorModal`: Add a provider toggle (GitHub | Bitbucket Server) at the top of the modal. Selecting Bitbucket Server shows a search field that queries the backend; GitHub works as it does today. Use the existing modal pattern.
- `RepoBar`: Show a small pill or icon suffix after the repo name when the active repo came from Bitbucket Server (e.g., a `GitBranch` or `Server` icon from lucide-react).
- `AtlassianSelector`: Follows the exact same toolbar dropdown pattern as `SpaceSelector.tsx` and `KDBSelector.tsx`. Has a Jira/Confluence tab toggle, a search box with debounce, checkbox result list, a "Download selected" button, and a badge showing the count of already-downloaded documents. If Jira/Confluence are not configured (env vars missing), shows a configuration hint message instead of search.
- When documents are being downloaded, show a spinner on the download button. On success, update the badge count.
- All styling uses the project's Tailwind tokens (`bg-surface-2`, `text-text-primary`, `border-border`, `text-accent`, `text-muted`, etc.) — no raw color classes.

## Technical Considerations

- **Part A — Bitbucket Server**: Port the `git -c http.extraHeader` clone pattern from `agentic-web-spec-custom/backend/src/routes/repos.ts`. The clone URL format is `{BITBUCKET_SERVER_URL}/scm/{projectKey}/{repoSlug}.git`. The frontend sends `repoFullName` as `"{projectKey}/{repoSlug}"`.
- **Part B — Atlassian**: Create `backend/src/lib/atlassian/` with `atlassian-client.ts` (auth helpers, URL getters), `confluence-parser.ts` (Cheerio + Turndown), and `document-store.ts` (file I/O capped at 8000 chars). Routes: `backend/src/routes/atlassian.ts` (search + status) and `backend/src/routes/atlassian-download.ts` (download + list + delete). Mount both in `index.ts` under `/api/atlassian`.
- **Part C — Context Orchestrator**: Create `backend/src/lib/context-gatherer.ts` with `ContextSource` interface and `gatherAllContext()`. Refactor `agent.ts` to register sources conditionally (kdbRefs, atlassian folder, workiqContext, spaceRefs, handoff context) then call `gatherAllContext()` once.
- **SSL**: Set `NODE_TLS_REJECT_UNAUTHORIZED=0` in `backend/src/index.ts` startup (guarded behind an env var flag like `ALLOW_SELF_SIGNED_SSL=true`) or use per-request `https.Agent({ rejectUnauthorized: false })`.
- **ESM imports**: All new backend files must use `.js` extension on local imports. Frontend uses standard absolute imports.
- **No new npm packages on frontend** beyond what's already there. Backend adds: `cheerio`, `turndown`, `@types/turndown`.

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `agentic-web-spec-custom/` reference project | Internal | Source of existing patterns to port: repos.ts, atlassian.ts, atlassian-ingestion.ts, IngestionService.ts, ConfluenceParser.ts, AtlassianSelector.tsx |
| `SpaceSelector.tsx` / `KDBSelector.tsx` | Internal | UI patterns to follow for `AtlassianSelector.tsx` |
| `backend/src/routes/agent.ts` | Internal | Must be refactored to use context-gatherer |
| `backend/src/routes/repos.ts` | Internal | Must be extended with Bitbucket Server support |
| `frontend/components/RepoSelectorModal.tsx` | Internal | Must be updated with provider picker |
| `frontend/components/RepoBar.tsx` | Internal | Must show provider label |
| `frontend/components/ChatInterface.tsx` | Internal | Must include AtlassianSelector |
| `cheerio` | External npm | HTML parsing for Confluence pages |
| `turndown` | External npm | HTML → Markdown conversion |
| `@types/turndown` | External npm | TypeScript types for turndown |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Confluence 6.x `body.view` missing in some instances | Med | Med | Fall back to `body.storage`; log which representation was used |
| Confluence 6.x CQL not fully supported | High | Low | Implement title-based fallback search immediately |
| Self-signed SSL cert rejections | High | High | Set `NODE_TLS_REJECT_UNAUTHORIZED=0` guarded by `ALLOW_SELF_SIGNED_SSL=true` env var |
| Jira 7.x REST API v2 field differences from Cloud | Med | Med | Map only standard fields: summary, description, comment, status, issuetype |
| Large Confluence pages crashing context window | Med | High | Cap `readAllDocuments()` at 8000 chars with truncation notice |
| Context gathering timeout blocking agent start | Low | High | Per-source timeout + `Promise.allSettled` ensures failures are isolated |

## Success Metrics

- Metric 1: A user can select Bitbucket Server, search for repos, and clone one successfully — the clone URL is built server-side.
- Metric 2: A user can search Jira, select 3 issues, click "Download", and those issues appear as `.txt` files in `{WORK_DIR}/context/atlassian/`.
- Metric 3: When a user sends a chat message, the agent system prompt contains the downloaded Atlassian documents without any extra user action.
- Metric 4: A single KDB timeout (e.g., external KDBVG down) does NOT prevent the agent from running — the remaining context sources are still used.
- Metric 5: `npx tsc --noEmit` in both `backend/` and `frontend/` passes with zero errors after implementation.

## Open Questions

- [ ] Should downloaded Atlassian documents persist between sessions (across server restarts), or should the user re-download on each session? (Current plan: they persist in the filesystem until explicitly deleted.)
- [ ] Should `ALLOW_SELF_SIGNED_SSL=true` be set globally in `.env` by default, or documented as opt-in? (Current plan: opt-in, documented in `.env.example`.)
- [ ] Should the `AtlassianSelector` auto-refresh the badge when a new document is downloaded by another tab? (Current plan: no — refresh on component remount only.)

## User Stories

> List of all user stories for this feature (links will be added as files are created).

| Story | File |
|---|---|
| Bitbucket Server Backend Foundation | [stories/bitbucket-server-backend.md](stories/bitbucket-server-backend.md) |
| Bitbucket Server Frontend Integration | [stories/bitbucket-server-frontend.md](stories/bitbucket-server-frontend.md) |
| Atlassian Backend Client & Status | [stories/atlassian-backend-client.md](stories/atlassian-backend-client.md) |
| Atlassian Search API | [stories/atlassian-search-api.md](stories/atlassian-search-api.md) |
| Atlassian Download, Parser & Document Store | [stories/atlassian-download-and-parser.md](stories/atlassian-download-and-parser.md) |
| Atlassian Document Management API | [stories/atlassian-document-management.md](stories/atlassian-document-management.md) |
| AtlassianSelector Frontend Component | [stories/atlassian-selector-component.md](stories/atlassian-selector-component.md) |
| Wire Atlassian Context into Agent | [stories/atlassian-context-injection.md](stories/atlassian-context-injection.md) |
| Context Orchestrator (Parallelization) | [stories/context-orchestrator.md](stories/context-orchestrator.md) |
