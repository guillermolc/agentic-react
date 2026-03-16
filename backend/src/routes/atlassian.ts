import { Router, Request, Response } from "express";
import {
  isAtlassianConfigured,
  getJiraUrl,
  getJiraHeaders,
  getConfluenceUrl,
  getConfluenceHeaders,
} from "../lib/atlassian/atlassian-client.js";

export const atlassianRouter = Router();

/** Escape special characters for JQL string literals */
function escapeJql(value: string): string {
  // Escape JQL reserved chars: \ " ' + - & | ! ( ) { } [ ] ^ ~ * ? :
  return value.replace(/([\\"'+\-&|!(){}\[\]^~*?:])/g, "\\$1");
}

// GET /api/atlassian/status
atlassianRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    jira: isAtlassianConfigured("jira"),
    confluence: isAtlassianConfigured("confluence"),
  });
});

// POST /api/atlassian/search
atlassianRouter.post("/search", async (req: Request, res: Response) => {
  const { query, type } = req.body as { query?: string; type?: "jira" | "confluence" };

  if (!query || !query.trim()) {
    res.status(400).json({ error: "query is required" });
    return;
  }
  if (!type || !["jira", "confluence"].includes(type)) {
    res.status(400).json({ error: 'type must be "jira" or "confluence"' });
    return;
  }

  if (type === "jira") {
    if (!isAtlassianConfigured("jira")) {
      res.status(503).json({ error: "Jira is not configured" });
      return;
    }

    try {
      const safe = escapeJql(query);
      const jql = `text ~ "${safe}" OR summary ~ "${safe}"`;
      const url = `${getJiraUrl()}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=20`;
      const response = await fetch(url, {
        headers: getJiraHeaders(),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        res.status(502).json({ error: `Jira API returned ${response.status}` });
        return;
      }
      const data = (await response.json()) as {
        issues: {
          id: string;
          key: string;
          fields: { summary: string; description?: string | null };
        }[];
      };
      const results = (data.issues || []).map((issue) => ({
        id: issue.id,
        key: issue.key,
        title: issue.fields.summary,
        summary: issue.fields.description
          ? issue.fields.description.replace(/<[^>]*>/g, "").substring(0, 200)
          : "",
        url: `${getJiraUrl()}/browse/${issue.key}`,
        type: "jira" as const,
      }));
      res.json(results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Jira search failed";
      res.status(502).json({ error: message });
    }
    return;
  }

  if (type === "confluence") {
    if (!isAtlassianConfigured("confluence")) {
      res.status(503).json({ error: "Confluence is not configured" });
      return;
    }

    try {
      const baseUrl = getConfluenceUrl();
      const headers = getConfluenceHeaders();

      // CQL search — avoid expand=body.view to prevent 502 on Confluence DC 9.x
      const safeQuery = query.replace(/"/g, '\\"');
      const cql = `type=page AND (title~"${safeQuery}" OR text~"${safeQuery}")`;
      let results: { id: string; title: string; summary: string; url: string; type: "confluence" }[] = [];

      const cqlUrl = `${baseUrl}/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=20&expand=metadata.labels`;
      const cqlRes = await fetch(cqlUrl, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });

      if (cqlRes.ok) {
        const data = (await cqlRes.json()) as {
          results: {
            id: string;
            title: string;
            excerpt?: string;
            _links?: { webui?: string };
          }[];
        };
        results = (data.results || []).map((page) => ({
          id: page.id,
          title: page.title,
          summary: page.excerpt
            ? page.excerpt.replace(/<[^>]*>/g, "").substring(0, 200)
            : "",
          url: page._links?.webui ? `${baseUrl}${page._links.webui}` : baseUrl,
          type: "confluence" as const,
        }));
      }

      // Fallback to title-based search if CQL failed or returned empty
      if (!cqlRes.ok || results.length === 0) {
        const fallbackUrl = `${baseUrl}/rest/api/content?title=${encodeURIComponent(query)}&limit=20`;
        const fallbackRes = await fetch(fallbackUrl, {
          headers,
          signal: AbortSignal.timeout(30_000),
        });
        if (fallbackRes.ok) {
          const data = (await fallbackRes.json()) as {
            results: {
              id: string;
              title: string;
              excerpt?: string;
              _links?: { webui?: string };
            }[];
          };
          results = (data.results || []).map((page) => ({
            id: page.id,
            title: page.title,
            summary: page.excerpt
              ? page.excerpt.replace(/<[^>]*>/g, "").substring(0, 200)
              : "",
            url: page._links?.webui ? `${baseUrl}${page._links.webui}` : baseUrl,
            type: "confluence" as const,
          }));
        } else if (!cqlRes.ok) {
          // Both CQL and fallback failed
          res.status(502).json({ error: `Confluence API returned ${fallbackRes.status}` });
          return;
        }
      }

      res.json(results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Confluence search failed";
      res.status(502).json({ error: message });
    }
  }
});
