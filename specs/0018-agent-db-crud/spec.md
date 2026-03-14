# Feature: Agent DB CRUD

## Overview

Migrate agent configurations from static YAML/MD files in `backend/agents/` to a persistent database. The backend exposes full CRUD REST endpoints to manage agents at runtime. The frontend gains a maintenance UI that allows developers and admins to create, edit, and delete agents without touching the codebase — replacing both the hardcoded `AGENTS` array in `frontend/lib/agents.ts` and the `AGENT_FILE_MAP` in `backend/src/lib/agentFileMap.ts`.

## Problem Statement

Agent configurations are currently split across two places: YAML files on disk (prompt, model, tools) and a hardcoded TypeScript array (UI metadata). Adding, editing, or removing an agent requires a code change and a redeploy. There is no way for an admin to manage agents at runtime, and the two sources of truth easily drift out of sync.

## Goals

- [ ] Store all agent configuration (both behavioural and UI metadata) in a single database table.
- [ ] Expose REST CRUD endpoints so agents can be managed without code changes.
- [ ] Replace `AGENT_FILE_MAP` and the hardcoded `AGENTS` array with dynamic DB-backed data.
- [ ] Provide a frontend maintenance page where admins can list, create, edit, and delete agents.
- [ ] Seed the database with the six existing agents on first run so there is no regression.

## Non-Goals

- Multi-tenancy or per-user agent permissions.
- Version history or audit log for agent changes.
- Importing/exporting agents as YAML (the YAML files remain as a source for the initial seed only).
- Authentication/authorisation for the CRUD endpoints (out of current scope — the app already relies on the PAT for auth).

## Target Users / Personas

| Persona | Description |
|---|---|
| Developer | Builds and maintains the Web-Spec app; needs to add or tweak agents quickly without a redeploy. |
| Admin | Operates the running instance; needs a UI to tune prompts and add new agents on the fly. |

## Functional Requirements

1. The system shall persist all agent records in a SQLite database file at `backend/data/agents.db`.
2. The system shall expose `GET /api/agents` returning all agents ordered by `createdAt`.
3. The system shall expose `GET /api/agents/:slug` returning a single agent or 404.
4. The system shall expose `POST /api/agents` to create a new agent, validating required fields (`slug`, `name`, `displayName`, `prompt`).
5. The system shall expose `PUT /api/agents/:slug` to update any field of an existing agent.
6. The system shall expose `DELETE /api/agents/:slug` to remove an agent.
7. The system shall seed the database from the existing YAML files on first startup when the table is empty.
8. The backend `POST /api/agent/run` endpoint shall load agent config from the database instead of the filesystem.
9. The frontend shall fetch the agents list from `GET /api/agents` on app load and cache in context.
10. The frontend shall include an `/admin/agents` page with a table listing all agents and actions to create, edit, and delete.
11. The frontend agent edit/create form shall expose all fields: `slug`, `name`, `displayName`, `description`, `model`, `tools`, `prompt`, `color`, `bgColor`, `borderColor`, `iconColor`, `nextAgent`, `quickPrompt`.

## Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Agent list must load in < 200 ms on localhost; DB queries should use indexed slug column. |
| Security | `slug` values must be validated against a safe pattern (`^[a-z0-9-]+$`) to prevent path traversal. |
| Accessibility | Admin CRUD forms must have labeled inputs and keyboard-navigable controls. |
| Scalability | SQLite is sufficient for single-instance deployments; the DB layer should be abstracted to ease future migration. |

## UX / Design Considerations

- The `/admin/agents` page fits inside the existing `/admin` section of the app.
- Agent list: table with columns `slug`, `displayName`, `model`, `nextAgent`, and action buttons (Edit, Delete).
- Edit/Create: a slide-over panel or dedicated route (`/admin/agents/new`, `/admin/agents/[slug]/edit`) with a form using the existing dark theme tokens.
- The `prompt` field uses a `<textarea>` with monospace font and sufficient height (min 12 rows).
- The `tools` field is a comma-separated text input that serialises to/from a JSON array.
- Destructive delete shows a confirmation dialog before sending the `DELETE` request.
- Use existing Tailwind theme tokens (`bg-surface-2`, `text-text-primary`, `border-border`, `text-accent`) throughout.

## Technical Considerations

- **Database**: Use `better-sqlite3` (synchronous, zero-config, no server) to keep the backend simple.
- **Schema**: Single `agents` table with all fields as TEXT/NULL, `slug` as PRIMARY KEY.
- **DB module**: Create `backend/src/lib/db.ts` that opens/creates the DB and exposes a typed query interface.
- **Seed logic**: Run once at startup; check `SELECT COUNT(*) FROM agents` — if 0, parse each YAML file and insert.
- **Router**: New `backend/src/routes/agents.ts` (plural) mounted at `/api/agents`, separate from the existing `/api/agent/run` route.
- **Frontend service**: `frontend/lib/agents-api.ts` with `fetchAgents()`, `createAgent()`, `updateAgent()`, `deleteAgent()` functions calling the backend via the existing `/api/backend` proxy.
- **Context**: Add `agents` and `setAgents` to the global `AppContext` so all pages share the same cached list.
- **ESM**: All backend imports use `.js` extensions per project convention.

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `better-sqlite3` | External (npm) | Sync SQLite driver; add to `backend/package.json`. |
| `@types/better-sqlite3` | External (npm, dev) | TypeScript types. |
| `yaml` | Internal | Already installed in backend; used for seeding. |
| Existing `/admin` page | Internal | New `/admin/agents` page extends the admin section. |
| `frontend/lib/context.tsx` | Internal | Must be updated to load and cache agents from API. |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SQLite file permissions on deployment | Low | High | Document `backend/data/` directory creation in README. |
| Slug collision during seed | Low | Med | Use `INSERT OR IGNORE` so re-seeding is idempotent. |
| Frontend using stale hardcoded agents during migration | Med | Med | Remove `AGENTS` constant and `AGENT_FILE_MAP` as part of the same PR. |
| `better-sqlite3` native binary rebuild | Low | Med | Document `npm rebuild` step; consider `sql.js` as pure-JS fallback. |

## Success Metrics

- All six existing agents load and run correctly after migration with zero file-system reads.
- An admin can create, edit, and delete an agent entirely through the UI with changes persisted after server restart.
- TypeScript compiles with `npx tsc --noEmit` in both packages with no errors.

## Open Questions

- [ ] Should the `/admin/agents` page be protected behind the existing PAT check, or is it open on localhost?
- [ ] Should `model` be a free-text field or a dropdown of known Copilot model identifiers?
- [ ] Do we need to keep the YAML files around as a backup / source-of-truth, or can they be deleted post-migration?

## User Stories

| Story | File |
|---|---|
| Set up SQLite database and schema | [stories/db-setup-and-schema.md](stories/db-setup-and-schema.md) |
| Seed existing agents from YAML files | [stories/seed-existing-agents.md](stories/seed-existing-agents.md) |
| Expose backend CRUD REST API for agents | [stories/backend-crud-api.md](stories/backend-crud-api.md) |
| Update agent runner to load from DB | [stories/update-agent-runner.md](stories/update-agent-runner.md) |
| Replace hardcoded frontend agents with API | [stories/frontend-agents-service.md](stories/frontend-agents-service.md) |
| Build frontend agents CRUD maintenance UI | [stories/frontend-agents-crud-ui.md](stories/frontend-agents-crud-ui.md) |
