# User Story: Propagate Abort Signal Through Route Handler

## Summary

**As a** developer maintaining the Next.js proxy layer,
**I want** the route handler at `app/api/agent/run/route.ts` to forward the browser's `AbortSignal` to the downstream backend `fetch`,
**So that** aborting the browser fetch also closes the HTTP connection to the Express backend, triggering its `req.on("close")` cleanup.

## Description

> The current route handler in `app/api/agent/run/route.ts` opens a backend `fetch` with no `signal`. When the browser aborts the upstream request, the route handler's `Response` stream ends, but the backend fetch connection remains open until the LLM finishes — wasting backend resources and keeping the Copilot SDK session alive.
>
> The `Request` object received by the Next.js `POST` handler already exposes `request.signal`. Forwarding it to the backend `fetch` as `signal: request.signal` ensures the TCP connection to the Express server is closed immediately on browser abort, which fires `req.on("close")` on the backend and triggers `finish()` → `client.stop()`.

## Acceptance Criteria

- [ ] Given the browser aborts the fetch to `/api/agent/run`, when the route handler's backend fetch receives the signal, then the backend HTTP connection is closed within ~1 second.
- [ ] Given the backend connection closes, when `req.on("close")` fires, then `finish("req.close")` is logged in the backend console.
- [ ] Given a normal (non-aborted) request completes, when the route handler proxies the stream, then behaviour is unchanged — no regression.
- [ ] Given the backend is unreachable, when the route handler catches the fetch error, then the existing 502 error response is returned unchanged.
- [ ] Given TypeScript strict mode, when `request.signal` is forwarded to `fetch`, then no type errors occur (both are `AbortSignal`).

## Tasks

- [ ] Open `frontend/app/api/agent/run/route.ts`
- [ ] In the `backendRes = await fetch(...)` call, add `signal: request.signal` to the options object
- [ ] Verify the updated fetch options object: `{ method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal, body }`
- [ ] Confirm the error-catching `try/catch` around the backend fetch remains intact (it already exists — no structural change needed)
- [ ] Run `npx tsc --noEmit` in `frontend/` and confirm zero errors
- [ ] Manually test: start a stream, click Stop, observe `[agent:*] finish() called, reason: req.close` in the backend terminal

## Dependencies

- Depends on: [abort-controller-wiring.md](abort-controller-wiring.md) — the browser fetch must carry an `AbortSignal` for the route handler to forward

## Out of Scope

- Any changes to the backend Express routes
- Changes to the route handler's SSE response headers

## Notes

- `request.signal` in Next.js App Router `POST` handlers is the standard Web API `AbortSignal` tied to the incoming HTTP connection lifetime. Forwarding it directly to Node.js `fetch` (the global `fetch` available in Next.js 14) works without any polyfill.
- If both the browser abort AND a normal stream completion happen near-simultaneously, Node.js `fetch` handles the race gracefully — whichever resolves first wins and the other is a no-op.
- This is a one-line change to `route.ts` but is critical to ensure the backend actually stops work, not just the frontend rendering.
