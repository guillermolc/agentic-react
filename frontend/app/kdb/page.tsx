"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, ExternalLink, Loader2, AlertCircle, Database, Trash2, Plus } from "lucide-react";
import {
  CopilotSpace,
  getCachedSpaces,
  fetchSpacesWithCache,
} from "@/lib/spaces-cache";
import { useApp } from "@/lib/context";

interface ExternalKdbRow {
  id: string;
  name: string;
  baseUrl: string;
  repoId: string;
  apiKey: string | null;
  description: string | null;
  createdAt: string;
}

export default function KDBPage() {
  const { copilotConfigured } = useApp();
  const [activeTab, setActiveTab] = useState<"spaces" | "external">("external");

  // Switch to spaces tab if copilot becomes configured
  useEffect(() => {
    if (copilotConfigured) setActiveTab("spaces");
  }, [copilotConfigured]);

  // --- Copilot Spaces state ---
  const [spaces, setSpaces] = useState<CopilotSpace[]>([]);
  const [loading, setLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState("");

  // --- External KDBs state ---
  const [externalKdbs, setExternalKdbs] = useState<ExternalKdbRow[]>([]);
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState("");
  const [extFetched, setExtFetched] = useState(false);
  const [formName, setFormName] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formRepoId, setFormRepoId] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    setSlowLoading(false);
    setError("");

    const slowTimer = setTimeout(() => setSlowLoading(true), 5000);

    try {
      const result = await fetchSpacesWithCache();
      setSpaces(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Copilot Spaces");
    } finally {
      clearTimeout(slowTimer);
      setSlowLoading(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getCachedSpaces();
    if (cached) setSpaces(cached);
    loadSpaces();
  }, [loadSpaces]);

  const fetchExternalKdbs = useCallback(async () => {
    setExtLoading(true);
    setExtError("");
    try {
      const res = await fetch("/api/backend/kdb/external");
      if (!res.ok) throw new Error(`Failed to fetch external KDBs (${res.status})`);
      const data = await res.json() as ExternalKdbRow[];
      setExternalKdbs(data);
      setExtFetched(true);
    } catch (err) {
      setExtError(err instanceof Error ? err.message : "Failed to load external KDBs");
    } finally {
      setExtLoading(false);
    }
  }, []);

  // Lazy-fetch external KDBs on first tab activation
  useEffect(() => {
    if (activeTab === "external" && !extFetched) {
      fetchExternalKdbs();
    }
  }, [activeTab, extFetched, fetchExternalKdbs]);

  const deleteExternalKdb = async (id: string) => {
    try {
      const res = await fetch(`/api/backend/kdb/external/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setExternalKdbs((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      setExtError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleAddKdb = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim() || !formBaseUrl.trim() || !formRepoId.trim()) {
      setFormError("Name, Base URL, and Repo ID are required.");
      return;
    }

    setFormSaving(true);
    try {
      const res = await fetch("/api/backend/kdb/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          baseUrl: formBaseUrl.trim(),
          repoId: formRepoId.trim(),
          apiKey: formApiKey.trim() || undefined,
          description: formDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Failed to add KDB");
      }
      const created = await res.json() as ExternalKdbRow;
      setExternalKdbs((prev) => [created, ...prev]);
      setFormName("");
      setFormBaseUrl("");
      setFormRepoId("");
      setFormApiKey("");
      setFormDescription("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add KDB");
    } finally {
      setFormSaving(false);
    }
  };

  const tabClass = (tab: "spaces" | "external") =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? "bg-surface-2 text-text-primary"
        : "text-text-secondary hover:text-text-primary"
    }`;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={22} className="text-accent" />
          <h1 className="text-2xl font-bold text-text-primary">Knowledge Base</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Manage your Copilot Spaces and External KDB connections.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 p-1 bg-surface rounded-xl w-fit border border-border">
        {copilotConfigured && (
          <button className={tabClass("spaces")} onClick={() => setActiveTab("spaces")}>
            Copilot Spaces
          </button>
        )}
        <button className={tabClass("external")} onClick={() => setActiveTab("external")}>
          External KDBs
        </button>
      </div>

      {/* ===== Copilot Spaces tab ===== */}
      {activeTab === "spaces" && (
        <>
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/10 mb-4">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300 flex-1">{error}</p>
              <button
                onClick={loadSpaces}
                className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-2 text-muted py-8">
              <div className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Connecting to Copilot Spaces via MCP…</span>
              </div>
              {slowLoading && (
                <span className="text-xs text-muted">
                  This may take a moment — querying the MCP server…
                </span>
              )}
            </div>
          )}

          {!loading && !error && spaces.length === 0 && (
            <div className="text-center py-16 border border-border rounded-xl bg-surface">
              <BookOpen size={32} className="text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm font-medium">No Copilot Spaces found</p>
              <p className="text-muted text-xs mt-1">
                Create a Space at{" "}
                <a
                  href="https://github.com/copilot/spaces"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  github.com/copilot/spaces
                </a>
              </p>
            </div>
          )}

          {!loading && spaces.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {spaces.map((space) => {
                const key = `${space.owner}/${space.name}`;
                return (
                  <div
                    key={key}
                    className="text-left p-4 rounded-xl border border-border bg-surface"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary text-sm truncate">
                        {space.owner}/{space.name}
                      </p>
                      {space.description && (
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                          {space.description}
                        </p>
                      )}
                    </div>
                    {space.url && (
                      <a
                        href={space.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text-secondary mt-2 transition-colors"
                      >
                        <ExternalLink size={10} />
                        View Space
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== External KDBs tab ===== */}
      {activeTab === "external" && (
        <>
          {extError && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/10 mb-4">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300 flex-1">{extError}</p>
              <button
                onClick={fetchExternalKdbs}
                className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {extLoading && (
            <div className="flex items-center gap-2 text-muted py-8 justify-center">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading external KDBs…</span>
            </div>
          )}

          {!extLoading && extFetched && externalKdbs.length === 0 && (
            <div className="text-center py-12 border border-border rounded-xl bg-surface mb-6">
              <Database size={32} className="text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm font-medium">No external KDBs configured</p>
              <p className="text-muted text-xs mt-1">Add your first KDB connection below.</p>
            </div>
          )}

          {!extLoading && externalKdbs.length > 0 && (
            <div className="space-y-2 mb-6">
              {externalKdbs.map((kdb) => (
                <div
                  key={kdb.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface"
                >
                  <Database size={16} className="text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{kdb.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted">{kdb.baseUrl}</span>
                      <span className="text-muted text-xs">·</span>
                      <span className="text-xs text-text-secondary">repo: {kdb.repoId}</span>
                      <span className="text-muted text-xs">·</span>
                      <span className="text-xs text-muted">{kdb.apiKey ? "••••••" : "—"}</span>
                    </div>
                    {kdb.description && (
                      <p className="text-xs text-text-secondary mt-1">{kdb.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteExternalKdb(kdb.id)}
                    className="text-muted hover:text-red-400 transition-colors p-1 rounded flex-shrink-0"
                    aria-label={`Delete ${kdb.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add KDB form */}
          <div className="border border-border rounded-xl bg-surface p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Plus size={14} className="text-accent" />
              Add External KDB
            </h3>

            {formError && (
              <div className="p-3 rounded-md border border-red-500/20 bg-red-500/10 text-red-400 text-sm mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddKdb} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My KDB"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Base URL *</label>
                  <input
                    type="text"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Repo ID *</label>
                  <input
                    type="text"
                    value={formRepoId}
                    onChange={(e) => setFormRepoId(e.target.value)}
                    placeholder="e.g. mall"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">API Key</label>
                  <input
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <button
                type="submit"
                disabled={formSaving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {formSaving && <Loader2 size={14} className="animate-spin" />}
                Add KDB
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
