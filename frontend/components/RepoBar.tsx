"use client";

import { FolderGit2, ChevronRight, Server } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/context";
import { RepoSelectorModal } from "@/components/RepoSelectorModal";

export function RepoBar() {
  const { activeRepo } = useApp();
  const [showSelector, setShowSelector] = useState(false);

  return (
    <>
      <div className="border-b border-border bg-background/80 backdrop-blur-sm h-9 flex-shrink-0 sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center gap-3">
          <FolderGit2 size={14} className="text-muted flex-shrink-0" />

          {activeRepo ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xs text-text-secondary truncate font-mono">
                {activeRepo.fullName}
              </span>
              {activeRepo.provider === "bitbucket-server" && (
                <span className="flex items-center gap-1 text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded-full border border-border">
                  <Server size={10} />
                  Bitbucket
                </span>
              )}
              <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                active
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted flex-1">No repository selected</span>
          )}

          <button
            onClick={() => setShowSelector(true)}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
            title="Change active repository"
          >
            {activeRepo ? "Change" : "Select repo"}
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {showSelector && <RepoSelectorModal onClose={() => setShowSelector(false)} />}
    </>
  );
}
