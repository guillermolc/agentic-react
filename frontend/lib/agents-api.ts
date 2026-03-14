export interface AgentRecord {
  slug: string;
  name: string;
  displayName: string;
  shortName: string | null;
  description: string | null;
  model: string | null;
  tools: string[];
  prompt: string;
  color: string | null;
  bgColor: string | null;
  borderColor: string | null;
  iconColor: string | null;
  nextAgent: string | null;
  quickPrompt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const BASE = "/api/backend/agents";

export async function fetchAgents(): Promise<AgentRecord[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`Failed to fetch agents (${res.status})`);
  return res.json();
}

export async function fetchAgent(slug: string): Promise<AgentRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Failed to fetch agent (${res.status})`);
  return res.json();
}

export async function createAgent(data: Partial<AgentRecord> & { slug: string; name: string; displayName: string; prompt: string }): Promise<AgentRecord> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Create failed (${res.status})` }));
    throw new Error(err.error ?? `Create failed (${res.status})`);
  }
  return res.json();
}

export async function updateAgent(slug: string, data: Partial<Omit<AgentRecord, "slug">>): Promise<AgentRecord> {
  const res = await fetch(`${BASE}/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Update failed (${res.status})` }));
    throw new Error(err.error ?? `Update failed (${res.status})`);
  }
  return res.json();
}

export async function deleteAgent(slug: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}
