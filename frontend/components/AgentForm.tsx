"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import type { AgentRecord } from "@/lib/agents-api";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

interface AgentFormProps {
  agent?: AgentRecord;
  onSubmit: (data: Partial<AgentRecord> & { slug: string; name: string; displayName: string; prompt: string }) => Promise<void>;
  onCancel: () => void;
}

export function AgentForm({ agent, onSubmit, onCancel }: AgentFormProps) {
  const isEdit = !!agent;

  const [slug, setSlug] = useState(agent?.slug ?? "");
  const [name, setName] = useState(agent?.name ?? "");
  const [displayName, setDisplayName] = useState(agent?.displayName ?? "");
  const [shortName, setShortName] = useState(agent?.shortName ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [tools, setTools] = useState(agent?.tools?.join(", ") ?? "");
  const [prompt, setPrompt] = useState(agent?.prompt ?? "");
  const [color, setColor] = useState(agent?.color ?? "");
  const [bgColor, setBgColor] = useState(agent?.bgColor ?? "");
  const [borderColor, setBorderColor] = useState(agent?.borderColor ?? "");
  const [iconColor, setIconColor] = useState(agent?.iconColor ?? "");
  const [nextAgent, setNextAgent] = useState(agent?.nextAgent ?? "");
  const [quickPrompt, setQuickPrompt] = useState(agent?.quickPrompt ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!slug.trim()) return "Slug is required";
    if (!SLUG_PATTERN.test(slug)) return "Slug must only contain lowercase letters, numbers, and hyphens";
    if (!name.trim()) return "Name is required";
    if (!displayName.trim()) return "Display Name is required";
    if (!prompt.trim()) return "Prompt is required";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        slug,
        name: name.trim(),
        displayName: displayName.trim(),
        shortName: shortName.trim() || null,
        description: description.trim() || null,
        tools: tools.trim() ? tools.split(",").map((t) => t.trim()).filter(Boolean) : [],
        prompt: prompt.trim(),
        color: color.trim() || null,
        bgColor: bgColor.trim() || null,
        borderColor: borderColor.trim() || null,
        iconColor: iconColor.trim() || null,
        nextAgent: nextAgent.trim() || null,
        quickPrompt: quickPrompt.trim() || null,
      } as Parameters<typeof onSubmit>[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "block text-sm text-text-secondary mb-1";

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-5">
      {error && (
        <div className="p-3 rounded-md border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Row 1: slug + name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="slug" className={labelClass}>
            Slug *
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={isEdit}
            placeholder="my-agent"
            className={`${inputClass} ${isEdit ? "opacity-60 cursor-not-allowed" : ""}`}
          />
        </div>
        <div>
          <label htmlFor="name" className={labelClass}>
            Name *
          </label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Row 2: displayName + shortName */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="displayName" className={labelClass}>
            Display Name *
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="shortName" className={labelClass}>
            Short Name
          </label>
          <input
            id="shortName"
            type="text"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Tools */}
      <div>
        <label htmlFor="tools" className={labelClass}>
          Tools (comma-separated)
        </label>
        <input
          id="tools"
          type="text"
          value={tools}
          onChange={(e) => setTools(e.target.value)}
          placeholder="grep, glob, view, bash"
          className={inputClass}
        />
      </div>

      {/* Prompt */}
      <div>
        <label htmlFor="prompt" className={labelClass}>
          System Prompt *
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={12}
          className={`${inputClass} font-mono resize-y`}
        />
      </div>

      {/* UI colors row */}
      <details className="group">
        <summary className="text-sm text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
          UI Theme & Pipeline Settings
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="color" className={labelClass}>Color (Tailwind class)</label>
              <input id="color" type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="text-blue-400" className={inputClass} />
            </div>
            <div>
              <label htmlFor="bgColor" className={labelClass}>Background Color</label>
              <input id="bgColor" type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} placeholder="bg-blue-400/10" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="borderColor" className={labelClass}>Border Color</label>
              <input id="borderColor" type="text" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} placeholder="border-blue-400/20" className={inputClass} />
            </div>
            <div>
              <label htmlFor="iconColor" className={labelClass}>Icon Color (hex)</label>
              <input id="iconColor" type="text" value={iconColor} onChange={(e) => setIconColor(e.target.value)} placeholder="#4dabff" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nextAgent" className={labelClass}>Next Agent (slug)</label>
              <input id="nextAgent" type="text" value={nextAgent} onChange={(e) => setNextAgent(e.target.value)} placeholder="prd" className={inputClass} />
            </div>
            <div>
              <label htmlFor="quickPrompt" className={labelClass}>Quick Prompt</label>
              <input id="quickPrompt" type="text" value={quickPrompt} onChange={(e) => setQuickPrompt(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      </details>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isEdit ? "Save Changes" : "Create Agent"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
