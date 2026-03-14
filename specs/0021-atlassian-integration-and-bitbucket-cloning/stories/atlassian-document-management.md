# User Story: Atlassian Document Management API

## Summary

**As a** Business Analyst,
**I want** to see a list of all downloaded Jira and Confluence documents and be able to delete individual ones,
**So that** I can keep the context folder relevant and not accumulate stale documents from previous sessions.

## Description

Add `GET /api/atlassian/documents` and `DELETE /api/atlassian/documents/:filename` endpoints to the atlassian download router. These use the `document-store.ts` module (created in the download story) for all file operations. The frontend `AtlassianSelector` uses the list endpoint to show a badge count and the delete endpoint for cleanup.

## Acceptance Criteria

- [ ] Given `GET /api/atlassian/documents` is called, when the context folder has 3 files, then it returns `[{ filename, type, size, downloadedAt }]` for all 3 files.
- [ ] Given `GET /api/atlassian/documents` is called, when the context folder is empty or does not exist, then it returns an empty array `[]` — no 404 or 500.
- [ ] Given `DELETE /api/atlassian/documents/jira_PROJ-123.txt`, when the file exists, then it is deleted from disk and the response is `{ deleted: true, filename: "jira_PROJ-123.txt" }`.
- [ ] Given `DELETE /api/atlassian/documents/nonexistent.txt`, when the file does not exist, then the endpoint returns HTTP 404.
- [ ] Given a `filename` in the delete path contains `../` or path traversal characters, when processed, then the server rejects it with HTTP 400 (path traversal protection).
- [ ] Given `listDocuments()` returns metadata, when `type` is inferred from filename, then files starting with `jira_` get `type: "jira"` and files starting with `confluence_` get `type: "confluence"`.

## Tasks

- [ ] Add `GET /documents` route to `backend/src/routes/atlassian-download.ts` — call `listDocuments()` from document-store, return array
- [ ] Add `DELETE /documents/:filename` route — validate filename (no path separators, only alphanumeric + `-_. `), call `deleteDocument(filename)`, handle not-found
- [ ] Implement path traversal guard: reject if `filename` contains `/`, `\`, or `..`
- [ ] Implement `type` inference in `listDocuments()` in document-store: `filename.startsWith("jira_") ? "jira" : "confluence"`
- [ ] Return `downloadedAt` from file `fs.statSync(path).mtime` formatted as ISO string
- [ ] Run `npx tsc --noEmit` in `backend/` — zero errors

## Dependencies

- Depends on: [Atlassian Download, Parser & Document Store](atlassian-download-and-parser.md) — `document-store.ts` and router file must exist

## Out of Scope

- Batch delete endpoint
- Editing or re-downloading documents via this endpoint
- Frontend rendering of the document list (handled in AtlassianSelector story)

## Notes

- Path traversal protection is critical — `filename` comes from a URL param, guard before constructing the file path
- `fs.statSync(path).mtime.toISOString()` is fine for `downloadedAt`
- File size in bytes: `fs.statSync(path).size`
- This story only requires adding ~30 lines to the existing router from the download story — keep it minimal
