/**
 * File-based document store for downloaded Atlassian content.
 * Documents are plain text files in {WORK_DIR}/context/atlassian/.
 */

import fs from "fs";
import path from "path";
import os from "os";

const MAX_CONTEXT_CHARS = 8000;

function getBaseDir(): string {
  let workDir = process.env.WORK_DIR || path.join(os.homedir(), "work");
  // Expand ~ to home directory (Node.js doesn't do this automatically)
  if (workDir.startsWith("~/")) {
    workDir = path.join(os.homedir(), workDir.slice(2));
  }
  return path.join(workDir, "context", "atlassian");
}

function ensureDir(): void {
  const dir = getBaseDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveDocument(filename: string, content: string): string {
  ensureDir();
  const filePath = path.join(getBaseDir(), filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function readAllDocuments(): string {
  const dir = getBaseDir();
  if (!fs.existsSync(dir)) return "";

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
  if (files.length === 0) return "";

  const parts: string[] = [];
  let totalLength = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    const block = `\n\n--- ${file} ---\n\n${content}`;

    if (totalLength + block.length > MAX_CONTEXT_CHARS) {
      const remaining = MAX_CONTEXT_CHARS - totalLength;
      if (remaining > 100) {
        parts.push(block.substring(0, remaining));
      }
      parts.push("\n\n[... context truncated at 8000 chars]");
      break;
    }

    parts.push(block);
    totalLength += block.length;
  }

  return parts.join("");
}

export interface DocumentMeta {
  filename: string;
  type: "jira" | "confluence";
  size: number;
  downloadedAt: string;
}

export function listDocuments(): DocumentMeta[] {
  const dir = getBaseDir();
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((filename) => {
      const filePath = path.join(dir, filename);
      const stat = fs.statSync(filePath);
      return {
        filename,
        type: filename.startsWith("jira_") ? ("jira" as const) : ("confluence" as const),
        size: stat.size,
        downloadedAt: stat.mtime.toISOString(),
      };
    });
}

export function deleteDocument(filename: string): boolean {
  const dir = getBaseDir();
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function getDocumentPath(filename: string): string {
  return path.join(getBaseDir(), filename);
}
