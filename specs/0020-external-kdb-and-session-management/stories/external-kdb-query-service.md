# User Story: External KDB Query Service

## Summary

**As a** backend service,
**I want** a standalone `queryKDB` function that calls `POST /query` on a KDB-Vector-Grafo-v2 instance,
**So that** any agent runner can retrieve relevant context from an external KDB without duplicating HTTP logic.

## Description

Create `backend/src/lib/kdb-query.ts` with a single exported `async function queryKDB(baseUrl, repoId, apiKey, queryText)`. It calls the Coderag `POST /query` endpoint with the correct request shape, extracts `answer` from the response, and caps total returned content at 4000 characters. The function is provider-agnostic — it is called from `agent.ts` before either `runWithCopilot` or `runWithVertex` is invoked.

### KDB-Vector-Grafo-v2 API details (from API_REFERENCE.md)

- **Endpoint**: `POST {baseUrl}/query`
- **Content-Type**: `application/json`
- **Auth**: `Authorization: Bearer <apiKey>` header — only sent if `apiKey` is non-null
- **Request body**:
  ```json
  { "repo_id": "<repoId>", "query": "<queryText>", "top_k": 10 }
  ```
- **Success response** (`200`):
  ```json
  { "answer": "...", "citations": [...], "diagnostics": {...} }
  ```
- **Only `answer` is used** — citations are not forwarded to the agent.
- **Error responses**: `422` (repo not ready), `503` (storage preflight failed) — both have `{ "detail": ... }` shape.

## Acceptance Criteria

- [ ] Given a valid `baseUrl`, `repoId`, `queryText`, and no `apiKey`, when `queryKDB` is called, then `POST {baseUrl}/query` is called without an `Authorization` header and the `answer` string is returned.
- [ ] Given an `apiKey` is provided, when `queryKDB` is called, then `Authorization: Bearer <apiKey>` is included in the request headers.
- [ ] Given the response `answer` length exceeds 4000 characters, when `queryKDB` returns, then the answer is truncated to 4000 characters with `... (truncated)` appended.
- [ ] Given the KDB server returns a non-200 response, when `queryKDB` is called, then it throws an `Error` with the status code and relevant detail message included.
- [ ] Given the request takes longer than 10 seconds, when `queryKDB` is called, then it throws an `Error` with a timeout message (use `AbortController` with a 10-second signal).
- [ ] Given `npx tsc --noEmit` in `backend/`, when run after this file is created, then zero type errors.

## Tasks

- [ ] Create `backend/src/lib/kdb-query.ts`
- [ ] Export `async function queryKDB(baseUrl: string, repoId: string, apiKey: string | null, queryText: string): Promise<string>`
- [ ] Implement `AbortController` with `setTimeout` for 10-second timeout; pass `signal` to `fetch`
- [ ] Build request headers object: always include `Content-Type: application/json`; conditionally add `Authorization: Bearer <apiKey>` only when `apiKey` is non-null and non-empty
- [ ] Call `fetch(\`\${baseUrl}/query\`, { method: "POST", headers, body: JSON.stringify({ repo_id: repoId, query: queryText, top_k: 10 }), signal })`
- [ ] On non-ok response, parse error body and throw a descriptive `Error`
- [ ] Extract `response.answer` from the parsed JSON (type `{ answer: string }`)
- [ ] Truncate `answer` to 4000 characters if needed, appending `"... (truncated)"`
- [ ] Return the (possibly truncated) `answer` string

## Dependencies

- No dependencies on other stories. This story can be implemented in parallel with the CRUD API story.

## Out of Scope

- `/inventory/query` endpoint support
- Returning `citations` to the agent
- Retry logic on failure

## Notes

- The KDB API does not require any auth by default (examples in the API reference show no auth headers). The `apiKey` field exists for deployments that add auth middleware.
- `fetch` is available natively in Node 18+ which this project already targets.
- The `baseUrl` should be stored without a trailing slash; the function appends `/query` directly.
