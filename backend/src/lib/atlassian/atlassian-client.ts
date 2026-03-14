/**
 * Shared auth helpers for Jira and Confluence Server.
 * Reads credentials from environment variables — never from request body.
 */

export function getJiraUrl(): string {
  return (process.env.JIRA_URL?.trim() || "").replace(/\/$/, "");
}

export function getConfluenceUrl(): string {
  return (process.env.CONFLUENCE_URL?.trim() || "").replace(/\/$/, "");
}

export function getJiraHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.JIRA_PAT?.trim() || ""}`,
    Accept: "application/json",
  };
}

export function getConfluenceHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.CONFLUENCE_PAT?.trim() || ""}`,
    Accept: "application/json",
  };
}

export function isAtlassianConfigured(service: "jira" | "confluence"): boolean {
  if (service === "jira") {
    return !!(process.env.JIRA_URL?.trim() && process.env.JIRA_PAT?.trim());
  }
  if (service === "confluence") {
    return !!(process.env.CONFLUENCE_URL?.trim() && process.env.CONFLUENCE_PAT?.trim());
  }
  return false;
}
