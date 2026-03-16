import { Router, Request, Response } from "express";
import {
  isAtlassianConfigured,
  getJiraUrl,
  getJiraHeaders,
  getConfluenceUrl,
  getConfluenceHeaders,
} from "../lib/atlassian/atlassian-client.js";
import { extractBody, parseConfluenceHtml } from "../lib/atlassian/confluence-parser.js";
import { saveDocument, listDocuments, deleteDocument } from "../lib/atlassian/document-store.js";

export const atlassianDownloadRouter = Router();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);
}

interface DownloadItem {
  type: "jira" | "confluence";
  id: string;
  key?: string;
  title?: string;
}

// POST /api/atlassian/download
atlassianDownloadRouter.post("/download", async (req: Request, res: Response) => {
  const { items } = req.body as { items?: DownloadItem[] };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items array is required" });
    return;
  }

  const downloaded: { id: string; key?: string; filename: string; path: string; type: string }[] = [];

  for (const item of items) {
    try {
      if (item.type === "jira") {
        if (!isAtlassianConfigured("jira")) continue;
        const key = item.key || item.id;
        const url = `${getJiraUrl()}/rest/api/2/issue/${encodeURIComponent(key)}?fields=summary,description,comment,issuetype,status,created,updated`;
        const response = await fetch(url, {
          headers: getJiraHeaders(),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          console.warn(`[atlassian] Failed to fetch Jira issue ${key}: ${response.status}`);
          continue;
        }
        const issue = (await response.json()) as {
          key: string;
          fields: {
            summary: string;
            description?: string | null;
            issuetype?: { name: string };
            status?: { name: string };
            created?: string;
            updated?: string;
            comment?: { comments: { author?: { displayName: string }; body: string }[] };
          };
        };

        let content = `Title: ${issue.fields.summary}\n`;
        content += `Key: ${issue.key}\n`;
        if (issue.fields.issuetype) content += `Type: ${issue.fields.issuetype.name}\n`;
        if (issue.fields.status) content += `Status: ${issue.fields.status.name}\n`;
        if (issue.fields.created) content += `Created: ${issue.fields.created}\n`;
        if (issue.fields.updated) content += `Updated: ${issue.fields.updated}\n`;
        content += `\nDescription:\n${issue.fields.description || "(no description)"}\n`;

        if (issue.fields.comment?.comments?.length) {
          content += `\nComments:\n`;
          for (const c of issue.fields.comment.comments) {
            content += `\n— ${c.author?.displayName || "Unknown"}:\n${c.body}\n`;
          }
        }

        const filename = `jira_${issue.key}.txt`;
        const filePath = saveDocument(filename, content);
        downloaded.push({ id: item.id, key: issue.key, filename, path: filePath, type: "jira" });
      } else if (item.type === "confluence") {
        if (!isAtlassianConfigured("confluence")) continue;
        const pageId = item.id;
        const url = `${getConfluenceUrl()}/rest/api/content/${pageId}?expand=body.view,body.storage,version`;
        const response = await fetch(url, {
          headers: getConfluenceHeaders(),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          console.warn(`[atlassian] Failed to fetch Confluence page ${pageId}: ${response.status}`);
          continue;
        }
        const page = (await response.json()) as {
          id: string;
          title: string;
          body?: { view?: { value?: string }; storage?: { value?: string } };
          version?: { number: number };
        };

        const html = extractBody(page);
        const markdown = parseConfluenceHtml(html);
        const titleSlug = slugify(page.title || "untitled");
        const content = `# ${page.title}\n\n${markdown}`;

        const filename = `confluence_${page.id}_${titleSlug}.txt`;
        const filePath = saveDocument(filename, content);
        downloaded.push({ id: item.id, filename, path: filePath, type: "confluence" });
      }
    } catch (err: unknown) {
      console.error(`[atlassian] Download error for item ${item.id}:`, err);
    }
  }

  res.json({ downloaded });
});

// GET /api/atlassian/documents
atlassianDownloadRouter.get("/documents", (_req: Request, res: Response) => {
  try {
    res.json(listDocuments());
  } catch {
    res.json([]);
  }
});

// DELETE /api/atlassian/documents/:filename
atlassianDownloadRouter.delete("/documents/:filename", (req: Request, res: Response) => {
  const filename = String(req.params.filename);

  // Path traversal protection
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const deleted = deleteDocument(filename);
  if (!deleted) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json({ deleted: true, filename });
});
