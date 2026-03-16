"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { useApp } from "@/lib/context";
import {
  AgentRecord,
  createAgent,
  updateAgent,
  deleteAgent,
} from "@/lib/agents-api";
import { AgentForm } from "@/components/AgentForm";

export default function AdminPage() {
  const { agents, refreshAgents } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    refreshAgents()
      .catch(() => setError("Failed to load agents"))
      .finally(() => setLoading(false));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = useCallback(
    async (data: Partial<AgentRecord> & { slug: string; name: string; displayName: string; prompt: string }) => {
      await createAgent(data);
      await refreshAgents();
      setIsCreating(false);
    },
    [refreshAgents],
  );

  const handleUpdate = useCallback(
    async (slug: string, data: Partial<Omit<AgentRecord, "slug">>) => {
      await updateAgent(slug, data);
      await refreshAgents();
      setEditingAgent(null);
    },
    [refreshAgents],
  );

  const handleDelete = useCallback(
    async (slug: string) => {
      if (!window.confirm(`Delete agent "${slug}"? This cannot be undone.`)) return;
      await deleteAgent(slug);
      await refreshAgents();
    },
    [refreshAgents],
  );

  const showForm = isCreating || editingAgent !== null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-display font-bold text-text-primary">
          Manage Agents
        </h1>
        {!showForm && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            New Agent
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Form overlay */}
      {showForm && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {isCreating ? "Create New Agent" : `Edit: ${editingAgent?.displayName}`}
            </h2>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingAgent(null);
              }}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <AgentForm
            agent={editingAgent ?? undefined}
            onSubmit={
              isCreating
                ? (data) => handleCreate(data as Parameters<typeof handleCreate>[0])
                : (data) => handleUpdate(editingAgent!.slug, data)
            }
            onCancel={() => {
              setIsCreating(false);
              setEditingAgent(null);
            }}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center p-12 text-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {/* Agents table */}
      {!loading && !showForm && (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left px-4 py-3 text-text-secondary font-medium">Slug</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">Display Name</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">Next Agent</th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No agents configured yet.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr
                    key={agent.slug}
                    className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-text-primary font-mono text-xs">
                      {agent.slug}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      <div className="flex items-center gap-2">
                        {agent.iconColor && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: agent.iconColor }}
                          />
                        )}
                        {agent.displayName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                      {agent.nextAgent ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingAgent(agent)}
                          className="p-1.5 rounded-md text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(agent.slug)}
                          className="p-1.5 rounded-md text-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
