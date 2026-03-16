// Re-export shared interfaces so pages can import from here instead of storage.ts
export type { Message, Session, ActivityEvent } from "@/lib/storage";
import type { Message, Session, ActivityEvent } from "@/lib/storage";

const SESSIONS_BASE = "/api/backend/sessions";
const ACTIVITY_BASE = "/api/backend/activity";

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function getSessions(): Promise<Session[]> {
  try {
    const res = await fetch(SESSIONS_BASE);
    if (!res.ok) throw new Error(`getSessions failed (${res.status})`);
    return (await res.json()) as Session[];
  } catch (err) {
    console.error("[sessions-api] getSessions:", err);
    return [];
  }
}

export async function getSession(id: string): Promise<Session | null> {
  try {
    const res = await fetch(`${SESSIONS_BASE}/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`getSession failed (${res.status})`);
    return (await res.json()) as Session;
  } catch (err) {
    console.error("[sessions-api] getSession:", err);
    return null;
  }
}

export async function createSession(
  agentSlug: string,
  agentName: string,
  repoFullName: string
): Promise<Session> {
  const now = Date.now();
  const body: Session = {
    id: crypto.randomUUID(),
    agentSlug,
    agentName,
    title: "New session",
    messages: [],
    repoFullName,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const res = await fetch(SESSIONS_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`createSession failed (${res.status})`);
    return (await res.json()) as Session;
  } catch (err) {
    console.error("[sessions-api] createSession:", err);
    // Return the local object as fallback so callers always get a Session
    return body;
  }
}

export async function addMessageToSession(
  sessionId: string,
  message: Omit<Message, "id" | "createdAt">
): Promise<Session | null> {
  try {
    const res = await fetch(
      `${SESSIONS_BASE}/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`addMessageToSession failed (${res.status})`);
    return (await res.json()) as Session;
  } catch (err) {
    console.error("[sessions-api] addMessageToSession:", err);
    return null;
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const res = await fetch(
      `${SESSIONS_BASE}/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (!res.ok && res.status !== 204) {
      throw new Error(`deleteSession failed (${res.status})`);
    }
  } catch (err) {
    console.error("[sessions-api] deleteSession:", err);
  }
}

export async function clearAllSessions(): Promise<void> {
  try {
    const res = await fetch(SESSIONS_BASE, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      throw new Error(`clearAllSessions failed (${res.status})`);
    }
  } catch (err) {
    console.error("[sessions-api] clearAllSessions:", err);
  }
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function getActivity(): Promise<ActivityEvent[]> {
  try {
    const res = await fetch(ACTIVITY_BASE);
    if (!res.ok) throw new Error(`getActivity failed (${res.status})`);
    return (await res.json()) as ActivityEvent[];
  } catch (err) {
    console.error("[sessions-api] getActivity:", err);
    return [];
  }
}

export async function addActivity(
  event: Omit<ActivityEvent, "id" | "createdAt">
): Promise<void> {
  try {
    const body: ActivityEvent = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    const res = await fetch(ACTIVITY_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`addActivity failed (${res.status})`);
  } catch (err) {
    console.error("[sessions-api] addActivity:", err);
  }
}

export async function clearAllActivity(): Promise<void> {
  try {
    const res = await fetch(ACTIVITY_BASE, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      throw new Error(`clearAllActivity failed (${res.status})`);
    }
  } catch (err) {
    console.error("[sessions-api] clearAllActivity:", err);
  }
}
