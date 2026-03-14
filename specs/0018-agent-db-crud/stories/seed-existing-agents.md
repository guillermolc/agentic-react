# User Story: Seed existing agents from YAML files

## Summary

**As a** developer,
**I want** the existing six YAML agent files to be automatically imported into the database on first startup,
**So that** the migration is seamless and no agents are lost when switching from file-based to DB-based configuration.

## Description

On backend startup, after the database schema is ready, check whether the `agents` table is empty. If it is, parse each YAML file in `backend/agents/` and insert the corresponding row. This guarantees idempotency — subsequent restarts do not re-seed. The seeding logic should also map the UI metadata that currently lives in `frontend/lib/agents.ts` (colors, `nextAgent`, `quickPrompt`) into the same row.

## Acceptance Criteria

- [ ] Given the `agents` table is empty on startup, when the backend initialises, then all six existing agents are inserted.
- [ ] Given the `agents` table already has rows on startup, when the backend initialises, then no duplicate inserts occur.
- [ ] Given a YAML file is missing a field, when seeding runs, then the missing field is stored as NULL without crashing.
- [ ] Given seeding completes, when `GET /api/agents` is called, then it returns exactly the six seeded agents.
- [ ] Given the seed runs, when `npx tsc --noEmit` runs in `backend/`, then there are no TypeScript errors.

## Tasks

- [ ] Create `backend/src/lib/seed.ts` with a `seedAgents()` function
- [ ] In `seedAgents()`, query `SELECT COUNT(*) FROM agents` — return early if count > 0
- [ ] Read all `.agent.yaml` files from `backend/agents/` using `fs.readdirSync`
- [ ] For each file, parse with the `yaml` package and map to the `Agent` interface
- [ ] Define inline the static UI metadata map (slug → color, bgColor, borderColor, iconColor, nextAgent, quickPrompt) sourced from `frontend/lib/agents.ts`
- [ ] Merge YAML data with UI metadata map for each agent
- [ ] Insert each agent with `INSERT OR IGNORE INTO agents` (idempotent)
- [ ] Set `createdAt` and `updatedAt` to the current ISO timestamp during seed
- [ ] Call `seedAgents()` in `backend/src/index.ts` after DB initialisation, before the Express app starts listening

## Dependencies

- Depends on: `db-setup-and-schema.md` (database and `agents` table must exist first)

## Out of Scope

- Ongoing sync between YAML files and the database (YAML files are read once, then the DB is authoritative)
- Seeding agents from any source other than the existing YAML files

## Notes

- The `tools` field in YAML is an array; serialise it as a JSON string (`JSON.stringify`) for storage and deserialise on read
- After successful migration the YAML files can be archived, but this story does not delete them
- `INSERT OR IGNORE` ensures re-running seed (e.g. in tests) is safe
