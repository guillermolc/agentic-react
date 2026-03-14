/**
 * Copilot runner — executes an agent prompt using GitHub Copilot SDK
 * and streams the response back as SSE events:
 *   chunk (token), reasoning (think block), done, error.
 */

import { Request, Response } from "express";
import { CopilotClient, SessionEvent } from "@github/copilot-sdk";
import { getCopilotPAT } from "./providers.js";

export interface CopilotRunOpts {
  model: string;
  systemPrompt: string;
  prompt: string;
  agentSlug: string;
  repoPath: string;
  tools?: string[];
  spaceRefs?: string[];
}

/**
 * Run a prompt against GitHub Copilot and stream SSE events to the client.
 * Callers must have already validated that the Copilot PAT is configured.
 */
export async function runWithCopilot(
  opts: CopilotRunOpts,
  res: Response,
  req: Request,
): Promise<void> {
  const pat = getCopilotPAT();
  if (!pat) {
    throw new Error("Copilot provider is not configured");
  }

  const { model, systemPrompt, prompt, agentSlug, repoPath, tools, spaceRefs = [] } = opts;

  let client: CopilotClient | null = null;

  // Create client and session BEFORE opening SSE stream so errors return proper HTTP responses
  try {
    const clientOpts: Record<string, unknown> = { cwd: repoPath };
    clientOpts.env = {
      ...process.env,
      GH_TOKEN: pat,
      GITHUB_PERSONAL_ACCESS_TOKEN: pat,
    };
    if (spaceRefs.length > 0) {
      (clientOpts.env as Record<string, string>).COPILOT_MCP_COPILOT_SPACES_ENABLED = "true";
    }
    client = new CopilotClient(clientOpts);
    await client.start();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to start Copilot client";
    console.error(`[agent:${agentSlug}] startup error:`, msg);
    res.status(500).json({ error: msg });
    return;
  }

  let session: Awaited<ReturnType<CopilotClient["createSession"]>>;
  try {
    const MCP_URL = "https://api.githubcopilot.com/mcp/readonly";

    session = await client.createSession({
      model,
      streaming: true,
      workingDirectory: repoPath,
      systemMessage: { content: systemPrompt },
      availableTools: tools?.includes("*")
        ? undefined
        : spaceRefs.length > 0
          ? [...(tools ?? []), "github-get_copilot_space", "github-list_copilot_spaces"]
          : tools,
      onPermissionRequest: () => ({ kind: "approved" as const }),
      ...(spaceRefs.length > 0
        ? {
            mcpServers: {
              github: {
                type: "http" as const,
                url: MCP_URL,
                headers: {
                  Authorization: `Bearer ${pat}`,
                  "X-MCP-Toolsets": "copilot_spaces",
                },
                tools: ["get_copilot_space", "list_copilot_spaces"],
              },
            },
          }
        : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create session";
    console.error(`[agent:${agentSlug}] session error:`, msg);
    await client.stop().catch(() => {});
    res.status(500).json({ error: msg });
    return;
  }

  // Now open SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (type: string, data: string) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let done = false;

  const finish = async (reason = "unknown") => {
    if (done) return;
    done = true;
    console.log(`[agent:${agentSlug}] finish() called, reason: ${reason}`);
    sendEvent("done", "");
    res.end();
    await client?.stop().catch(() => {});
  };

  req.on("close", () => { void finish("req.close"); });

  let gotContent = false;
  let promptSent = false;

  // State for <think>...</think> tag-based reasoning extraction.
  let hasNativeReasoning = false;
  let thinkState: "waiting" | "in_think" | "answering" = "waiting";
  let thinkBuffer = "";
  const THINK_OPEN = "<think>";
  const THINK_CLOSE = "</think>";

  session.on((event: SessionEvent) => {
    console.log(`[agent:${agentSlug}] event: ${event.type}`);
    if (event.type === "assistant.reasoning_delta") {
      hasNativeReasoning = true;
      sendEvent("reasoning", event.data.deltaContent ?? "");
    }
    if (event.type === "assistant.message_delta") {
      const delta = event.data.deltaContent ?? "";

      if (thinkState === "answering") {
        gotContent = true;
        sendEvent("chunk", delta);
        return;
      }

      thinkBuffer += delta;

      if (thinkState === "waiting") {
        if (thinkBuffer.startsWith(THINK_OPEN)) {
          thinkState = "in_think";
          thinkBuffer = thinkBuffer.slice(THINK_OPEN.length);
        } else if (thinkBuffer.length >= THINK_OPEN.length) {
          thinkState = "answering";
          gotContent = true;
          sendEvent("chunk", thinkBuffer);
          thinkBuffer = "";
          return;
        }
      }

      if (thinkState === "in_think") {
        const closeIdx = thinkBuffer.indexOf(THINK_CLOSE);
        if (closeIdx !== -1) {
          if (closeIdx > 0 && !hasNativeReasoning) sendEvent("reasoning", thinkBuffer.slice(0, closeIdx));
          thinkState = "answering";
          const rest = thinkBuffer.slice(closeIdx + THINK_CLOSE.length).replace(/^\n+/, "");
          thinkBuffer = "";
          if (rest.length > 0) {
            gotContent = true;
            sendEvent("chunk", rest);
          }
        } else {
          const safeEnd = thinkBuffer.length - THINK_CLOSE.length;
          if (safeEnd > 0) {
            if (!hasNativeReasoning) sendEvent("reasoning", thinkBuffer.slice(0, safeEnd));
            thinkBuffer = thinkBuffer.slice(safeEnd);
          }
        }
      }
    }
    if (event.type === "assistant.message") {
      if (!gotContent && event.data.content) {
        gotContent = true;
        sendEvent("chunk", event.data.content);
      }
    }
    if (event.type === "session.idle" && promptSent) {
      void finish("session.idle");
    }
    if (event.type === "session.error") {
      const msg = (event.data as { message?: string })?.message ?? "Session error";
      console.error(`[agent:${agentSlug}] session.error:`, msg);
      sendEvent("error", msg);
      void finish("session.error");
    }
  });

  try {
    await session.send({ prompt });
    promptSent = true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send message";
    console.error(`[agent:${agentSlug}] send error:`, msg);
    sendEvent("error", msg);
    void finish("send-error");
  }
}
