/**
 * Provider configuration module — reads and validates LLM provider credentials
 * from environment variables. Uses lazy initialization so that dotenv has a
 * chance to load .env before we read process.env.
 */

export interface VertexCredentials {
  type: string;
  project_id: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

// --- Lazy init flag ---

let _initialized = false;
let _copilotPAT: string | null = null;
let _vertexCredentials: VertexCredentials | null = null;

function ensureInit(): void {
  if (_initialized) return;
  _initialized = true;

  // --- Copilot ---
  _copilotPAT = process.env.GITHUB_PAT?.trim() || null;

  // --- Vertex AI ---
  const b64 = process.env.VERTEX_SERVICE_ACCOUNT_B64?.trim();
  if (b64) {
    try {
      const json = Buffer.from(b64, "base64").toString("utf-8");
      const parsed = JSON.parse(json) as Record<string, unknown>;

      const projectId = parsed.project_id;
      const clientEmail = parsed.client_email;
      const privateKey = parsed.private_key;

      if (typeof projectId !== "string" || !projectId) {
        console.warn("[providers] Vertex: missing or invalid project_id — skipping");
      } else if (typeof clientEmail !== "string" || !clientEmail) {
        console.warn("[providers] Vertex: missing or invalid client_email — skipping");
      } else if (typeof privateKey !== "string" || !privateKey) {
        console.warn("[providers] Vertex: missing or invalid private_key — skipping");
      } else {
        _vertexCredentials = {
          type: (parsed.type as string) ?? "service_account",
          project_id: projectId,
          private_key_id: parsed.private_key_id as string | undefined,
          private_key: privateKey,
          client_email: clientEmail,
          client_id: parsed.client_id as string | undefined,
          auth_uri: parsed.auth_uri as string | undefined,
          token_uri: parsed.token_uri as string | undefined,
          auth_provider_x509_cert_url: parsed.auth_provider_x509_cert_url as string | undefined,
          client_x509_cert_url: parsed.client_x509_cert_url as string | undefined,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.warn(`[providers] Vertex: failed to decode VERTEX_SERVICE_ACCOUNT_B64 — ${msg}`);
    }
  }

  // --- Startup log ---
  const activeProviders: string[] = [];
  if (_copilotPAT) activeProviders.push("copilot");
  if (_vertexCredentials) activeProviders.push("vertex");

  if (activeProviders.length > 0) {
    console.log(`[providers] Active LLM providers: ${activeProviders.join(", ")}`);
  } else {
    console.warn("[providers] No LLM providers configured — set GITHUB_PAT and/or VERTEX_SERVICE_ACCOUNT_B64");
  }
}

// --- Public API ---

export function getCopilotPAT(): string | null {
  ensureInit();
  return _copilotPAT;
}

export function getVertexCredentials(): VertexCredentials | null {
  ensureInit();
  return _vertexCredentials;
}

export const VALID_PROVIDERS = ["copilot", "vertex"] as const;
export type ProviderName = (typeof VALID_PROVIDERS)[number];

export function isProviderConfigured(provider: ProviderName): boolean {
  ensureInit();
  if (provider === "copilot") return _copilotPAT !== null;
  if (provider === "vertex") return _vertexCredentials !== null;
  return false;
}

// --- Repo provider PAT helpers ---

export type RepoProvider = "github" | "bitbucket-server";

export function getRepoPAT(provider: RepoProvider): string | null {
  if (provider === "github") return process.env.GITHUB_PAT?.trim() || null;
  if (provider === "bitbucket-server") return process.env.BITBUCKET_PAT?.trim() || null;
  return null;
}

export function getBitbucketServerUrl(): string | null {
  return process.env.BITBUCKET_SERVER_URL?.trim().replace(/\/$/, "") || null;
}
