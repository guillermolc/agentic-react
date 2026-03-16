import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../data/agents.db");

export interface Agent {
  slug: string;
  name: string;
  displayName: string;
  shortName: string | null;
  description: string | null;
  model: string | null;
  tools: string | null; // JSON string array, parsed at the boundary
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

export interface ExternalKdb {
  id: string;
  name: string;
  baseUrl: string;
  repoId: string;
  apiKey: string | null;
  description: string | null;
  createdAt: string;
}

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    displayName TEXT NOT NULL,
    shortName   TEXT,
    description TEXT,
    model       TEXT,
    tools       TEXT,
    prompt      TEXT NOT NULL,
    color       TEXT,
    bgColor     TEXT,
    borderColor TEXT,
    iconColor   TEXT,
    nextAgent   TEXT,
    quickPrompt TEXT,
    createdAt   TEXT,
    updatedAt   TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS external_kdbs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    baseUrl     TEXT NOT NULL,
    repoId      TEXT NOT NULL,
    apiKey      TEXT,
    description TEXT,
    createdAt   TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    agentSlug    TEXT NOT NULL,
    agentName    TEXT NOT NULL,
    title        TEXT NOT NULL,
    repoFullName TEXT NOT NULL,
    createdAt    INTEGER NOT NULL,
    updatedAt    INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id        TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role      TEXT NOT NULL,
    content   TEXT NOT NULL,
    reasoning TEXT,
    createdAt INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS activity (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    agentSlug    TEXT,
    repoFullName TEXT,
    description  TEXT NOT NULL,
    createdAt    INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId)
`);

export interface SessionRow {
  id: string;
  agentSlug: string;
  agentName: string;
  title: string;
  repoFullName: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRow {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  reasoning: string | null;
  createdAt: number;
}

export interface ActivityRow {
  id: string;
  type: string;
  agentSlug: string | null;
  repoFullName: string | null;
  description: string;
  createdAt: number;
}
