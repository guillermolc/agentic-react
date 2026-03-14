# User Story: External KDB DB Model

## Summary

**As a** backend developer,
**I want** a `external_kdbs` SQLite table managed by the existing `db.ts` module,
**So that** external KDB configurations can be persisted and shared across all backend routes.

## Description

The app uses `better-sqlite3` via `backend/src/lib/db.ts` which also manages the `agents` table. This story adds a new `external_kdbs` table to the same database and exports the corresponding TypeScript interface. No ORM — raw SQL like the existing `agents` table. The table must be created via `db.exec()` in the `db.ts` initialization block using `CREATE TABLE IF NOT EXISTS`.

## Acceptance Criteria

- [ ] Given the backend starts, when `db.ts` is loaded, then the `external_kdbs` table is created if it does not exist (idempotent).
- [ ] Given the schema, when examined, then columns are: `id TEXT PRIMARY KEY`, `name TEXT NOT NULL`, `baseUrl TEXT NOT NULL`, `repoId TEXT NOT NULL`, `apiKey TEXT`, `description TEXT`, `createdAt TEXT NOT NULL`.
- [ ] Given the `ExternalKdb` TypeScript interface is exported from `db.ts`, when imported by route files, then it matches the table schema with correct nullable types.

## Tasks

- [ ] Open `backend/src/lib/db.ts` and add `CREATE TABLE IF NOT EXISTS external_kdbs (...)` SQL to the initialization block after the `agents` table creation
- [ ] Define and export a `ExternalKdb` TypeScript interface with fields: `id: string`, `name: string`, `baseUrl: string`, `repoId: string`, `apiKey: string | null`, `description: string | null`, `createdAt: string`
- [ ] Verify with `npx tsc --noEmit` in the `backend/` directory that there are no type errors

## Dependencies

- No other stories in this spec are blockers; this is the first backend story.

## Out of Scope

- Migration tooling or versioning — `IF NOT EXISTS` is sufficient for this app
- Seed data — table starts empty

## Notes

- Follow the exact same pattern as the `agents` table in `db.ts`.
- `apiKey` is nullable because the external KDB API does not require authentication by default.
- `repoId` is the Coderag internal identifier for the indexed repo (e.g. `"mall"`) — not a GitHub URL.
