# User Story: Extend SQLite Schema with Sessions, Messages, and Activity Tables

## Summary

**As a** developer,
**I want** the SQLite database to have `sessions`, `messages`, and `activity` tables with foreign key enforcement,
**So that** the backend has a durable, relational store for all session data with automatic message cleanup on session deletion.

## Description

The existing `backend/src/lib/db.ts` opens `backend/data/agents.db`, enables WAL mode, and creates the `agents` and `external_kdbs` tables via `db.exec()`. This story adds three more tables following the exact same pattern, plus enables the `foreign_keys` pragma so that deleting a session automatically cascades to its messages. No new npm packages are needed — `better-sqlite3` is already installed.

## Acceptance Criteria

- [ ] Given the backend starts for the first time, when `db.ts` is imported, then `sessions`, `messages`, and `activity` tables exist in the DB with the correct columns and constraints.
- [ ] Given the tables already exist, when the backend restarts and `db.ts` is re-imported, then `CREATE TABLE IF NOT EXISTS` guards prevent duplicate-table errors.
- [ ] Given `db.pragma("foreign_keys = ON")` is present in `db.ts`, when a row is deleted from `sessions`, then all related rows in `messages` are automatically deleted.
- [ ] Given a `CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId)` is present, when `GET /api/sessions/:id` runs a `SELECT WHERE sessionId = ?` query, then the index is used.
- [ ] Given `npx tsc --noEmit` is run in `backend/`, then it exits with code 0 with no new errors.

## Tasks

- [ ] Add `db.pragma("foreign_keys = ON")` to `backend/src/lib/db.ts` immediately after `db.pragma("journal_mode = WAL")`.
- [ ] Add `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, agentSlug TEXT NOT NULL, agentName TEXT NOT NULL, title TEXT NOT NULL, repoFullName TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)` via `db.exec()`.
- [ ] Add `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, reasoning TEXT, createdAt INTEGER NOT NULL)` via `db.exec()`.
- [ ] Add `CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, type TEXT NOT NULL, agentSlug TEXT, repoFullName TEXT, description TEXT NOT NULL, createdAt INTEGER NOT NULL)` via `db.exec()`.
- [ ] Add `CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId)` via `db.exec()`.
- [ ] Run `npx tsc --noEmit` in `backend/` and fix any type errors introduced.

## Dependencies

> The existing `backend/src/lib/db.ts` with WAL mode and DB path setup must already be present (it is).

- Depends on: existing `db.ts` scaffold (already in codebase at `backend/src/lib/db.ts`).

## Out of Scope

- Migrating existing `localStorage` session data into the new tables.
- DB migration tooling (Flyway, Knex, etc.).
- Seeding sessions from any external source.

## Notes

- The `foreign_keys` pragma must be set per-connection at startup — it is not a persistent DB setting — so it must live in the `db.ts` module-level startup code path.
- Keep all `db.exec()` calls synchronous, consistent with how the `agents` and `external_kdbs` tables are created today.
- Add the new tables and index blocks directly after the `external_kdbs` `db.exec()` block to maintain a clean, sequential schema definition.
