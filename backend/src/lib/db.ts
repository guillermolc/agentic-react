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
