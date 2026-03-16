"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ActiveRepo,
  FeatureFlags,
  DEFAULT_FEATURE_FLAGS,
  getActiveRepo,
  saveActiveRepo,
  clearActiveRepo,
  getFeatureFlags,
  saveFeatureFlags,
} from "@/lib/storage";
import { clearRepoCache } from "@/lib/repo-cache";
import { clearSpacesCache } from "@/lib/spaces-cache";
import { AgentRecord, fetchAgents } from "@/lib/agents-api";

interface AppContextValue {
  hydrated: boolean;
  activeRepo: ActiveRepo | null;
  featureFlags: FeatureFlags;
  agents: AgentRecord[];
  copilotConfigured: boolean;
  clearAuth: () => void;
  setActiveRepo: (repo: ActiveRepo) => void;
  removeActiveRepo: () => void;
  setFeatureFlags: (flags: FeatureFlags) => void;
  refreshAgents: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeRepo, setActiveRepoState] = useState<ActiveRepo | null>(null);
  const [featureFlags, setFeatureFlagsState] = useState<FeatureFlags>({ ...DEFAULT_FEATURE_FLAGS });
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
    setFeatureFlagsState(getFeatureFlags());
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

  function setFeatureFlags(flags: FeatureFlags) {
    saveFeatureFlags(flags);
    setFeatureFlagsState(flags);
  }

  return (
    <AppContext.Provider
      value={{
        hydrated,
        activeRepo,
        featureFlags,
        agents,
        copilotConfigured,
        clearAuth,
        setActiveRepo,
        removeActiveRepo,
        setFeatureFlags,
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
