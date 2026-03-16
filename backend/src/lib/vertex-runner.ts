/**
 * Vertex AI runner — executes an agent prompt using Google's Gemini models
 * and streams the response back as SSE events matching the Copilot protocol:
 *   chunk (token), reasoning (think block), done, error.
 */

import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { getVertexCredentials } from "./providers.js";

export interface VertexRunOpts {
  model: string;
  systemPrompt: string;
  prompt: string;
}

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

/**
 * Run a prompt against a Vertex AI model and stream SSE events to the client.
 * Callers must have already validated that Vertex credentials are configured.
 */
export async function runWithVertex(
  opts: VertexRunOpts,
  res: Response,
  req: Request,
): Promise<void> {
  const credentials = getVertexCredentials();
  if (!credentials) {
    throw new Error("Vertex AI provider is not configured");
  }

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

  // Open SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let done = false;

  const sendEvent = (type: string, data: string) => {
    if (done) return;
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const finish = (reason = "unknown") => {
    if (done) return;
    done = true;
    console.log(`[agent:vertex] finish() called, reason: ${reason}`);
    sendEvent("done", "");
    res.end();
  };

  req.on("close", () => { finish("req.close"); });

  // Track <think> blocks for reasoning extraction
  let thinkState: "waiting" | "in_think" | "answering" = "waiting";
  let thinkBuffer = "";

  function processChunk(text: string) {
    if (thinkState === "answering") {
      sendEvent("chunk", text);
      return;
    }

    thinkBuffer += text;

    if (thinkState === "waiting") {
      if (thinkBuffer.startsWith(THINK_OPEN)) {
        thinkState = "in_think";
        thinkBuffer = thinkBuffer.slice(THINK_OPEN.length);
      } else if (thinkBuffer.length >= THINK_OPEN.length) {
        thinkState = "answering";
        sendEvent("chunk", thinkBuffer);
        thinkBuffer = "";
        return;
      }
    }

    if (thinkState === "in_think") {
      const closeIdx = thinkBuffer.indexOf(THINK_CLOSE);
      if (closeIdx !== -1) {
        if (closeIdx > 0) sendEvent("reasoning", thinkBuffer.slice(0, closeIdx));
        thinkState = "answering";
        const rest = thinkBuffer.slice(closeIdx + THINK_CLOSE.length).replace(/^\n+/, "");
        thinkBuffer = "";
        if (rest.length > 0) {
          sendEvent("chunk", rest);
        }
      } else {
        // Flush safe portion — keep THINK_CLOSE.length chars buffered
        const safeEnd = thinkBuffer.length - THINK_CLOSE.length;
        if (safeEnd > 0) {
          sendEvent("reasoning", thinkBuffer.slice(0, safeEnd));
          thinkBuffer = thinkBuffer.slice(safeEnd);
        }
      }
    }
  }

  try {
    const stream = await ai.models.generateContentStream({
      model: opts.model,
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      config: { systemInstruction: opts.systemPrompt },
    });

    for await (const chunk of stream) {
      if (done) break;
      const text = chunk.text;
      if (text) {
        processChunk(text);
      }
    }

    // Flush any remaining buffered reasoning
    if (!done && (thinkState as string) === "in_think" && thinkBuffer.length > 0) {
      sendEvent("reasoning", thinkBuffer);
    }

    finish("stream.complete");
  } catch (err: unknown) {
    if (done) return;
    const msg = err instanceof Error ? err.message : "Vertex AI error";
    // Avoid leaking credentials in error messages
    const safeMsg = msg.replace(/private_key[^\s]*/gi, "***").replace(/client_email[^\s]*/gi, "***");
    sendEvent("error", safeMsg);
    finish("stream.error");
  }
}
