"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Check, Loader2, X, Download, Search, Trash2, Eye, ChevronLeft } from "lucide-react";

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

interface DocumentMeta {
  filename: string;
  type: "jira" | "confluence";
  size: number;
  downloadedAt: string;
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

  // Documents panel state
  const [view, setView] = useState<"search" | "docs" | "preview">("search");
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewFilename, setPreviewFilename] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

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
        const data = (await res.json()) as DocumentMeta[];
        setDocCount(data.length);
        setDocs(data);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch("/api/backend/atlassian/documents");
      if (res.ok) {
        const data = (await res.json()) as DocumentMeta[];
        setDocs(data);
        setDocCount(data.length);
      }
    } catch { /* ignore */ }
    finally { setDocsLoading(false); }
  }, []);

  const handlePreview = useCallback(async (filename: string) => {
    setPreviewFilename(filename);
    setPreviewLoading(true);
    setView("preview");
    try {
      const res = await fetch(`/api/backend/atlassian/documents/${encodeURIComponent(filename)}/content`);
      if (res.ok) {
        const data = (await res.json()) as { content: string };
        setPreviewContent(data.content);
      } else {
        setPreviewContent("(Failed to load document)");
      }
    } catch {
      setPreviewContent("(Failed to load document)");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleDeleteDoc = useCallback(async (filename: string) => {
    setDeletingFile(filename);
    try {
      const res = await fetch(`/api/backend/atlassian/documents/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.filename !== filename));
        setDocCount((prev) => prev - 1);
        if (view === "preview" && previewFilename === filename) {
          setView("docs");
        }
      }
    } catch { /* ignore */ }
    finally { setDeletingFile(null); }
  }, [view, previewFilename]);

  useEffect(() => {
    fetchDocCount();
  }, [fetchDocCount]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (next) {
      setView("search");
      fetchStatus();
      fetchDocCount();
    }
  }, [disabled, open, fetchStatus, fetchDocCount]);

  // Trigger search explicitly (not auto)
  const handleSearch = useCallback(async () => {
    if (!query.trim() || !status) return;

    const configured = activeService === "jira" ? status.jira : status.confluence;
    if (!configured) return;

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
  }, [query, activeService, status]);

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
          {/* Search view header */}
          {view === "search" && (
            <>
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
            </>
          )}

          {view === "search" && status && !notConfigured && !statusLoading && (
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
                <div className="relative flex gap-1.5">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                      placeholder={`Search ${activeService === "jira" ? "Jira issues" : "Confluence pages"}...`}
                      className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={!query.trim() || searching}
                    className="px-2.5 py-1.5 bg-accent/15 text-accent rounded-lg text-xs font-medium hover:bg-accent/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {searching ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Search size={12} />
                    )}
                  </button>
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
                <div className="px-4 py-2 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted">
                    {docCount} document{docCount !== 1 ? "s" : ""} in context
                  </span>
                  <button
                    type="button"
                    onClick={() => { setView("docs"); fetchDocs(); }}
                    className="text-[11px] text-accent hover:underline"
                  >
                    View documents
                  </button>
                </div>
              )}
            </>
          )}

          {/* Documents list view */}
          {view === "docs" && (
            <>
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView("search")}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm font-medium text-text-primary">Downloaded Documents</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {docsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-text-secondary" />
                  </div>
                )}
                {!docsLoading && docs.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <span className="text-xs text-muted">No documents downloaded yet</span>
                  </div>
                )}
                {!docsLoading && docs.map((doc) => (
                  <div
                    key={doc.filename}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-background transition-colors group"
                  >
                    <FileText size={13} className={doc.type === "jira" ? "text-blue-400" : "text-green-400"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{doc.filename}</p>
                      <p className="text-[10px] text-muted">
                        {doc.type} · {(doc.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePreview(doc.filename)}
                      className="p-1 text-muted hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                      title="Preview"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc.filename)}
                      disabled={deletingFile === doc.filename}
                      className="p-1 text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingFile === doc.filename ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Document preview view */}
          {view === "preview" && (
            <>
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView("docs")}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm font-medium text-text-primary truncate flex-1">{previewFilename}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteDoc(previewFilename)}
                  disabled={deletingFile === previewFilename}
                  className="text-muted hover:text-red-400 transition-colors"
                  title="Delete document"
                >
                  {deletingFile === previewFilename ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-text-secondary" />
                  </div>
                ) : (
                  <pre className="px-4 py-3 text-xs text-text-secondary whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {previewContent}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
