/**
 * Query an external KDB-Vector-Grafo-v2 (Coderag) instance.
 * Calls POST {baseUrl}/query and returns the answer text.
 */

const TIMEOUT_MS = 10_000;
const MAX_ANSWER_CHARS = 4000;

export async function queryKDB(
  baseUrl: string,
  repoId: string,
  apiKey: string | null,
  queryText: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const url = `${baseUrl.replace(/\/+$/, "")}/query`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ repo_id: repoId, query: queryText, top_k: 10 }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json() as { detail?: unknown };
        if (body.detail) {
          detail += `: ${typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)}`;
        }
      } catch {
        // ignore parse error
      }
      throw new Error(`KDB query failed — ${detail}`);
    }

    const data = await res.json() as { answer: string };
    let answer = data.answer ?? "";

    if (answer.length > MAX_ANSWER_CHARS) {
      answer = answer.slice(0, MAX_ANSWER_CHARS) + "... (truncated)";
    }

    return answer;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`KDB query timed out after ${TIMEOUT_MS / 1000}s (${baseUrl})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
