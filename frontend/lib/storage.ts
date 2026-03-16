export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  createdAt: number;
}

export interface Session {
  id: string;
  agentSlug: string;
  agentName: string;
  title: string;
  messages: Message[];
  messageCount?: number;
  repoFullName: string;
  createdAt: number;
  updatedAt: number;
}

export interface ActivityEvent {
  id: string;
  type: "session_created" | "message_sent" | "agent_handoff" | "repo_cloned";
  agentSlug?: string;
  repoFullName?: string;
  description: string;
  createdAt: number;
}

export interface ActiveRepo {
  fullName: string;
  username: string;
  repoName: string;
  localPath: string;
  clonedAt: number;
  provider?: "github" | "bitbucket-server";
}

const SESSIONS_KEY = "web_spec_sessions";
const ACTIVITY_KEY = "web_spec_activity";
const REPO_KEY = "web_spec_active_repo";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// --- Active Repo ---

export function getActiveRepo(): ActiveRepo | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(REPO_KEY);
  return raw ? (JSON.parse(raw) as ActiveRepo) : null;
}

export function saveActiveRepo(repo: ActiveRepo): void {
  if (!isBrowser()) return;
  localStorage.setItem(REPO_KEY, JSON.stringify(repo));
}

export function clearActiveRepo(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(REPO_KEY);
}

// --- Sessions ---

function getAllSessions(): Session[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(SESSIONS_KEY);
  return raw ? (JSON.parse(raw) as Session[]) : [];
}

export function getSessions(): Session[] {
  return getAllSessions().filter((s) => s.messages.length > 0);
}

export function getSession(id: string): Session | undefined {
  return getAllSessions().find((s) => s.id === id);
}

export function saveSession(session: Session): void {
  if (!isBrowser()) return;
  const sessions = getSessions().filter((s) => s.id !== session.id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([session, ...sessions]));
}

export function createSession(agentSlug: string, agentName: string, repoFullName: string): Session {
  const session: Session = {
    id: crypto.randomUUID(),
    agentSlug,
    agentName,
    title: "New session",
    messages: [],
    repoFullName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveSession(session);
  addActivity({
    type: "session_created",
    agentSlug,
    repoFullName,
    description: `Started ${agentName} session on ${repoFullName}`,
  });
  return session;
}

export function addMessageToSession(
  sessionId: string,
  message: Omit<Message, "id" | "createdAt">
): Session | null {
  const session = getSession(sessionId);
  if (!session) return null;

  const msg: Message = {
    ...message,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  // Use first user message as title
  if (session.messages.length === 0 && message.role === "user") {
    session.title = message.content.slice(0, 60) + (message.content.length > 60 ? "…" : "");
  }

  session.messages = [...session.messages, msg];
  session.updatedAt = Date.now();
  saveSession(session);
  return session;
}

export function deleteSession(id: string): void {
  if (!isBrowser()) return;
  const sessions = getAllSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

// --- Repo Context Clearing ---

export function clearAllSessions(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(SESSIONS_KEY);
}

export function clearAllActivity(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACTIVITY_KEY);
}

export function clearAllAgentHandoffs(): void {
  if (!isBrowser()) return;
  const keysToRemove = Object.keys(sessionStorage).filter((k) =>
    k.startsWith("web_spec_handoff_")
  );
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
}

export function clearAllRepoContext(): void {
  clearAllSessions();
  clearAllActivity();
  clearAllAgentHandoffs();
}

// --- Activity ---

export function getActivity(): ActivityEvent[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(ACTIVITY_KEY);
  return raw ? (JSON.parse(raw) as ActivityEvent[]) : [];
}

export function addActivity(event: Omit<ActivityEvent, "id" | "createdAt">): void {
  if (!isBrowser()) return;
  const activity = getActivity();
  const newEvent: ActivityEvent = {
    ...event,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify([newEvent, ...activity].slice(0, 100)));
}
