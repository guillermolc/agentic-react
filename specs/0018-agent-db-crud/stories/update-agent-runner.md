# User Story: Update agent runner to load config from database

## Summary

**As a** developer,
**I want** the `POST /api/agent/run` endpoint to load agent configuration from the database,
**So that** runtime agent changes made through the CRUD API are immediately reflected in new runs.

## Description

The existing `loadAgentConfig(slug)` function in `backend/src/routes/agent.ts` reads from the filesystem via `AGENT_FILE_MAP`. Replace this with a DB query using the `db` module. Remove all references to `AGENT_FILE_MAP` and `AGENTS_DIR` from the agent run route. The `agentFileMap.ts` file can be deleted once no code imports it.

## Acceptance Criteria

- [ ] Given `POST /api/agent/run` is called with a valid `agentSlug`, when the agent exists in the DB, then the run proceeds using the DB-stored `prompt`, `model`, and `tools`.
- [ ] Given `POST /api/agent/run` is called with an unknown `agentSlug`, when the agent does not exist in the DB, then it responds 400 with `"Unknown agent: <slug>"`.
- [ ] Given an agent's prompt is updated via `PUT /api/agents/:slug`, when a new run is triggered, then the updated prompt is used (no server restart needed).
- [ ] Given `agentFileMap.ts` is deleted, when `npx tsc --noEmit` runs in `backend/`, then there are no TypeScript errors.

## Tasks

- [ ] Open `backend/src/routes/agent.ts`
- [ ] Remove imports of `AGENT_FILE_MAP`, `AGENTS_DIR`, `fs`, `path`, and `yaml` that are only used by `loadAgentConfig`
- [ ] Replace `loadAgentConfig(slug)` implementation with a `db.prepare('SELECT * FROM agents WHERE slug = ?').get(slug)` call
- [ ] Parse `tools` from JSON string to array after fetching from DB
- [ ] Remove the `AgentFileConfig` interface (replace with the shared `Agent` type from `db.ts`)
- [ ] Delete `backend/src/lib/agentFileMap.ts`
- [ ] Verify no other file imports from `agentFileMap.ts`
- [ ] Run `npx tsc --noEmit` in `backend/` and fix any type errors

## Dependencies

- Depends on: `db-setup-and-schema.md`
- Depends on: `seed-existing-agents.md` (DB must have agents before this route is used)
- Depends on: `backend-crud-api.md` (establishes the `Agent` type from `db.ts`)

## Out of Scope

- Changing any other behaviour of the `/api/agent/run` endpoint (SSE streaming, workiq context, etc.)
- Caching agent configs in memory (each run does a fresh DB read)

## Notes

- `better-sqlite3` `.get()` returns `undefined` if no row is found — check for this and return 400
- Keep the `AgentFileConfig` interface removal clean: use the `Agent` type exported from `db.ts` everywhere
- The YAML files in `backend/agents/` are no longer read at runtime; they can be archived but this story does not delete them
