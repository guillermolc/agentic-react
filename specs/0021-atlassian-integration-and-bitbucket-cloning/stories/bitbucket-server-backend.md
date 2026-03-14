# User Story: Bitbucket Server Backend Foundation

## Summary

**As an** Engineering Lead,
**I want** the backend to clone and search Bitbucket Server repositories using a Bearer PAT stored in the server environment,
**So that** I can use my internal Bitbucket Server repos as the code context for agent sessions without exposing credentials to the browser.

## Description

Extend `backend/src/routes/repos.ts` to support Bitbucket Server as a second repo provider alongside GitHub. All Bitbucket credentials (`BITBUCKET_SERVER_URL`, `BITBUCKET_PAT`) live in `backend/.env` — the frontend never sees them. The clone uses `git -c http.extraHeader` to inject the Bearer token and `http.sslVerify=false` to handle self-signed certs. The Bitbucket REST API 1.0 is used for repo search.

Reference: `agentic-web-spec-custom/backend/src/routes/repos.ts` — port the Bitbucket Server clone and search logic, stripping any GitHub-specific provider detection that isn't needed.

## Acceptance Criteria

- [ ] Given `provider: "bitbucket-server"` in the clone request body, when the backend receives it, then it constructs the clone URL as `{BITBUCKET_SERVER_URL}/scm/{projectKey}/{repoSlug}.git` from the `repoFullName` field (`"{projectKey}/{repoSlug}"`).
- [ ] Given `provider: "bitbucket-server"`, when the git clone runs, then it uses `git -c http.extraHeader="Authorization: Bearer {BITBUCKET_PAT}" -c http.sslVerify=false clone --depth 1`.
- [ ] Given `provider: "github"` (or no provider field), when the backend receives a clone request, then it behaves exactly as before (no regression).
- [ ] Given a search request with `provider: "bitbucket-server"` and a query string, when the backend calls Bitbucket Server REST API 1.0, then it returns a normalized list of repos with `id`, `fullName` (`{projectKey}/{repoSlug}`), `description`, and `cloneUrl`.
- [ ] Given `BITBUCKET_SERVER_URL` or `BITBUCKET_PAT` are not set, when a Bitbucket Server clone/search is requested, then the backend returns HTTP 503 with a clear error message.
- [ ] Given a `getRepoPAT(provider)` utility is called with `"github"`, then it returns `process.env.GITHUB_PAT`; called with `"bitbucket-server"`, it returns `process.env.BITBUCKET_PAT`.

## Tasks

- [ ] Add `BITBUCKET_SERVER_URL`, `BITBUCKET_PAT` to `backend/.env` (document in `.env` comments)
- [ ] Create or update `backend/src/lib/providers.ts` — add `getRepoPAT(provider: "github" | "bitbucket-server"): string | undefined`
- [ ] Extend `POST /api/repos/clone` in `repos.ts` — destructure `provider` from body (default `"github"`)
- [ ] Implement Bitbucket Server clone branch: construct clone URL, run git with `http.extraHeader` + `http.sslVerify=false`
- [ ] Add `POST /api/repos/search` endpoint (or extend existing) — route to Bitbucket Server search when `provider: "bitbucket-server"`
- [ ] Implement Bitbucket Server search: call `{BITBUCKET_SERVER_URL}/rest/api/1.0/repos?name={query}&limit=20` with Bearer auth, map `values[].{ slug, project.key, description }` to normalized shape
- [ ] Add guard: if Bitbucket env vars missing, return HTTP 503
- [ ] Handle self-signed SSL for Bitbucket Server HTTP fetch (use `https.Agent({ rejectUnauthorized: false })` or env var)
- [ ] Run `npx tsc --noEmit` in `backend/` — zero errors

## Dependencies

- Depends on: existing `backend/src/routes/repos.ts` and `backend/src/lib/providers.ts`
- Reference: `agentic-web-spec-custom/backend/src/routes/repos.ts`

## Out of Scope

- Frontend changes (handled in the Bitbucket Server Frontend story)
- GitHub-specific clone logic changes
- OAuth flow or SSO for Bitbucket Server

## Notes

- Clone URL pattern: `{BITBUCKET_SERVER_URL}/scm/{projectKey}/{repoSlug}.git`
- Bitbucket Server REST API 1.0 search response shape: `{ values: [{ id, project: { key }, slug, description, links }] }`
- The `repoPath` on disk follows the existing pattern: `{WORK_DIR}/{projectKey}/{repoSlug}`
- All local imports must use `.js` extension (ESM requirement)
