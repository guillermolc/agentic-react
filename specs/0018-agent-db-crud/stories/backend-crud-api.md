# User Story: Expose backend CRUD REST API for agents

## Summary

**As a** developer or admin,
**I want** REST endpoints to list, retrieve, create, update, and delete agents,
**So that** agents can be managed at runtime without modifying source files.

## Description

Create a new Express router at `backend/src/routes/agents.ts` (plural) mounted at `/api/agents`. This is separate from the existing `/api/agent/run` route. All endpoints read from and write to the `agents` SQLite table via the `db` module. The `tools` field is stored as a JSON string and must be parsed/serialised at the boundary.

## Acceptance Criteria

- [ ] Given a GET request to `/api/agents`, when agents exist, then it responds 200 with a JSON array of all agents ordered by `createdAt`.
- [ ] Given a GET request to `/api/agents/:slug`, when the agent exists, then it responds 200 with the agent object (tools as array).
- [ ] Given a GET request to `/api/agents/:slug`, when the agent does not exist, then it responds 404.
- [ ] Given a POST request to `/api/agents` with valid body, when the slug is unique, then it responds 201 with the created agent.
- [ ] Given a POST request to `/api/agents` with a missing required field (`slug`, `name`, `displayName`, or `prompt`), then it responds 400 with a descriptive error.
- [ ] Given a POST request to `/api/agents` with a duplicate slug, then it responds 409.
- [ ] Given a POST request with a slug that does not match `^[a-z0-9-]+$`, then it responds 400.
- [ ] Given a PUT request to `/api/agents/:slug` with a partial body, when the agent exists, then it responds 200 with the updated agent.
- [ ] Given a PUT request to `/api/agents/:slug`, when the agent does not exist, then it responds 404.
- [ ] Given a DELETE request to `/api/agents/:slug`, when the agent exists, then it responds 204 and the agent is removed.
- [ ] Given a DELETE request to `/api/agents/:slug`, when the agent does not exist, then it responds 404.

## Tasks

- [ ] Create `backend/src/routes/agents.ts` and export `agentsRouter` (plural, distinct from `agentRouter`)
- [ ] Implement `GET /` — query all agents, parse `tools` JSON, return array
- [ ] Implement `GET /:slug` — query by slug, parse `tools` JSON, return single agent or 404
- [ ] Implement `POST /` — validate required fields and slug pattern, insert row, return 201
- [ ] Implement `PUT /:slug` — check agent exists (404), merge body with existing row, update `updatedAt`, return 200
- [ ] Implement `DELETE /:slug` — check agent exists (404), delete row, return 204
- [ ] Add `agentsRouter` import and mount in `backend/src/index.ts` at `/api/agents`
- [ ] Ensure `tools` is always serialised as JSON string on write and parsed as array on read
- [ ] Validate `slug` against `^[a-z0-9-]+$` regex in POST handler
- [ ] Verify `npx tsc --noEmit` passes in `backend/`

## Dependencies

- Depends on: `db-setup-and-schema.md`
- Depends on: `seed-existing-agents.md` (so endpoints return data immediately after migration)

## Out of Scope

- Pagination or filtering of the agents list
- Bulk create/update/delete operations
- Authentication middleware on these endpoints

## Notes

- Use `better-sqlite3` prepared statements for all queries to prevent SQL injection
- The `updatedAt` field should be set to `new Date().toISOString()` on every PUT
- Do not reuse or rename the existing `agentRouter` — keep `/api/agent/run` untouched in this story
