import { Router, Request, Response } from "express";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getCopilotPAT, getRepoPAT, getBitbucketServerUrl, RepoProvider } from "../lib/providers.js";

export const reposRouter = Router();

function sanitizePAT(text: string, pat: string): string {
  if (!pat) return text;
  const escaped = pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "g"), "***");
}

import os from "os";

const WORK_DIR = process.env.WORK_DIR || path.join(os.homedir(), "work");

function getRepoPath(username: string, repoName: string): string {
  return path.join(WORK_DIR, username, repoName);
}

// POST /api/repos/clone
reposRouter.post("/clone", async (req: Request, res: Response) => {
  const { repoFullName, provider: rawProvider } = req.body as {
    repoFullName: string;
    provider?: RepoProvider;
  };

  const provider: RepoProvider = rawProvider || "github";

  if (!repoFullName) {
    res.status(400).json({ error: "repoFullName is required" });
    return;
  }

  const [owner, repoName] = repoFullName.split("/");
  if (!owner || !repoName) {
    res.status(400).json({ error: "repoFullName must be in owner/repo format" });
    return;
  }

  if (provider === "bitbucket-server") {
    const bbUrl = getBitbucketServerUrl();
    const bbPat = getRepoPAT("bitbucket-server");
    if (!bbUrl || !bbPat) {
      res.status(503).json({ error: "BITBUCKET_SERVER_URL and BITBUCKET_PAT must be configured on the server" });
      return;
    }

    const repoPath = getRepoPath(owner, repoName);

    // Already cloned — fetch latest
    if (fs.existsSync(repoPath)) {
      try {
        execSync(
          `git -c http.extraHeader="Authorization: Bearer ${bbPat}" -c http.sslVerify=false fetch origin`,
          { cwd: repoPath, timeout: 30000, stdio: "pipe" },
        );
        execSync(`git reset --hard origin/HEAD`, { cwd: repoPath, timeout: 30000, stdio: "pipe" });
        res.json({ success: true, repoPath, alreadyCloned: true, synced: true });
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : "Sync failed";
        res.status(500).json({ error: sanitizePAT(raw, bbPat) });
      }
      return;
    }

    const parentDir = path.dirname(repoPath);
    fs.mkdirSync(parentDir, { recursive: true });

    const cloneUrl = `${bbUrl}/scm/${owner}/${repoName}.git`;

    try {
      execSync(
        `git -c http.extraHeader="Authorization: Bearer ${bbPat}" -c http.sslVerify=false clone --depth 1 "${cloneUrl}" "${repoPath}"`,
        { timeout: 60000, stdio: "pipe" },
      );
      res.json({ success: true, repoPath, alreadyCloned: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Clone failed";
      res.status(500).json({ error: sanitizePAT(message, bbPat) });
    }
    return;
  }

  // --- GitHub (default) ---
  const pat = getCopilotPAT();

  if (!pat) {
    res.status(503).json({ error: "GITHUB_PAT not configured on server" });
    return;
  }

  const repoPath = getRepoPath(owner, repoName);

  // Already cloned — fetch latest changes
  if (fs.existsSync(repoPath)) {
    try {
      execSync(`git fetch origin`, { cwd: repoPath, timeout: 30000, stdio: "pipe" });
      execSync(`git reset --hard origin/HEAD`, { cwd: repoPath, timeout: 30000, stdio: "pipe" });
      res.json({ success: true, repoPath, alreadyCloned: true, synced: true });
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Sync failed";
      const sanitized = sanitizePAT(raw, pat);
      res.status(500).json({ error: sanitized });
    }
    return;
  }

  // Ensure parent dir exists
  const parentDir = path.dirname(repoPath);
  fs.mkdirSync(parentDir, { recursive: true });

  const cloneUrl = `https://${pat}@github.com/${repoFullName}.git`;

  try {
    execSync(`git clone --depth 1 "${cloneUrl}" "${repoPath}"`, {
      timeout: 60000,
      stdio: "pipe",
    });
    res.json({ success: true, repoPath, alreadyCloned: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Clone failed";
    res.status(500).json({ error: message.replace(pat, "***") });
  }
});

// GET /api/repos/status?username=&repoName=
reposRouter.get("/status", (req: Request, res: Response) => {
  const { username, repoName } = req.query as { username: string; repoName: string };

  if (!username || !repoName) {
    res.status(400).json({ error: "username and repoName are required" });
    return;
  }

  const repoPath = getRepoPath(username, repoName);
  const exists = fs.existsSync(repoPath);
  res.json({ exists, repoPath: exists ? repoPath : null });
});

// DELETE /api/repos/remove
reposRouter.delete("/remove", (req: Request, res: Response) => {
  const { username, repoName } = req.body as { username: string; repoName: string };

  if (!username || !repoName) {
    res.status(400).json({ error: "username and repoName are required" });
    return;
  }

  const repoPath = getRepoPath(username, repoName);

  if (!fs.existsSync(repoPath)) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }

  try {
    fs.rmSync(repoPath, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Remove failed";
    res.status(500).json({ error: message });
  }
});

// GET /api/repos/tree?username=&repoName=
reposRouter.get("/tree", (req: Request, res: Response) => {
  const { username, repoName } = req.query as { username: string; repoName: string };

  if (!username || !repoName) {
    res.status(400).json({ error: "username and repoName are required" });
    return;
  }

  const repoPath = getRepoPath(username, repoName);

  if (!fs.existsSync(repoPath)) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }

  function buildTree(dir: string, depth = 0): string[] {
    if (depth > 3) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const result: string[] = [];
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoPath, fullPath);
      result.push(entry.isDirectory() ? `${relativePath}/` : relativePath);
      if (entry.isDirectory()) {
        result.push(...buildTree(fullPath, depth + 1));
      }
    }
    return result;
  }

  res.json({ repoPath, tree: buildTree(repoPath) });
});

// GET /api/repos/search?q=query&provider=github|bitbucket-server
reposRouter.get("/search", async (req: Request, res: Response) => {
  const provider = (req.query.provider as RepoProvider) || "github";
  const q = (req.query.q as string) || "";

  if (provider === "bitbucket-server") {
    const bbUrl = getBitbucketServerUrl();
    const bbPat = getRepoPAT("bitbucket-server");
    if (!bbUrl || !bbPat) {
      res.status(503).json({ error: "BITBUCKET_SERVER_URL and BITBUCKET_PAT must be configured on the server" });
      return;
    }
    try {
      const searchUrl = `${bbUrl}/rest/api/1.0/repos?name=${encodeURIComponent(q)}&limit=20`;
      const bbRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${bbPat}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!bbRes.ok) {
        res.status(bbRes.status).json({ error: "Bitbucket Server API error" });
        return;
      }
      const data = (await bbRes.json()) as {
        values: { id: number; slug: string; project: { key: string }; description?: string; name: string }[];
      };
      const items = (data.values || []).map((r) => ({
        id: r.id,
        full_name: `${r.project.key}/${r.slug}`,
        name: r.slug,
        owner: { login: r.project.key },
        description: r.description || null,
        private: true,
        stargazers_count: 0,
        forks_count: 0,
        language: null,
        updated_at: new Date().toISOString(),
      }));
      res.json(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bitbucket search failed";
      res.status(502).json({ error: message });
    }
    return;
  }

  // --- GitHub (default) ---
  const pat = getCopilotPAT();
  if (!pat) {
    res.status(503).json({ error: "GITHUB_PAT not configured on server" });
    return;
  }

  try {
    // Get authenticated user for scoping
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${pat}`, "User-Agent": "web-spec-backend" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userRes.ok) {
      res.status(userRes.status).json({ error: "GitHub API error" });
      return;
    }
    const user = (await userRes.json()) as { login: string };
    const username = user.login;

    const url = q
      ? `https://api.github.com/search/repositories?q=${encodeURIComponent(q + " user:" + username)}&sort=updated&per_page=20`
      : `https://api.github.com/user/repos?sort=updated&per_page=20`;

    const repoRes = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}`, "User-Agent": "web-spec-backend" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!repoRes.ok) {
      res.status(repoRes.status).json({ error: "GitHub API error" });
      return;
    }

    const data = await repoRes.json();
    // Normalize: search returns { items }, list returns array
    const items = Array.isArray(data) ? data : (data as { items?: unknown[] }).items ?? [];
    res.json(items);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Search failed";
    res.status(500).json({ error: message });
  }
});

// GET /api/repos/me — return authenticated GitHub username
reposRouter.get("/me", async (_req: Request, res: Response) => {
  const pat = getCopilotPAT();
  if (!pat) {
    res.status(503).json({ error: "GITHUB_PAT not configured on server" });
    return;
  }

  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${pat}`, "User-Agent": "web-spec-backend" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userRes.ok) {
      res.status(userRes.status).json({ error: "GitHub API error" });
      return;
    }
    const user = (await userRes.json()) as { login: string };
    res.json({ username: user.login });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch user";
    res.status(500).json({ error: message });
  }
});
