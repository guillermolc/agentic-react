"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Cpu, ChevronDown, Loader2, AlertCircle } from "lucide-react";

interface ProviderModels {
  provider: string;
  models: string[];
}

interface ModelSelectorProps {
  onSelectionChange: (provider: string, model: string) => void;
  disabled?: boolean;
}

const SESSION_KEY = "web_spec_selected_model";

const PROVIDER_LABELS: Record<string, string> = {
  copilot: "Copilot",
  vertex: "Vertex AI",
};

function loadSavedSelection(): { provider: string; model: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { provider: string; model: string };
    if (parsed.provider && parsed.model) return parsed;
  } catch { /* ignore */ }
  return null;
}

function saveSelection(provider: string, model: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ provider, model }));
}

export function ModelSelector({ onSelectionChange, disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [providerModels, setProviderModels] = useState<ProviderModels[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Tracks the last (provider::model) key emitted to the parent so we only call
  // onSelectionChange when the actual selection changes, not on every re-render.
  const lastEmittedRef = useRef<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backend/providers/models");
      if (!res.ok) throw new Error(`Failed to load models (${res.status})`);
      const data = (await res.json()) as ProviderModels[];
      setProviderModels(data);

      // Restore saved selection if still valid
      const saved = loadSavedSelection();
      if (saved) {
        const pm = data.find((p) => p.provider === saved.provider);
        if (pm && pm.models.includes(saved.model)) {
          setSelectedProvider(saved.provider);
          setSelectedModel(saved.model);
          return;
        }
      }

      // Auto-select the first model if only one provider
      if (data.length > 0 && data[0].models.length > 0) {
        setSelectedProvider(data[0].provider);
        setSelectedModel(data[0].models[0]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Emit to parent whenever the selection actually changes (deduplicated by value)
  useEffect(() => {
    if (!selectedProvider || !selectedModel) return;
    const key = `${selectedProvider}::${selectedModel}`;
    if (lastEmittedRef.current === key) return;
    lastEmittedRef.current = key;
    onSelectionChange(selectedProvider, selectedModel);
  }, [selectedProvider, selectedModel, onSelectionChange]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(provider: string, model: string) {
    setSelectedProvider(provider);
    setSelectedModel(model);
    saveSelection(provider, model);
    // onSelectionChange is triggered by the useEffect above (deduped via lastEmittedRef)
    setOpen(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted bg-surface-2 border border-border rounded-lg">
        <Loader2 size={12} className="animate-spin" />
        <span>Loading models…</span>
      </div>
    );
  }

  if (error) {
    return (
      <button
        onClick={fetchModels}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
      >
        <AlertCircle size={12} />
        Retry
      </button>
    );
  }

  if (providerModels.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <AlertCircle size={12} />
        No LLM providers configured
      </div>
    );
  }

  const displayLabel = selectedModel
    ? `${selectedModel}`
    : "Select model";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
          selectedModel
            ? "bg-surface-2 border-border text-text-primary hover:border-accent"
            : "bg-amber-500/10 border-amber-500/20 text-amber-400"
        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      >
        <Cpu size={12} />
        <span className="max-w-[140px] truncate">{displayLabel}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 bg-surface-2 border border-border rounded-lg shadow-lg z-50 min-w-[200px] py-1 max-h-[280px] overflow-y-auto">
          {providerModels.map((pm) => (
            <div key={pm.provider}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted font-semibold">
                {PROVIDER_LABELS[pm.provider] ?? pm.provider}
              </div>
              {pm.models.map((m) => {
                const isActive = selectedProvider === pm.provider && selectedModel === m;
                return (
                  <button
                    key={`${pm.provider}-${m}`}
                    onClick={() => handleSelect(pm.provider, m)}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "text-accent bg-accent/10"
                        : "text-text-primary hover:bg-background"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
