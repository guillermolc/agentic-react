# Feature: External KDB & Session Management

## Overview

This feature bundles two improvements to the Web-Spec agent pipeline. First, it adds session lifecycle management to the Dashboard — users can delete individual sessions or clear all sessions stored in localStorage. Second, it introduces full-stack support for **External KDBs**: user-configured instances of the KDB-Vector-Grafo-v2 API (Coderag) that can be queried by backend agents as additional context, alongside the existing Copilot Spaces integration. Both Copilot and Vertex providers benefit from external KDB context since it is injected into the system prompt before any runner is invoked.

## Problem Statement

Sessions accumulate indefinitely in localStorage with no way to remove stale or unwanted entries; the dashboard can become cluttered over time. Separately, users who maintain their own Coderag (KDB-Vector-Grafo-v2) instances have no way to connect them to the agent pipeline — agents are blind to their indexed codebases. Copilot Spaces only covers GitHub Copilot workspaces, leaving self-hosted knowledge bases unused.

## Goals

- [ ] Allow users to delete individual sessions from the dashboard
- [ ] Allow users to clear all sessions at once from the dashboard
- [ ] Allow admins/users to register external KDB instances (baseUrl + repoId) in the app
- [ ] Expose a backend CRUD API for managing external KDB configurations
- [ ] Implement a provider-agnostic query service that calls `POST /query` on a KDB instance
- [ ] Inject external KDB query results into the agent system prompt before running (works with both Copilot and Vertex)
- [ ] Add a two-tab KDB page: "Copilot Spaces" (existing) and "External KDBs" (new)
- [ ] Add a `KDBSelector` component to the chat toolbar so users can attach one or more external KDBs to a conversation
- [ ] Wire `kdbRefs` into the `/api/agent/run` request body

## Non-Goals

- Repo ingestion management (indexing repos into the KDB) — the KDB is assumed to be pre-populated
- Authentication/login flows for the external KDB service — `apiKey` is optional and stored as-is
- Real-time KDB health checks in the UI on every page load
- Support for `POST /inventory/query` — only `POST /query` (RAG answer + citations) is used
- Persisting external KDB selections across sessions (selection lives in component state only)

## Target Users / Personas

| Persona | Description |
|---|---|
| Product Manager | Uses Web-Spec to generate PRDs; wants to ground agent output in their team's private codebase indexed in a self-hosted Coderag instance |
| Engineering Lead | Uses Web-Spec for technical docs; needs to reference a specific repo in a Coderag KDB alongside GitHub Copilot Spaces |
| Power User | Accumulates many sessions over time and wants a quick way to clean up the dashboard |

## Functional Requirements

1. The system shall provide a `deleteSession(id: string)` function in `frontend/lib/storage.ts` that removes one session from the `web_spec_sessions` localStorage array by ID.
2. The system shall show a `Trash2` icon delete button on each session row in the dashboard; clicking it calls `deleteSession` and updates local state without navigating away.
3. The system shall show a "Clear all" button in the Sessions section header (only when sessions exist); clicking it calls `clearAllSessions()` and resets local state.
4. The system shall add an `external_kdbs` table to the backend SQLite database with columns: `id` (UUID), `name` (text), `baseUrl` (text), `repoId` (text), `apiKey` (text, nullable), `description` (text, nullable), `createdAt` (datetime ISO string).
5. The system shall expose `GET /api/kdb/external` returning all configured external KDBs with `apiKey` masked.
6. The system shall expose `POST /api/kdb/external` accepting `{ name, baseUrl, repoId, apiKey?, description? }` and returning the created record.
7. The system shall expose `DELETE /api/kdb/external/:id` removing the record by ID.
8. The system shall implement a `queryKDB(baseUrl, repoId, apiKey, queryText)` function in `backend/src/lib/kdb-query.ts` that calls `POST {baseUrl}/query` with body `{ repo_id: repoId, query: queryText, top_k: 10 }`, returns the `answer` string from the response, and caps total returned content at 4000 characters.
9. The system shall update `POST /api/agent/run` to accept an optional `kdbRefs: string[]` field (array of external KDB IDs), query each one using `queryKDB`, and inject results as a `kdbContextBlock` into the system prompt (same pattern as `workiqBlock`).
10. The system shall update `frontend/app/kdb/page.tsx` to show two tabs: "Copilot Spaces" (existing UI) and "External KDBs" (list + add/delete form).
11. The system shall implement `frontend/components/KDBSelector.tsx` as a multi-select dropdown for selecting registered external KDBs to attach to a chat.
12. The system shall update the chat input toolbar (`AgentForm.tsx` or equivalent) to include the `KDBSelector` and pass `kdbRefs` to the run request.

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | KDB queries run concurrently per-ref using `Promise.all`; each query timeouts after 10 seconds to avoid blocking the SSE stream startup |
| Security | `apiKey` values are stored in SQLite on the server only; never returned to the frontend in plaintext; sent as a bearer token in `Authorization: Bearer <apiKey>` header to the KDB if provided |
| Accessibility | Tab switcher on /kdb page must be keyboard-accessible; delete buttons must have `aria-label` attributes |
| Reliability | If a KDB query fails (network error, 422, 503), the error is logged and that KDB is skipped — the agent run continues without that context |

## UX / Design Considerations

- **Session delete button**: Small `Trash2` icon button on the right side of each session row (after the message count badge). Uses `text-muted hover:text-red-400 transition-colors` styling. No confirmation modal.
- **"Clear all" button**: Text button next to the "Recent Sessions" section heading. Small, muted red color (`text-red-400 hover:text-red-300 text-xs`).
- **KDB page tabs**: Two pill/tab buttons at the top of the page (`Copilot Spaces`, `External KDBs`). Active tab has `bg-surface-2 text-text-primary`; inactive has `text-text-secondary hover:text-text-primary`. Matches design patterns from other pages.
- **External KDB list**: Each row shows `name`, `baseUrl`, `repoId`, masked `apiKey` (show `••••••` if set), and a trash delete button.
- **Add KDB form**: Inline form below the list (no modal). Fields: Name, Base URL, Repo ID, API Key (optional), Description (optional). A single "Add" button submits; form clears on success.
- **KDBSelector**: Positioned next to `SpaceSelector` in the chat toolbar. Icon: `Database` (lucide). Shows a badge count when KDBs are selected. Tooltip "Add external KDBs on the /kdb page" when no KDBs are configured.

## Technical Considerations

- The KDB-Vector-Grafo-v2 API (`POST /query`) takes `{ repo_id, query, top_n?, top_k? }` and returns `{ answer, citations, diagnostics }`. Only `answer` is used as context; citations are omitted to keep the prompt compact.
- No authentication header is required by default. If `apiKey` is set on the KDB record, it is sent as `Authorization: Bearer <apiKey>`.
- `repoId` is a required field in `QueryRequest` — this is the identifier of the indexed repository within the KDB instance, not the GitHub repo path. Users must know it from their Coderag setup.
- The backend already proxies `/api/kdb/*` routes; the new `kdb-external.ts` router should be mounted under the existing `kdbRouter` or the main router at `/api/kdb/external`.
- Frontend fetches to external KDB backend routes go through the Next.js rewrite `/api/backend/*` → `http://localhost:3001/api/*` already configured in `next.config.mjs`.

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `backend/src/lib/db.ts` | Internal | Must add `external_kdbs` table migration |
| `backend/src/routes/kdb.ts` | Internal | Mount new `kdbExternalRouter` under `/external` sub-path |
| `frontend/components/SpaceSelector.tsx` | Internal | Reference implementation for KDBSelector |
| `frontend/lib/spaces-cache.ts` | Internal | Pattern to follow for external KDB in-memory cache |
| KDB-Vector-Grafo-v2 API | External | Must be running and accessible from the backend server |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| KDB `POST /query` returns 422 (repo not ready) | Med | Med | Log and skip; surface as a non-blocking warning in SSE diagnostics |
| Long KDB query latency blocks SSE startup | Med | High | Run KDB queries before opening SSE stream with a 10s timeout per query |
| `apiKey` stored in plaintext in SQLite | Low | Med | Mask in all API responses; note in docs that DB file should be protected by OS permissions |
| `repoId` unfamiliar to non-technical users | Med | Low | Add placeholder text "e.g. mall" to the form field with a link to `/repos` endpoint on the KDB |

## Success Metrics

- Users can register, list, and delete external KDBs without leaving the app
- Agent responses on pages with attached external KDBs reference content from the KDB
- Dashboard session list can be cleaned up in one click
- Zero additional HTTP requests are made when no `kdbRefs` are provided

## Open Questions

- [ ] Should `GET /repos` be exposed as a discovery endpoint from the frontend (let users pick repoId from a dropdown instead of typing)?
- [ ] Should external KDB selections be persisted in `sessionStorage` like space selections to survive page refreshes?
- [ ] Should citations from `QueryResponse` be appended to the context block for traceability?

## User Stories

| Story | File |
|---|---|
| Session Delete Buttons | [stories/session-delete.md](stories/session-delete.md) |
| External KDB DB Model | [stories/external-kdb-db-model.md](stories/external-kdb-db-model.md) |
| External KDB CRUD API | [stories/external-kdb-crud-api.md](stories/external-kdb-crud-api.md) |
| External KDB Query Service | [stories/external-kdb-query-service.md](stories/external-kdb-query-service.md) |
| External KDB Agent Integration | [stories/external-kdb-agent-integration.md](stories/external-kdb-agent-integration.md) |
| KDB Page Tabs | [stories/kdb-page-tabs.md](stories/kdb-page-tabs.md) |
| KDB Selector Component | [stories/kdb-selector-component.md](stories/kdb-selector-component.md) |
| Wire KDB Selector into Chat | [stories/wire-kdb-selector-into-chat.md](stories/wire-kdb-selector-into-chat.md) |
