# User Story: External KDB Agent Integration

## Summary

**As an** agent,
**I want** external KDB query results injected into my system prompt,
**So that** I can reference content from user-registered knowledge bases regardless of which LLM provider is in use.

## Description

Update `backend/src/routes/agent.ts` `POST /api/agent/run` to accept an optional `kdbRefs: string[]` field. Before invoking either `runWithCopilot` or `runWithVertex`, the handler queries each referenced external KDB using `queryKDB`, assembles the results into a `kdbContextBlock` string, and injects it into the system prompt. This mirrors the existing `workiqBlock` injection pattern.

If any KDB query fails (network error, non-200 response), the failure is logged and that KDB is skipped — the run continues with whatever context was successfully retrieved. Errors are non-blocking.

KDB queries run concurrently using `Promise.allSettled`.

## Acceptance Criteria

- [ ] Given `kdbRefs` is absent or empty, when the agent run is triggered, then no KDB queries are made and the system prompt is unchanged.
- [ ] Given `kdbRefs: ["<id>"]` with a valid registered KDB, when the agent run is triggered, then `queryKDB` is called with the KDB's `baseUrl`, `repoId`, `apiKey`, and the user `prompt`; its result is injected into the system prompt.
- [ ] Given multiple `kdbRefs`, when the agent run is triggered, then all KDB queries run concurrently via `Promise.allSettled`.
- [ ] Given a KDB query throws an error (e.g., network failure or 422), when `Promise.allSettled` resolves, then the error is logged and that KDB is skipped; the run proceeds normally.
- [ ] Given the `kdbContextBlock` is assembled, when injected into the system prompt, then it appears in this order: `agentConfig.prompt + handoffContext + kdbContextBlock + workiqBlock + spaceInstruction + THINK_GUIDANCE`.
- [ ] Given `kdbRefs` references an ID that does not exist in the DB, when the run triggers, then that ID is silently skipped with a log warning.
- [ ] Given `npx tsc --noEmit` in `backend/`, when run, then zero type errors.

## Tasks

- [ ] Update the request body destructuring in `POST /api/agent/run` to include `kdbRefs?: string[]`
- [ ] After parsing `kdbRefs`, look up each ID using `db.prepare("SELECT * FROM external_kdbs WHERE id = ?")` and collect the valid rows
- [ ] Import `queryKDB` from `"../lib/kdb-query.js"` (ESM .js extension)
- [ ] Run all queries concurrently: `const kdbResults = await Promise.allSettled(rows.map(row => queryKDB(row.baseUrl, row.repoId, row.apiKey, prompt)))`
- [ ] Collect fulfilled values, log rejected reasons with `console.error`
- [ ] Build `kdbContextBlock`: if results exist, format as `\n\nExternal KDB Context:\n${results.join("\n\n---\n\n")}`; otherwise empty string
- [ ] Inject `kdbContextBlock` into the system prompt between `handoffContext` and `workiqBlock` (update the string assembly expression)
- [ ] Log KDB query count and total chars assembled at the `console.log` level same as `workiqBlock`
- [ ] Run `npx tsc --noEmit` in `backend/` and fix any type errors

## Dependencies

- Depends on: [external-kdb-db-model.md](external-kdb-db-model.md) — `external_kdbs` table and `ExternalKdb` type
- Depends on: [external-kdb-query-service.md](external-kdb-query-service.md) — `queryKDB` function

## Out of Scope

- Changes to `copilot-runner.ts` or `vertex-runner.ts` — context injection is purely a prompt-level concern in `agent.ts`
- Per-KDB character caps in the system prompt beyond the 4000-char cap already applied by `queryKDB`

## Notes

- The existing pattern in `agent.ts` for `workiqBlock` is the direct reference for how `kdbContextBlock` should be assembled and injected.
- Using `Promise.allSettled` (not `Promise.all`) is critical — a single KDB failure must not abort the entire run.
- The user `prompt` (the chat message text) is used as the KDB query text, which is the most relevant signal for retrieval.
