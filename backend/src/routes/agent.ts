import { Router, Request, Response } from "express";
import fs from "fs";
import { db, Agent, ExternalKdb } from "../lib/db.js";
import { getCopilotPAT, getVertexCredentials, isProviderConfigured, VALID_PROVIDERS, ProviderName } from "../lib/providers.js";
import { runWithCopilot } from "../lib/copilot-runner.js";
import { runWithVertex } from "../lib/vertex-runner.js";
import { queryKDB } from "../lib/kdb-query.js";
import { readAllDocuments } from "../lib/atlassian/document-store.js";
import { ContextSource, gatherAllContext } from "../lib/context-gatherer.js";

export const agentRouter = Router();

interface AgentRunConfig {
  name: string;
  displayName: string;
  description?: string;
  tools?: string[];
  prompt: string;
}

function loadAgentConfig(slug: string): AgentRunConfig | null {
  const row = db.prepare("SELECT * FROM agents WHERE slug = ?").get(slug) as Agent | undefined;
  if (!row) return null;
  return {
    name: row.name,
    displayName: row.displayName,
    description: row.description ?? undefined,
    tools: row.tools ? JSON.parse(row.tools) as string[] : undefined,
    prompt: row.prompt,
  };
}

// POST /api/agent/run  (SSE streaming)
agentRouter.post("/run", async (req: Request, res: Response) => {
  const {
    agentSlug, prompt, repoPath, context, spaceRef, spaceRefs: rawSpaceRefs,
    workiqContext, provider, model, kdbRefs: rawKdbRefs,
  } = req.body as {
    agentSlug: string;
    prompt: string;
    repoPath: string;
    context?: string;
    spaceRef?: string;
    spaceRefs?: string[];
    workiqContext?: { type: string; title: string; summary: string }[];
    provider?: string;
    model?: string;
    kdbRefs?: string[];
  };

  const kdbRefs: string[] = rawKdbRefs ?? [];

  // Normalize: prefer spaceRefs array; fall back to wrapping legacy spaceRef
  const spaceRefs: string[] = rawSpaceRefs && rawSpaceRefs.length > 0
    ? rawSpaceRefs
    : spaceRef
      ? [spaceRef]
      : [];

  if (!agentSlug || !prompt || !repoPath) {
    res.status(400).json({ error: "agentSlug, prompt, and repoPath are required" });
    return;
  }

  if (!provider || !model) {
    res.status(400).json({ error: "provider and model are required" });
    return;
  }

  if (!VALID_PROVIDERS.includes(provider as ProviderName)) {
    res.status(400).json({ error: `Invalid provider: ${provider}. Valid: ${VALID_PROVIDERS.join(", ")}` });
    return;
  }

  if (!isProviderConfigured(provider as ProviderName)) {
    res.status(503).json({ error: `Provider not configured: ${provider}` });
    return;
  }

  if (!fs.existsSync(repoPath)) {
    res.status(404).json({ error: "Repository path not found" });
    return;
  }

  const agentConfig = loadAgentConfig(agentSlug);
  if (!agentConfig) {
    res.status(400).json({ error: `Unknown agent: ${agentSlug}` });
    return;
  }

  console.log(`[agent:${agentSlug}] provider=${provider} model=${model}`);

  // --- Build context sources for parallel gathering ---
  const contextSources: ContextSource[] = [];

  // Handoff context (previous agent output)
  if (context) {
    contextSources.push({
      name: "handoff",
      gather: async () => `\n\nPrevious context:\n${context}`,
    });
  }

  // Copilot Spaces
  if (provider === "copilot" && spaceRefs.length > 0) {
    contextSources.push({
      name: "spaces",
      gather: async () =>
        `\n\nYou have access to these Copilot Spaces: ${spaceRefs.map(s => `"${s}"`).join(", ")}. Use the github-get_copilot_space tool for each space to retrieve its context and incorporate it into your analysis.`,
    });
  }

  // WorkIQ context
  if (workiqContext && workiqContext.length > 0) {
    contextSources.push({
      name: "workiq",
      gather: async () => {
        const MAX_WORKIQ_CHARS = 4000;
        const formatted = workiqContext.map(
          (i) => `[${i.type}] ${i.title}: ${i.summary}`
        );
        let joined = formatted.join("\n");
        if (joined.length > MAX_WORKIQ_CHARS) {
          const perItem = Math.floor(MAX_WORKIQ_CHARS / workiqContext.length) - 30;
          joined = workiqContext
            .map((i) => {
              const summary = i.summary.length > perItem ? i.summary.slice(0, perItem) + "... (truncated)" : i.summary;
              return `[${i.type}] ${i.title}: ${summary}`;
            })
            .join("\n");
        }
        return `\n\nWorkIQ Context (Microsoft 365 data provided by the user):\n${joined}`;
      },
    });
  }

  // External KDB context
  if (kdbRefs.length > 0) {
    contextSources.push({
      name: "kdb",
      gather: async () => {
        const kdbRows = kdbRefs
          .map((id) => db.prepare("SELECT * FROM external_kdbs WHERE id = ?").get(id) as ExternalKdb | undefined)
          .filter((row): row is ExternalKdb => {
            if (!row) console.warn(`[agent:${agentSlug}] KDB ref not found, skipping`);
            return !!row;
          });
        if (kdbRows.length === 0) return "";
        const results = await Promise.allSettled(
          kdbRows.map((row) => queryKDB(row.baseUrl, row.repoId, row.apiKey, prompt)),
        );
        const fulfilled: string[] = [];
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) fulfilled.push(r.value);
          else if (r.status === "rejected") console.error(`[agent:${agentSlug}] KDB query failed:`, r.reason);
        }
        if (fulfilled.length === 0) return "";
        return `\n\nExternal KDB Context:\n${fulfilled.join("\n\n---\n\n")}`;
      },
    });
  }

  // Atlassian context (Jira/Confluence documents)
  contextSources.push({
    name: "atlassian",
    gather: async () => {
      const content = readAllDocuments();
      return content ? `\n\nAtlassian Context (Jira/Confluence documents):\n${content}` : "";
    },
  });

  // Gather all context in parallel
  const gathered = await gatherAllContext(contextSources);
  const sourceNames = gathered.map((g) => g.name);
  console.log(`[agent:${agentSlug}] Context sources resolved: ${gathered.length} (${sourceNames.join(", ")})`);

  const THINK_GUIDANCE =
    "\n\nWhen reasoning through a problem before answering, enclose your internal thinking in <think>...</think> tags at the very beginning of your response. Your answer must follow after the closing </think> tag with no extra preamble.";

  // Prompt construction: basePrompt + gathered context blocks + THINK_GUIDANCE
  const contextBlocks = gathered.map((g) => g.content).join("");
  const systemPrompt = agentConfig.prompt + contextBlocks + THINK_GUIDANCE;

  // Route to the appropriate runner
  if (provider === "copilot") {
    await runWithCopilot(
      {
        model,
        systemPrompt,
        prompt,
        agentSlug,
        repoPath,
        tools: agentConfig.tools,
        spaceRefs,
      },
      res,
      req,
    );
  } else if (provider === "vertex") {
    await runWithVertex(
      { model, systemPrompt, prompt },
      res,
    );
  }
});

