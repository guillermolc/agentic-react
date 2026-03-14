import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import { db } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.resolve(__dirname, "../../agents");

// UI metadata sourced from the original frontend/lib/agents.ts AGENTS array.
// Keyed by slug so each YAML agent is enriched with display data.
const UI_METADATA: Record<string, {
  shortName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  nextAgent?: string;
  quickPrompt?: string;
}> = {
  "deep-research": {
    shortName: "Research",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/20",
    iconColor: "#4dabff",
    nextAgent: "prd",
  },
  prd: {
    shortName: "PRD",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    borderColor: "border-green-400/20",
    iconColor: "#00e676",
    nextAgent: "technical-docs",
    quickPrompt: "Create a PRD based on the current context",
  },
  "technical-docs": {
    shortName: "Tech Docs",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    borderColor: "border-orange-400/20",
    iconColor: "#ff8c42",
    quickPrompt: "Create Technical Specs based on the current context",
  },
  "spec-writer": {
    shortName: "Spec Writer",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
    iconColor: "#b388ff",
  },
  "issue-creator": {
    shortName: "Issues",
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    borderColor: "border-red-400/20",
    iconColor: "#ff5252",
  },
  "prd-writer": {
    shortName: "PRD Writer",
    color: "text-teal-400",
    bgColor: "bg-teal-400/10",
    borderColor: "border-teal-400/20",
    iconColor: "#64ffda",
  },
};

export function seedAgents(): void {
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM agents").get() as { cnt: number };
  if (count.cnt > 0) return; // already seeded

  const files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".agent.yaml"));
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO agents
      (slug, name, displayName, shortName, description, model, tools, prompt,
       color, bgColor, borderColor, iconColor, nextAgent, quickPrompt,
       createdAt, updatedAt)
    VALUES
      (@slug, @name, @displayName, @shortName, @description, @model, @tools, @prompt,
       @color, @bgColor, @borderColor, @iconColor, @nextAgent, @quickPrompt,
       @createdAt, @updatedAt)
  `);

  const insertMany = db.transaction(() => {
    for (const file of files) {
      const raw = fs.readFileSync(path.join(AGENTS_DIR, file), "utf-8");
      const parsed = parseYaml(raw) as Record<string, unknown>;
      const slug = (parsed.name as string) ?? file.replace(".agent.yaml", "");
      const ui = UI_METADATA[slug] ?? {};

      insert.run({
        slug,
        name: (parsed.name as string) ?? slug,
        displayName: (parsed.displayName as string) ?? slug,
        shortName: ui.shortName ?? null,
        description: (parsed.description as string) ?? null,
        model: (parsed.model as string) ?? null,
        tools: parsed.tools ? JSON.stringify(parsed.tools) : null,
        prompt: (parsed.prompt as string) ?? "",
        color: ui.color ?? null,
        bgColor: ui.bgColor ?? null,
        borderColor: ui.borderColor ?? null,
        iconColor: ui.iconColor ?? null,
        nextAgent: ui.nextAgent ?? null,
        quickPrompt: ui.quickPrompt ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  insertMany();
  console.log(`[seed] Inserted ${files.length} agents from YAML files`);
}
