# User Story: Atlassian Download, Parser & Document Store

## Summary

**As a** Product Manager,
**I want** to download selected Jira issues and Confluence pages as plain-text files to the server,
**So that** their content is available as persistent context for any agent session without re-fetching on every run.

## Description

Create the download pipeline: `POST /api/atlassian/download` fetches the full content for each selected item, converts it to plain text (Jira) or Markdown (Confluence), and saves it to `{WORK_DIR}/context/atlassian/`. The Confluence HTML → Markdown conversion uses **Cheerio + Turndown**, ported from the custom project's `ConfluenceParser.ts`. The `document-store.ts` module handles all file I/O and caps total context at 8000 chars for agent injection.

Reference: `agentic-web-spec-custom/backend/src/lib/atlassian/IngestionService.ts`, `ConfluenceParser.ts`, and `atlassian-ingestion.ts` — port the fetch + save logic, replacing Cloud detection and credential-from-body patterns with env var helpers.

## Acceptance Criteria

- [ ] Given `POST /api/atlassian/download` with `{ items: [{ type: "jira", key: "PROJ-123" }] }`, when Jira is configured, then the backend fetches the full issue (summary, description, comments, status, issuetype) and saves it to `{WORK_DIR}/context/atlassian/jira_PROJ-123.txt`.
- [ ] Given `POST /api/atlassian/download` with `{ items: [{ type: "confluence", id: "12345", title: "Auth Design" }] }`, when Confluence is configured, then the backend fetches the page using `body.view` (first), falls back to `body.storage` if `body.view` is empty, converts HTML to Markdown, and saves to `{WORK_DIR}/context/atlassian/confluence_12345_auth-design.txt`.
- [ ] Given both types in one request, when all items are processed, then the endpoint returns `{ downloaded: [{ id, key?, filename, path, type }] }` for all items including those already on disk.
- [ ] Given a file already exists on disk for that key/id, when the download is requested again, then it overwrites the file (re-fetch and re-save).
- [ ] Given `{WORK_DIR}/context/atlassian/` does not exist, when the first download runs, then the directory is created with `mkdirSync({ recursive: true })`.
- [ ] Given `readAllDocuments()` is called, then it reads all `.txt` files, concatenates them with `\n\n--- {filename} ---\n\n` separators, and caps the total at 8000 chars with an appended truncation notice.
- [ ] Given `listDocuments()` is called, then it returns `[{ filename, type, size, downloadedAt }]` for all files in the atlassian context folder.
- [ ] Given Jira fetches an issue with 5 comments, when formatted as text, then comments are appended after the description in a readable format.
- [ ] Given Confluence returns `body.export_view` does not exist (404 or missing field), when the parser runs, then it uses `body.view` or `body.storage` without error.

## Tasks

- [ ] Add `cheerio` and `turndown` + `@types/turndown` to `backend/package.json` dependencies
- [ ] Create `backend/src/lib/atlassian/confluence-parser.ts` — port from `ConfluenceParser.ts`: Cheerio-based HTML preprocessing (clean macros, strip scripts), then Turndown HTML→Markdown; body priority: `body.view` → `body.storage`
- [ ] Create `backend/src/lib/atlassian/document-store.ts` with `saveDocument(filename, content)`, `readAllDocuments(): string` (8000 chars cap), `listDocuments()`, `deleteDocument(filename)`, `getDocumentPath(filename)`; use `{WORK_DIR}/context/atlassian/` as base
- [ ] Create `backend/src/routes/atlassian-download.ts` with Express Router
- [ ] Implement `POST /download` route — loop over items, dispatch to Jira or Confluence fetcher, save via document-store, return manifest
- [ ] Implement Jira issue fetcher: `GET {JIRA_URL}/rest/api/2/issue/{key}?fields=summary,description,comment,issuetype,status,created,updated` with `getJiraHeaders()`, format as plain text
- [ ] Implement Confluence page fetcher: `GET {CONFLUENCE_URL}/rest/api/content/{id}?expand=body.view,body.storage,version` with `getConfluenceHeaders()`, pass response body to `confluenceParser`
- [ ] Generate Confluence filename: `confluence_{id}_{slugify(title)}.txt` — slugify: lowercase, replace spaces+special chars with `-`, trim
- [ ] Create `{WORK_DIR}/context/atlassian/` on first use with `mkdirSync({ recursive: true })`
- [ ] Mount `atlassianDownloadRouter` in `backend/src/index.ts` under `/api/atlassian`
- [ ] Run `npm install` in `backend/` to install cheerio + turndown
- [ ] Run `npx tsc --noEmit` in `backend/` — zero errors

## Dependencies

- Depends on: [Atlassian Backend Client & Status](atlassian-backend-client.md) — auth helpers
- Depends on: [Atlassian Search API](atlassian-search-api.md) — route file already created (can add download router in separate file or same)
- Reference: `agentic-web-spec-custom/backend/src/lib/atlassian/ConfluenceParser.ts` (full port)
- Reference: `agentic-web-spec-custom/backend/src/lib/atlassian/IngestionService.ts` (fetch + format logic)

## Out of Scope

- Listing or deleting documents (handled in document management story)
- Auto-refresh or background ingestion
- PDF or binary attachments

## Notes

- Jira text format: `Title: {summary}\nType: {issuetype}\nStatus: {status}\nCreated: {created}\n\nDescription:\n{description}\n\nComments:\n{comment.comments[].{ author.displayName, body }}`
- Confluence body priority: `body.view.value` → `body.storage.value` — NOT `body.export_view` (not available in Confluence 6.x)
- Turndown instance should have GFM tables and code block rules enabled
- cheerio is used for pre-processing macros (Confluence `ac:*` tags → readable text) before passing to Turndown
- 8000 char cap in `readAllDocuments()` should append `\n\n[... context truncated at 8000 chars]` when truncated
- `WORK_DIR` is read from `process.env.WORK_DIR` (same as in existing code), defaulting to `~/work`; use `os.homedir()` expansion
