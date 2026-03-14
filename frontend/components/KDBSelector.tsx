"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Database, Check, Loader2, X } from "lucide-react";
import {
  ExternalKdbEntry,
  getCachedKdbs,
  fetchKdbsWithCache,
} from "@/lib/kdb-cache";

interface KDBSelectorProps {
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function KDBSelector({ onSelectionChange, disabled }: KDBSelectorProps) {
  const [open, setOpen] = useState(false);
  const [kdbs, setKdbs] = useState<ExternalKdbEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchKdbs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchKdbsWithCache();
      setKdbs(result);
      setHasFetched(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch KDBs");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (next && !hasFetched) {
      const cached = getCachedKdbs();
      if (cached) {
        setKdbs(cached);
        setHasFetched(true);
      }
      fetchKdbs();
    }
  }, [disabled, open, hasFetched, fetchKdbs]);

  const toggleKdb = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange(Array.from(next));
        return next;
      });
    },
    [onSelectionChange],
  );

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    onSelectionChange([]);
  }, [onSelectionChange]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isEmpty = hasFetched && !loading && !error && kdbs.length === 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className={`relative w-10 h-full flex items-center justify-center bg-surface-2 border border-border rounded-xl text-text-secondary hover:text-text-primary hover:border-accent transition-colors ${
          disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
        } ${isEmpty ? "opacity-50" : ""}`}
        title={isEmpty ? "No external KDBs configured — add them on the /kdb page" : "External KDBs"}
      >
        <Database size={18} />
        {selected.size > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
            {selected.size}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-72 bg-surface-2 border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">External KDBs</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-text-secondary" />
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <span className="text-xs text-red-400">{error}</span>
                <button
                  type="button"
                  onClick={fetchKdbs}
                  className="text-xs text-accent hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && hasFetched && kdbs.length === 0 && (
              <div className="flex items-center justify-center py-8 px-4">
                <span className="text-xs text-muted text-center">
                  No external KDBs configured.{" "}
                  <a href="/kdb" className="text-accent hover:underline">
                    Add them on the /kdb page
                  </a>
                  .
                </span>
              </div>
            )}

            {!loading &&
              !error &&
              kdbs.map((kdb) => {
                const isSelected = selected.has(kdb.id);
                return (
                  <button
                    key={kdb.id}
                    type="button"
                    onClick={() => toggleKdb(kdb.id)}
                    className="w-full px-4 py-2.5 hover:bg-surface-2 cursor-pointer flex items-start gap-3 transition-colors text-left"
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
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {kdb.name}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        repo: {kdb.repoId}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>

          {selected.size > 0 && (
            <div className="px-4 py-2 border-t border-border">
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-accent hover:underline"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
