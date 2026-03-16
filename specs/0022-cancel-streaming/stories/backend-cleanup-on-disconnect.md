# User Story: Verify Backend Cleanup on Disconnect

## Summary

**As a** backend developer,
**I want** to verify that both the Copilot and Vertex runners cleanly stop their LLM sessions when the HTTP client disconnects,
**So that** a cancelled stream does not leave orphaned SDK child processes or open Vertex AI connections consuming resources.

## Description

> The `copilot-runner.ts` already handles `req.on("close")` by calling `finish("req.close")`, which in turn calls `client.stop()`. However, this story requires explicitly verifying that:
>
> 1. The `req.on("close")` path is actually exercised when the browser aborts the fetch (end-to-end, including the route handler signal propagation from the previous story).
> 2. `vertex-runner.ts` has an equivalent cleanup path — if not, it must be added.
> 3. The `finish()` guard (`if (done) return`) prevents double-cleanup when the stream completes AND a close event fires near-simultaneously.
>
> This story is primarily a verification + documentation task, with a small code addition if `vertex-runner.ts` is found to be missing the `req.on("close")` handler.

## Acceptance Criteria

- [ ] Given a streaming Copilot run, when the browser aborts, then the backend logs `[agent:*] finish() called, reason: req.close` within ~1 second.
- [ ] Given a streaming Vertex run, when the browser aborts, then the Vertex stream and any associated resources are cleaned up (verified by log output or process inspection).
- [ ] Given `finish()` is called twice (e.g., `req.close` fires after `session.idle`), when the second call runs, then the `if (done) return` guard prevents a second `res.end()` call and `client.stop()` call.
- [ ] Given normal stream completion, when `session.idle` fires `finish("session.idle")`, then no regression — the `done` event and `res.end()` still happen exactly once.
- [ ] Given the backend code is reviewed, when `vertex-runner.ts` is inspected, then it either already has a `req.on("close")` handler or one is added matching the pattern in `copilot-runner.ts`.

## Tasks

- [ ] Read `backend/src/lib/vertex-runner.ts` and locate its `req.on("close")` handling (or confirm its absence)
- [ ] If absent, add a `req.on("close", () => { void finish("req.close"); })` listener to `vertex-runner.ts` using the same pattern as `copilot-runner.ts`
- [ ] Confirm the `finish()` function in `copilot-runner.ts` has the `if (done) return` guard (already present — document it as verified)
- [ ] Add a `console.log` in the `finish()` close-path if not already present, so cancellations are observable in the backend terminal
- [ ] Perform manual end-to-end test with Copilot provider: start stream → click Stop → confirm log line appears
- [ ] Perform manual end-to-end test with Vertex provider (if configured): start stream → click Stop → confirm cleanup
- [ ] Run `npx tsc --noEmit` in `backend/` and confirm zero errors after any code changes

## Dependencies

- Depends on: [route-handler-signal-propagation.md](route-handler-signal-propagation.md) — the backend connection must actually close when the browser aborts for `req.on("close")` to fire

## Out of Scope

- Adding metrics or alerting for leaked processes
- Changes to the Copilot SDK itself
- Cancellation of the repo-clone step

## Notes

- `req.on("close")` fires when the underlying TCP socket closes. In Node.js HTTP/1.1, this happens when the client disconnects — which is what `signal: request.signal` propagation in the route handler achieves.
- `client.stop()` in the Copilot runner terminates the `@github/copilot-sdk` child process. If it has already exited (normal completion), `stop()` is a no-op — so calling it redundantly is safe.
- If Vertex runner uses an HTTP streaming fetch, aborting the backend `fetch` to Vertex (by passing a local `AbortController` tied to the `req.on("close")` event) is the cleanest approach.
