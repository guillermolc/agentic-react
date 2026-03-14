import type { AgentRecord } from "@/lib/agents-api";

export interface AgentConfig {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  nextAgent?: string;
  quickPrompt?: string;
}

export interface AgentAction {
  label: string;
  description: string;
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  onClick: () => void;
}

/** Convert a DB AgentRecord to the UI AgentConfig shape */
export function toAgentConfig(r: AgentRecord): AgentConfig {
  return {
    slug: r.slug,
    name: r.name,
    shortName: r.shortName ?? r.name,
    description: r.description ?? "",
    color: r.color ?? "text-gray-400",
    bgColor: r.bgColor ?? "bg-gray-400/10",
    borderColor: r.borderColor ?? "border-gray-400/20",
    iconColor: r.iconColor ?? "#999",
    nextAgent: r.nextAgent ?? undefined,
    quickPrompt: r.quickPrompt ?? undefined,
  };
}

export function getAgent(slug: string, agents: AgentRecord[]): AgentConfig | undefined {
  const record = agents.find((a) => a.slug === slug);
  return record ? toAgentConfig(record) : undefined;
}

export function getNextAgent(slug: string, agents: AgentRecord[]): AgentConfig | undefined {
  const current = getAgent(slug, agents);
  return current?.nextAgent ? getAgent(current.nextAgent, agents) : undefined;
}
