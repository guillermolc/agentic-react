import { Router, Request, Response } from "express";
import { db, Agent } from "../lib/db.js";

export const adminRouter = Router();

/** Parse the tools JSON string into an array for the response */
function toResponse(row: Agent) {
  return {
    ...row,
    tools: row.tools ? JSON.parse(row.tools) as string[] : [],
  };
}

// GET /agents — list all agents (delegates to DB)
adminRouter.get("/agents", (_req: Request, res: Response) => {
  try {
    const rows = db.prepare("SELECT * FROM agents ORDER BY createdAt").all() as Agent[];
    res.json(rows.map(toResponse));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list agents";
    res.status(500).json({ error: msg });
  }
});

// GET /agents/:slug — get one agent
adminRouter.get("/agents/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;
  const row = db.prepare("SELECT * FROM agents WHERE slug = ?").get(slug) as Agent | undefined;
  if (!row) {
    res.status(404).json({ error: `Agent not found: ${slug}` });
    return;
  }
  res.json(toResponse(row));
});

// PUT /agents/:slug — update an agent
adminRouter.put("/agents/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;
  const row = db.prepare("SELECT * FROM agents WHERE slug = ?").get(slug) as Agent | undefined;
  if (!row) {
    res.status(404).json({ error: `Agent not found: ${slug}` });
    return;
  }

  const { displayName, description, model, tools, prompt } = req.body as {
    displayName?: string;
    description?: string;
    model?: string;
    tools?: string[];
    prompt?: string;
  };

  if (!displayName || !prompt) {
    res.status(400).json({ error: "displayName and prompt are required" });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE agents SET
      displayName = ?, description = ?, model = ?, tools = ?, prompt = ?, updatedAt = ?
    WHERE slug = ?
  `).run(
    displayName,
    description ?? row.description,
    model ?? row.model,
    tools ? JSON.stringify(tools) : row.tools,
    prompt,
    now,
    slug,
  );

  const updated = db.prepare("SELECT * FROM agents WHERE slug = ?").get(slug) as Agent;
  res.json(toResponse(updated));
});
