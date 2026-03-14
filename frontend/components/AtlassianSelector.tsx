"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Check, Loader2, X, Download, Search } from "lucide-react";

interface AtlassianStatus {
  jira: boolean;
  confluence: boolean;
}

interface SearchResult {
  id: string;
  key?: string;
  title: string;
  summary: string;
  url: string;
  type: "jira" | "confluence";
}

interface AtlassianSelectorProps {
  disabled?: boolean;
}

export function AtlassianSelector({ disabled }: AtlassianSelectorProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AtlassianStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [activeService, setActiveService] = useState<"jira" | "confluence">("jira");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch status on first open
  const fetchStatus = useCallback(async () => {
    if (status) return;
    setStatusLoading(true);
    try {
      const res = await fetch("/api/backend/atlassian/status");
      if (res.ok) {
        const data = (await res.json()) as AtlassianStatus;
        setStatus(data);
        // Default to first configured service
        if (data.jira) setActiveService("jira");
        else if (data.confluence) setActiveService("confluence");
      }
    } catch {
      setStatus({ jira: false, confluence: false });
    } finally {
      setStatusLoading(false);
    }
  }, [status]);

  // Fetch document count on mount and after downloads
  const fetchDocCount = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/atlassian/documents");
      if (res.ok) {
        const docs = (await res.json()) as unknown[];
        setDocCount(docs.length);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchDocCount();
  }, [fetchDocCount]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (next) {
      fetchStatus();
      fetchDocCount();
    }
  }, [disabled, open, fetchStatus, fetchDocCount]);

  // Debounced search
  useEffect(() => {
    if (!open || !query.trim() || !status) return;

    const configured = activeService === "jira" ? status.jira : status.confluence;
    if (!configured) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/backend/atlassian/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim(), type: activeService }),
        });
        if (res.ok) {
          setResults((await res.json()) as SearchResult[]);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, activeService, open, status]);

  // Reset on service change
  useEffect(() => {
    setQuery("");
    setResults([]);
    setSelected(new Set());
  }, [activeService]);

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDownload = useCallback(async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    try {
      const items = results
        .filter((r) => selected.has(r.id))
        .map((r) => ({ type: r.type, id: r.id, key: r.key, title: r.title }));
      await fetch("/api/backend/atlassian/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      setSelected(new Set());
      fetchDocCount();
    } catch { /* ignore */ } finally {
      setDownloading(false);
    }
  }, [selected, results, fetchDocCount]);

  // Click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notConfigured = status && !status.jira && !status.confluence;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className={`relative w-10 h-full flex items-center justify-center bg-surface-2 border border-border rounded-xl text-text-secondary hover:text-text-primary hover:border-accent transition-colors ${
          disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
        }`}
        title="Jira / Confluence context"
        aria-label="Open Atlassian context selector"
      >
        <FileText size={18} />
        {docCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
            {docCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-80 bg-surface-2 border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Jira / Confluence</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {statusLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-text-secondary" />
            </div>
          )}

          {notConfigured && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted">
                Jira/Confluence not configured. Set JIRA_URL, JIRA_PAT, CONFLUENCE_URL, CONFLUENCE_PAT in backend .env
              </p>
            </div>
          )}

          {status && !notConfigured && !statusLoading && (
            <>
              {/* Service Toggle */}
              <div className="flex gap-1 px-3 pt-2">
                {status.jira && (
                  <button
                    type="button"
                    onClick={() => setActiveService("jira")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      activeService === "jira"
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Jira
                  </button>
                )}
                {status.confluence && (
                  <button
                    type="button"
                    onClick={() => setActiveService("confluence")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      activeService === "confluence"
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Confluence
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="px-3 py-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${activeService === "jira" ? "Jira issues" : "Confluence pages"}...`}
                    className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                  {searching && (
                    <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted" />
                  )}
                </div>
              </div>

              {/* Results */}
              <div className="max-h-[250px] overflow-y-auto">
                {!searching && results.length === 0 && query.trim() && (
                  <div className="px-4 py-4 text-center">
                    <span className="text-xs text-muted">No results for &ldquo;{query}&rdquo;</span>
                  </div>
                )}

                {results.map((item) => {
                  const isSelected = selected.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className="w-full px-4 py-2 hover:bg-background cursor-pointer flex items-start gap-3 transition-colors text-left"
                    >
                      <div
                        className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border mt-0.5 ${
                          isSelected
                            ? "bg-accent border-accent"
                            : "border-border bg-transparent"
                        }`}
                      >
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-text-primary truncate">
                          {item.key ? `${item.key}: ` : ""}{item.title}
                        </div>
                        {item.summary && (
                          <div className="text-[11px] text-muted mt-0.5 line-clamp-2">
                            {item.summary}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Download Button */}
              {selected.size > 0 && (
                <div className="px-3 py-2 border-t border-border">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium bg-accent/15 text-accent rounded-lg hover:bg-accent/25 transition-colors disabled:opacity-50"
                  >
                    {downloading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    {downloading ? "Downloading..." : `Download ${selected.size} selected`}
                  </button>
                </div>
              )}

              {/* Doc count footer */}
              {docCount > 0 && selected.size === 0 && (
                <div className="px-4 py-2 border-t border-border">
                  <span className="text-[11px] text-muted">
                    {docCount} document{docCount !== 1 ? "s" : ""} in context folder
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
