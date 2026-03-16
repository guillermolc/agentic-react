import { Router, Request, Response } from "express";
import { db, SessionRow, MessageRow, ActivityRow } from "../lib/db.js";

// ─── Sessions Router ────────────────────────────────────────────────────────
export const sessionsRouter = Router();

function toSessionResponse(row: SessionRow, messages: MessageRow[], messageCount?: number) {
  return {
    ...row,
    messages,
    messageCount: messageCount ?? messages.length,
  };
}

// GET / — list all sessions ordered by updatedAt DESC, with messageCount
sessionsRouter.get("/", (_req: Request, res: Response) => {
  try {
    const rows = db
      .prepare(
        `SELECT s.*,
          (SELECT COUNT(*) FROM messages WHERE sessionId = s.id) AS messageCount
         FROM sessions s
         ORDER BY s.updatedAt DESC`
      )
      .all() as (SessionRow & { messageCount: number })[];

    res.json(
      rows.map((row) => {
        const { messageCount, ...session } = row;
        return { ...session, messages: [], messageCount };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE / — delete all sessions (must be registered BEFORE DELETE /:id)
sessionsRouter.delete("/", (_req: Request, res: Response) => {
  try {
    db.prepare("DELETE FROM sessions").run();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /:id — get one session with messages
sessionsRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(req.params.id) as SessionRow | undefined;

    if (!session) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const messages = db
      .prepare("SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt ASC")
      .all(req.params.id) as MessageRow[];

    res.json(toSessionResponse(session, messages));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST / — create session
sessionsRouter.post("/", (req: Request, res: Response) => {
  try {
    const { id, agentSlug, agentName, title, repoFullName, createdAt, updatedAt } =
      req.body as SessionRow;

    db.prepare(
      `INSERT INTO sessions (id, agentSlug, agentName, title, repoFullName, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, agentSlug, agentName, title, repoFullName, createdAt, updatedAt);

    const created = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as SessionRow;

    res.status(201).json(toSessionResponse(created, []));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:id/messages — add message to session
sessionsRouter.post("/:id/messages", (req: Request, res: Response) => {
  try {
    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(req.params.id) as SessionRow | undefined;

    if (!session) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const { role, content, reasoning } = req.body as {
      role: string;
      content: string;
      reasoning?: string;
    };

    const msgId = crypto.randomUUID();
    const createdAt = Date.now();

    // Count existing messages to determine if this is the first user message
    const { count } = db
      .prepare("SELECT COUNT(*) AS count FROM messages WHERE sessionId = ?")
      .get(req.params.id) as { count: number };

    db.prepare(
      `INSERT INTO messages (id, sessionId, role, content, reasoning, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(msgId, req.params.id, role, content, reasoning ?? null, createdAt);

    // Update title on first user message
    if (count === 0 && role === "user") {
      const title =
        content.length > 60 ? content.slice(0, 60) + "…" : content;
      db.prepare(
        "UPDATE sessions SET title = ?, updatedAt = ? WHERE id = ?"
      ).run(title, Date.now(), req.params.id);
    } else {
      db.prepare("UPDATE sessions SET updatedAt = ? WHERE id = ?").run(
        Date.now(),
        req.params.id
      );
    }

    const updatedSession = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(req.params.id) as SessionRow;

    const messages = db
      .prepare("SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt ASC")
      .all(req.params.id) as MessageRow[];

    res.status(201).json(toSessionResponse(updatedSession, messages));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /:id — delete one session (cascades to messages)
sessionsRouter.delete("/:id", (req: Request, res: Response) => {
  try {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Activity Router ─────────────────────────────────────────────────────────
export const activityRouter = Router();

// GET / — list last 50 activity events
activityRouter.get("/", (_req: Request, res: Response) => {
  try {
    const rows = db
      .prepare("SELECT * FROM activity ORDER BY createdAt DESC LIMIT 50")
      .all() as ActivityRow[];
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST / — create activity event
activityRouter.post("/", (req: Request, res: Response) => {
  try {
    const { id, type, agentSlug, repoFullName, description, createdAt } =
      req.body as ActivityRow;

    db.prepare(
      `INSERT INTO activity (id, type, agentSlug, repoFullName, description, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, type, agentSlug ?? null, repoFullName ?? null, description, createdAt);

    const created = db
      .prepare("SELECT * FROM activity WHERE id = ?")
      .get(id) as ActivityRow;

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE / — delete all activity
activityRouter.delete("/", (_req: Request, res: Response) => {
  try {
    db.prepare("DELETE FROM activity").run();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
