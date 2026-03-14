# User Story: Context Orchestrator (Parallelization)

## Summary

**As a** developer,
**I want** context assembly in `agent.ts` to use a parallel, error-isolated gatherer rather than sequential string concatenation,
**So that** adding new context sources is trivial, a single source failure never aborts an agent run, and all independent sources are fetched concurrently.

## Description

Create `backend/src/lib/context-gatherer.ts` implementing the Parallelization agentic pattern using `Promise.allSettled()`. Refactor `agent.ts` to register all context sources as `ContextSource` objects and call `gatherAllContext()` once, replacing the current sequential block-building code. Each source (KDB, Atlassian, WorkIQ, Spaces, handoff) is independent — failures are logged and skipped.

Reference pattern: https://www.philschmid.de/agentic-pattern (Parallelization workflow pattern).

This story refactors the sequential context assembly from the [Wire Atlassian Context into Agent](atlassian-context-injection.md) story and all existing context blocks into the new pattern.

## Acceptance Criteria

- [ ] Given `gatherAllContext(sources)` is called with 4 sources, when one source throws an error, then the remaining 3 sources still resolve and their content is used — no request-level crash.
- [ ] Given `gatherAllContext(sources)` is called with 4 sources that are independent, when executed, then all 4 run concurrently (started before any awaited) via `Promise.allSettled()`.
- [ ] Given a failed source, when the error is caught, then it is logged with the source `name` and the error message via `console.warn`.
- [ ] Given all sources resolve, when `gatherAllContext()` returns, then the result is an array of `{ name, content }` objects ordered the same as the input `sources` array.
- [ ] Given `agent.ts` registers context sources, when a request has `kdbRefs`, then a KDB source is registered; when it has `workiqContext`, then a WorkIQ source is registered; always-present sources (handoff, atlassian) are registered conditionally based on data availability.
- [ ] Given `agent.ts` has been refactored, when the codebase is compiled, then `npx tsc --noEmit` passes with zero errors in `backend/`.
- [ ] Given the KDB source fails (e.g., external KDBVG server is down), when the agent processes the request, then the agent still runs with the remaining context (Atlassian, WorkIQ, Spaces, handoff).

## Tasks

- [ ] Create `backend/src/lib/context-gatherer.ts` with:
  - `interface ContextSource { name: string; gather: () => Promise<string> }`
  - `async function gatherAllContext(sources: ContextSource[]): Promise<{ name: string; content: string }[]>` — uses `Promise.allSettled`, logs failures with `console.warn`, returns only fulfilled results with non-empty content
- [ ] Export `ContextSource` interface and `gatherAllContext` function
- [ ] Read `backend/src/routes/agent.ts` fully to map every existing context block (kdbRefs loop, workiqBlock, spaceRefs instruction, handoff context, atlassian block)
- [ ] Refactor `agent.ts`: replace sequential block-building with conditional `ContextSource` registration followed by a single `await gatherAllContext(sources)` call
- [ ] Register sources in this order: `handoff`, `spaces`, `workiq`, `kdb`, `atlassian` (determines block ordering in system prompt)
- [ ] Each source's `gather` function returns the formatted block string (same content as before) or empty string if not applicable
- [ ] For KDB sources: existing `Promise.allSettled` KDB queries become the `gather` function of the KDB source (KDB queries themselves are already parallel within the source)
- [ ] For Atlassian source: call `readAllDocuments()` — wrap in try/catch returning `""` on error
- [ ] After `gatherAllContext()`, concatenate all non-empty content blocks and append to the base system prompt
- [ ] Log total context block count and source names at debug level before running the agent
- [ ] Run `npx tsc --noEmit` in `backend/` — zero errors

## Dependencies

- Depends on: [Wire Atlassian Context into Agent](atlassian-context-injection.md) — atlassian context block pattern must exist in agent.ts before refactoring
- Depends on: all previous context sources being implemented (KDB, WorkIQ, Spaces)
- Reference: `backend/src/routes/agent.ts` current state — fully read before refactoring

## Out of Scope

- Changing the actual content or format of any context block (this is a structural refactor only)
- Adding new context sources beyond what's already implemented
- Frontend changes

## Notes

- `Promise.allSettled` (not `Promise.all`) is critical — it ensures all sources run even if one rejects
- Source order in the array determines block ordering in the final system prompt — keep it consistent
- A source that returns an empty string should be filtered out from the final concatenation
- Within the KDB source `gather` function, the existing `Promise.allSettled` for multiple KDB queries is preserved — this creates a two-level parallelism (top-level: sources, inner-level: KDB queries)
- After this refactor, adding a new context source (e.g., "Slack messages") requires only: (1) implementing the `gather` async function, (2) registering a `ContextSource` in the conditional block — no structural changes needed
- Keep the refactor minimal: do NOT change request parsing, SSE setup, error handling, or the CopilotClient/VertexClient logic — only the context assembly section changes
