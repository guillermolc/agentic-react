import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db, ExternalKdb } from "../lib/db.js";

export const kdbExternalRouter = Router();

/** Mask apiKey in response */
function toResponse(row: ExternalKdb) {
  return {
    ...row,
    apiKey: row.apiKey ? "••••••" : null,
  };
}

// GET / — list all external KDBs
kdbExternalRouter.get("/", (_req: Request, res: Response) => {
  try {
    const rows = db.prepare("SELECT * FROM external_kdbs ORDER BY createdAt DESC").all() as ExternalKdb[];
    res.json(rows.map(toResponse));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list external KDBs";
    res.status(500).json({ error: msg });
  }
});

// POST / — create a new external KDB
kdbExternalRouter.post("/", (req: Request, res: Response) => {
  const { name, baseUrl, repoId, apiKey, description } = req.body as {
    name?: string;
    baseUrl?: string;
    repoId?: string;
    apiKey?: string;
    description?: string;
  };

  if (!name?.trim() || !baseUrl?.trim() || !repoId?.trim()) {
    res.status(400).json({ error: "name, baseUrl, and repoId are required" });
    return;
  }

  try {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO external_kdbs (id, name, baseUrl, repoId, apiKey, description, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), baseUrl.trim(), repoId.trim(), apiKey?.trim() || null, description?.trim() || null, createdAt);

    const row = db.prepare("SELECT * FROM external_kdbs WHERE id = ?").get(id) as ExternalKdb;
    res.status(201).json(toResponse(row));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create external KDB";
    res.status(500).json({ error: msg });
  }
});

// DELETE /:id — remove an external KDB
kdbExternalRouter.delete("/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  const row = db.prepare("SELECT * FROM external_kdbs WHERE id = ?").get(id) as ExternalKdb | undefined;
  if (!row) {
    res.status(404).json({ error: `External KDB not found: ${id}` });
    return;
  }

  try {
    db.prepare("DELETE FROM external_kdbs WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete external KDB";
    res.status(500).json({ error: msg });
  }
});
