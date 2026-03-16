import { Session } from "./storage";

export function sessionToMarkdown(session: Session, agentName: string): string {
  const date = new Date(session.createdAt).toISOString().slice(0, 10);
  const lines: string[] = [
    `# Session: ${agentName} — ${session.repoFullName}`,
    "",
    `**Date:** ${date}  `,
    `**Agent:** ${agentName}`,
    "",
    "---",
    "",
  ];

  for (const msg of session.messages) {
    const heading = msg.role === "user" ? "## User" : `## ${agentName}`;
    lines.push(heading);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
