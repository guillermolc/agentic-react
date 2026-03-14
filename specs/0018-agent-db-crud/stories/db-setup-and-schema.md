# User Story: Set up SQLite database and schema

## Summary

**As a** developer,
**I want** a SQLite database initialised automatically when the backend starts,
**So that** agent configurations can be persisted without requiring any external database service.

## Description

Install `better-sqlite3` in the backend package and create a `db.ts` module that opens (or creates) `backend/data/agents.db`, runs the schema migration to ensure the `agents` table exists, and exports a typed database handle for use by other modules.

## Acceptance Criteria

- [ ] Given the backend starts for the first time, when `backend/data/agents.db` does not exist, then it is created automatically.
- [ ] Given the backend starts, when the `agents` table does not exist, then it is created with all required columns.
- [ ] Given the backend starts subsequently, when the `agents` table already exists, then the startup does not fail or duplicate the schema.
- [ ] Given `slug` is the primary key, when two agents with the same slug are inserted, then the second insert is rejected.
- [ ] Given `better-sqlite3` is installed, when `npx tsc --noEmit` runs in `backend/`, then there are no TypeScript errors.

## Tasks

- [ ] Add `better-sqlite3` and `@types/better-sqlite3` to `backend/package.json` dependencies
- [ ] Run `npm install` in `backend/` to install the new packages
- [ ] Create `backend/data/` directory (add `.gitkeep`; add `*.db` to `.gitignore`)
- [ ] Create `backend/src/lib/db.ts` that imports `better-sqlite3` and opens `backend/data/agents.db`
- [ ] Define the `agents` table DDL with columns: `slug TEXT PRIMARY KEY`, `name TEXT NOT NULL`, `displayName TEXT NOT NULL`, `description TEXT`, `model TEXT`, `tools TEXT`, `prompt TEXT NOT NULL`, `color TEXT`, `bgColor TEXT`, `borderColor TEXT`, `iconColor TEXT`, `nextAgent TEXT`, `quickPrompt TEXT`, `createdAt TEXT`, `updatedAt TEXT`
- [ ] Run `CREATE TABLE IF NOT EXISTS agents (...)` on db open so the schema is idempotent
- [ ] Export a typed `Agent` interface matching all columns
- [ ] Export the `db` instance as a named export

## Dependencies

> None — this is the foundational story for all other DB stories.

## Out of Scope

- Database migrations / versioning (schema is stable for v1)
- Connection pooling (better-sqlite3 is synchronous, single-connection)
- Any data seeding (handled in `seed-existing-agents.md`)

## Notes

- Use `path.resolve` relative to `import.meta.url` (ESM) to locate `backend/data/agents.db`
- `better-sqlite3` uses synchronous APIs — no `async/await` needed
- Add `backend/data/*.db` to the root `.gitignore` so the database is not committed
