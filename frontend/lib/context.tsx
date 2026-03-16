"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ActiveRepo,
  getActiveRepo,
  saveActiveRepo,
  clearActiveRepo,
} from "@/lib/storage";
import { clearRepoCache } from "@/lib/repo-cache";
import { clearSpacesCache } from "@/lib/spaces-cache";
import { AgentRecord, fetchAgents } from "@/lib/agents-api";

interface AppContextValue {
  hydrated: boolean;
  activeRepo: ActiveRepo | null;
  agents: AgentRecord[];
  copilotConfigured: boolean;
  clearAuth: () => void;
  setActiveRepo: (repo: ActiveRepo) => void;
  removeActiveRepo: () => void;
  refreshAgents: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeRepo, setActiveRepoState] = useState<ActiveRepo | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [copilotConfigured, setCopilotConfigured] = useState(false);

  async function refreshAgents() {
    try {
      const data = await fetchAgents();
      setAgents(data);
    } catch {
      // keep existing list on error
    }
  }

  useEffect(() => {
    setActiveRepoState(getActiveRepo());
    setHydrated(true);
    void refreshAgents();
    // Check if copilot provider is configured
    fetch("/api/backend/providers/models")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { provider: string }[]) => {
        setCopilotConfigured(data.some((p) => p.provider === "copilot"));
      })
      .catch(() => {});
  }, []);

  function clearAuth() {
    clearActiveRepo();
    clearRepoCache();
    clearSpacesCache();
    setActiveRepoState(null);
  }

  function setActiveRepo(repo: ActiveRepo) {
    saveActiveRepo(repo);
    setActiveRepoState(repo);
  }

  function removeActiveRepo() {
    clearActiveRepo();
    setActiveRepoState(null);
  }

  return (
    <AppContext.Provider
      value={{
        hydrated,
        activeRepo,
        agents,
        copilotConfigured,
        clearAuth,
        setActiveRepo,
        removeActiveRepo,
        refreshAgents,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
