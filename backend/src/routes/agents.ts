import { Router, Request, Response } from "express";
import { db, Agent } from "../lib/db.js";

export const agentsRouter = Router();

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Parse the tools JSON string into an array for the response */
function toResponse(row: Agent) {
  return {
    ...row,
    tools: row.tools ? JSON.parse(row.tools) as string[] : [],
  };
}

// GET / — list all agents
agentsRouter.get("/", (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM agents ORDER BY createdAt").all() as Agent[];
  res.json(rows.map(toResponse));
});

// GET /:slug — get one agent
agentsRouter.get("/:slug", (req: Request, res: Response) => {
  const row = db.prepare("SELECT * FROM agents WHERE slug = ?").get(req.params.slug) as Agent | undefined;
  if (!row) {
    res.status(404).json({ error: `Agent not found: ${req.params.slug}` });
    return;
  }
  res.json(toResponse(row));
});

// POST / — create agent
agentsRouter.post("/", (req: Request, res: Response) => {
  const { slug, name, displayName, shortName, description, model, tools, prompt,
    color, bgColor, borderColor, iconColor, nextAgent, quickPrompt } = req.body;

  if (!slug || !name || !displayName || !prompt) {
    res.status(400).json({ error: "slug, name, displayName, and prompt are required" });
    return;
  }

  if (!SLUG_PATTERN.test(slug)) {
    res.status(400).json({ error: "slug must match ^[a-z0-9-]+$" });
    return;
  }

  const existing = db.prepare("SELECT slug FROM agents WHERE slug = ?").get(slug);
  if (existing) {
    res.status(409).json({ error: `Agent already exists: ${slug}` });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO agents
      (slug, name, displayName, shortName, description, model, tools, prompt,
       color, bgColor, borderColor, iconColor, nextAgent, quickPrompt,
       createdAt, updatedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    slug, name, displayName, shortName ?? null, description ?? null,
    model ?? null, tools ? JSON.stringify(tools) : null, prompt,
    color ?? null, bgColor ?? null, borderColor ?? null, iconColor ?? null,
    nextAgent ?? null, quickPrompt ?? null, now, now,
  );

  const created = db.prepare("SELECT * FROM agents WHERE slug = ?").get(slug) as Agent;
  res.status(201).json(toResponse(created));
});

// PUT /:slug — update agent
agentsRouter.put("/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;
  const row = db.prepare("SELECT * FROM agents WHERE slug = ?").get(slug) as Agent | undefined;
  if (!row) {
    res.status(404).json({ error: `Agent not found: ${slug}` });
    return;
  }

  const body = req.body as Partial<Omit<Agent, "slug" | "createdAt" | "updatedAt">>;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE agents SET
      name = ?, displayName = ?, shortName = ?, description = ?, model = ?,
      tools = ?, prompt = ?, color = ?, bgColor = ?, borderColor = ?,
      iconColor = ?, nextAgent = ?, quickPrompt = ?, updatedAt = ?
    WHERE slug = ?
  `).run(
    body.name ?? row.name,
    body.displayName ?? row.displayName,
    body.shortName !== undefined ? body.shortName : row.shortName,
    body.description !== undefined ? body.description : row.description,
    body.model !== undefined ? body.model : row.model,
    body.tools ? JSON.stringify(body.tools) : row.tools,
    body.prompt ?? row.prompt,
    body.color !== undefined ? body.color : row.color,
    body.bgColor !== undefined ? body.bgColor : row.bgColor,
    body.borderColor !== undefined ? body.borderColor : row.borderColor,
    body.iconColor !== undefined ? body.iconColor : row.iconColor,
    body.nextAgent !== undefined ? body.nextAgent : row.nextAgent,
    body.quickPrompt !== undefined ? body.quickPrompt : row.quickPrompt,
    now,
    slug,
  );

  const updated = db.prepare("SELECT * FROM agents WHERE slug = ?").get(slug) as Agent;
  res.json(toResponse(updated));
});

// DELETE /:slug — delete agent
agentsRouter.delete("/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;
  const row = db.prepare("SELECT slug FROM agents WHERE slug = ?").get(slug);
  if (!row) {
    res.status(404).json({ error: `Agent not found: ${slug}` });
    return;
  }
  db.prepare("DELETE FROM agents WHERE slug = ?").run(slug);
  res.status(204).end();
});
