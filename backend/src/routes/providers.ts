import { Router, Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { CopilotClient } from "@github/copilot-sdk";
import {
  getCopilotPAT,
  getVertexCredentials,
  isProviderConfigured,
} from "../lib/providers.js";

export const providersRouter = Router();

// --- Types ---

interface ProviderModels {
  provider: string;
  models: string[];
}

// --- Fallbacks (used when the provider API is unreachable) ---

const COPILOT_FALLBACK_MODELS: any[] = [];
const VERTEX_FALLBACK_MODELS: any[] = [];

// --- Copilot model listing ---
// Uses CopilotClient.listModels() to enumerate models available to the configured PAT.

async function listCopilotModels(pat: string): Promise<string[]> {
  const client = new CopilotClient({
    env: {
      ...process.env,
      GH_TOKEN: pat,
      GITHUB_PERSONAL_ACCESS_TOKEN: pat,
    },
  });
  try {
    await client.start();
    const models = await client.listModels();
    const ids = models.map((m) => m.id).filter(Boolean);
    return ids.length > 0 ? ids : COPILOT_FALLBACK_MODELS;
  } catch {
    return COPILOT_FALLBACK_MODELS;
  } finally {
    await client.stop().catch(() => {});
  }
}

// --- Vertex model listing ---
// Uses the @google/genai SDK (ai.models.list) to enumerate available Gemini models.

async function listVertexModels(): Promise<string[]> {
  const credentials = getVertexCredentials();
  if (!credentials) return VERTEX_FALLBACK_MODELS;

  try {
    const location = process.env.VERTEX_LOCATION?.trim() || "us-central1";

    const ai = new GoogleGenAI({
      vertexai: true,
      project: credentials.project_id,
      location,
      googleAuthOptions: {
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
      },
    });

    const models: string[] = [];
    const pager = await ai.models.list();
    for await (const model of pager) {
      const name = model.name;
      if (!name) continue;
      // Strip resource path prefix: "publishers/google/models/gemini-2.0-flash" → "gemini-2.0-flash"
      const shortName = name.includes("/") ? (name.split("/").pop() ?? name) : name;
      if (shortName.startsWith("gemini")) {
        models.push(shortName);
      }
    }

    return models.length > 0 ? models : VERTEX_FALLBACK_MODELS;
  } catch {
    return VERTEX_FALLBACK_MODELS;
  }
}

// --- In-memory cache (5-minute TTL) ---

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedResult: ProviderModels[] | null = null;
let cacheTimestamp = 0;

// --- Endpoint ---

// GET /api/providers/models
providersRouter.get("/models", async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");

  // Return cached result if within TTL
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    res.json(cachedResult);
    return;
  }

  const result: ProviderModels[] = [];

  if (isProviderConfigured("copilot")) {
    const pat = getCopilotPAT()!;
    const models = await listCopilotModels(pat);
    result.push({ provider: "copilot", models });
  }

  if (isProviderConfigured("vertex")) {
    const models = await listVertexModels();
    result.push({ provider: "vertex", models });
  }

  cachedResult = result;
  cacheTimestamp = Date.now();

  res.json(result);
});
