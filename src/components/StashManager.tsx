import React, { useState, useEffect, useMemo } from 'react';
import {
  Archive,
  Plus,
  Play,
  RotateCcw,
  GitBranch,
  Trash2,
  FileCode,
  Search,
  AlertCircle,
  Clock,
  Layers,
  FilePlus,
  Check,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { StashInfo, StashDetail } from '../types';
import { getStashDetail } from '../ipc';

interface StashManagerProps {
  repoPath: string;
  stashes: StashInfo[];
  selectedStashRef: string | null;
  onSelectStash: (stashRef: string | null) => void;
  onSelectFileForDiff: (filePath: string, stashRef: string) => void;
  activeDiffFile: string | null;
  onOpenCreateStashModal: () => void;
  onApplyStash: (stashRef: string, reinstateIndex: boolean) => Promise<void>;
  onPopStash: (stashRef: string, reinstateIndex: boolean) => Promise<void>;
  onRequestDropStash: (stash: StashInfo) => void;
  onRequestBranchFromStash: (stash: StashInfo) => void;
  onClearStashes: () => Promise<void>;
}

export const StashManager: React.FC<StashManagerProps> = ({
  repoPath,
  stashes,
  selectedStashRef,
  onSelectStash,
  onSelectFileForDiff,
  activeDiffFile,
  onOpenCreateStashModal,
  onApplyStash,
  onPopStash,
  onRequestDropStash,
  onRequestBranchFromStash,
  onClearStashes,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [reinstateIndex, setReinstateIndex] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stashDetail, setStashDetail] = useState<StashDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Auto-select first stash if none is selected
  useEffect(() => {
    if (stashes.length > 0 && (!selectedStashRef || !stashes.some((s) => s.ref === selectedStashRef))) {
      onSelectStash(stashes[0].ref);
    } else if (stashes.length === 0) {
      onSelectStash(null);
      setStashDetail(null);
    }
  }, [stashes, selectedStashRef, onSelectStash]);

  // Fetch detail when selectedStashRef changes
  useEffect(() => {
    if (!repoPath || !selectedStashRef) {
      setStashDetail(null);
      return;
    }

    let isMounted = true;
    setDetailLoading(true);
    setActionError(null);

    getStashDetail(repoPath, selectedStashRef)
      .then((detail) => {
        if (!isMounted) return;
        setStashDetail(detail);
        if (detail.files.length > 0 && (!activeDiffFile || !detail.files.some((f) => f.path === activeDiffFile))) {
          onSelectFileForDiff(detail.files[0].path, selectedStashRef);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setActionError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (isMounted) setDetailLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoPath, selectedStashRef]);

  // Filter stashes by search query
  const filteredStashes = useMemo(() => {
    if (!searchQuery.trim()) return stashes;
    const q = searchQuery.toLowerCase();
    return stashes.filter(
      (s) =>
        s.ref.toLowerCase().includes(q) ||
        s.message.toLowerCase().includes(q) ||
        s.branch.toLowerCase().includes(q) ||
        s.hash.toLowerCase().includes(q)
    );
  }, [stashes, searchQuery]);

  const handleApply = async (stashRef: string) => {
    try {
      setIsActionLoading(`apply-${stashRef}`);
      setActionError(null);
      await onApplyStash(stashRef, reinstateIndex);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionLoading(null);
    }
  };

  const handlePop = async (stashRef: string) => {
    try {
      setIsActionLoading(`pop-${stashRef}`);
      setActionError(null);
      await onPopStash(stashRef, reinstateIndex);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleClear = async () => {
    try {
      setIsActionLoading('clear');
      setActionError(null);
      await onClearStashes();
      setIsConfirmingClear(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionLoading(null);
    }
  };

  return (
    <div className="flex h-full w-full divide-x divide-stone-200 dark:divide-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
      {/* Left Column: Stash List */}
      <div className="w-1/2 flex flex-col h-full bg-stone-50/50 dark:bg-stone-900/50 overflow-hidden">
        {/* Header Toolbar */}
        <div className="p-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
              Git Stashes
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
              {stashes.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {stashes.length > 0 && !isConfirmingClear && (
              <button
                type="button"
                onClick={() => setIsConfirmingClear(true)}
                className="px-2 py-1 text-[11px] font-medium rounded-md text-stone-500 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Clear all stashes from reflog"
              >
                Clear All
              </button>
            )}

            {isConfirmingClear && (
              <div className="flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  Clear all?
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isActionLoading === 'clear'}
                  className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-rose-600 text-white hover:bg-rose-500"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingClear(false)}
                  className="px-1.5 py-0.5 text-[10px] text-stone-500 hover:text-stone-700"
                >
                  No
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenCreateStashModal}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Stash Changes</span>
            </button>
          </div>
        </div>

        {/* Filter bar & Index Toggle */}
        <div className="px-3 py-2 border-b border-stone-200 dark:border-stone-800 flex flex-col gap-2 shrink-0 bg-stone-50/80 dark:bg-stone-900/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter stashes by branch, message, or ref..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-[11px] text-stone-600 dark:text-stone-400">
            <input
              type="checkbox"
              checked={reinstateIndex}
              onChange={(e) => setReinstateIndex(e.target.checked)}
              className="rounded border-stone-300 dark:border-stone-700 text-amber-600 focus:ring-amber-500/30"
            />
            <span>
              Reinstate staged index on Apply / Pop (<code className="font-mono">--index</code>)
            </span>
          </label>
        </div>

        {actionError && (
          <div className="m-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-all">{actionError}</span>
          </div>
        )}

        {/* Stashes List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredStashes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <Archive className="w-8 h-8 text-stone-300 dark:text-stone-700 mb-2" />
              <p className="text-xs font-medium text-stone-600 dark:text-stone-400">
                {searchQuery ? 'No stashes match your search' : 'No stashes currently saved'}
              </p>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 max-w-xs">
                Use &quot;Stash Changes&quot; to tuck away uncommitted work so you can switch branches cleanly.
              </p>
            </div>
          ) : (
            filteredStashes.map((stash) => {
              const isSelected = selectedStashRef === stash.ref;
              const isApplying = isActionLoading === `apply-${stash.ref}`;
              const isPopping = isActionLoading === `pop-${stash.ref}`;

              return (
                <div
                  key={stash.ref}
                  onClick={() => onSelectStash(stash.ref)}
                  className={`group relative p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-xs'
                      : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700/70 hover:border-stone-300 dark:hover:border-stone-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                        {stash.ref}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center gap-1">
                        <GitBranch className="w-2.5 h-2.5" />
                        {stash.branch}
                      </span>
                      <span className="text-[11px] text-stone-400 font-mono">
                        {stash.hash.substring(0, 7)}
                      </span>
                    </div>

                    <span className="text-[10px] text-stone-400 dark:text-stone-500 flex items-center gap-1 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {stash.relative_time}
                    </span>
                  </div>

                  <p className="mt-1.5 text-stone-800 dark:text-stone-200 font-medium line-clamp-2">
                    {stash.message || '(No message)'}
                  </p>

                  {/* Actions Bar */}
                  <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-700/60 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {/* Apply button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(stash.ref);
                        }}
                        disabled={Boolean(isActionLoading)}
                        className="px-2 py-1 text-[11px] font-medium rounded bg-stone-100 dark:bg-stone-700 hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-400 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1 disabled:opacity-50"
                        title="Apply stash changes into working directory, keeping stash entry"
                      >
                        {isApplying ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span>Apply</span>
                      </button>

                      {/* Pop button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePop(stash.ref);
                        }}
                        disabled={Boolean(isActionLoading)}
                        className="px-2 py-1 text-[11px] font-medium rounded bg-stone-100 dark:bg-stone-700 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-400 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1 disabled:opacity-50"
                        title="Apply stash changes and remove from stash list"
                      >
                        {isPopping ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        )}
                        <span>Pop</span>
                      </button>

                      {/* Branch from stash */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestBranchFromStash(stash);
                        }}
                        disabled={Boolean(isActionLoading)}
                        className="px-2 py-1 text-[11px] font-medium rounded bg-stone-100 dark:bg-stone-700 hover:bg-teal-500/15 hover:text-teal-700 dark:hover:text-teal-400 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1"
                        title="Create and switch to a new branch from this stash"
                      >
                        <GitBranch className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                        <span>Branch</span>
                      </button>
                    </div>

                    {/* Drop single stash */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestDropStash(stash);
                      }}
                      disabled={Boolean(isActionLoading)}
                      className="p-1 rounded text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Drop (delete) this stash"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Selected Stash Detail Inspection & File List */}
      <div className="w-1/2 flex flex-col h-full bg-white dark:bg-stone-900 overflow-hidden">
        {detailLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Loading stash content...</span>
          </div>
        ) : !stashDetail ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-stone-400">
            <Layers className="w-8 h-8 mb-2 stroke-1" />
            <p className="text-xs font-medium text-stone-600 dark:text-stone-400">
              Select a stash to inspect
            </p>
            <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 max-w-xs">
              View changed files, additions, deletions, and untracked contents stored in the stash.
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Stash Detail Header */}
            <div className="p-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                    {stashDetail.stash.ref}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                    {stashDetail.stash.branch}
                  </span>
                </div>
                <span className="text-xs font-mono text-stone-400">
                  {stashDetail.stash.hash}
                </span>
              </div>

              <h3 className="mt-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
                {stashDetail.stash.message || '(No message)'}
              </h3>

              {/* Stats pill */}
              <div className="mt-2 flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 font-mono">
                <span>{stashDetail.stats.files_changed} files changed</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{stashDetail.stats.insertions}
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  -{stashDetail.stats.deletions}
                </span>
              </div>
            </div>

            {/* Changed Files in Stash */}
            <div className="p-2 border-b border-stone-200 dark:border-stone-800 bg-stone-100/40 dark:bg-stone-800/40 text-[11px] font-medium text-stone-500 dark:text-stone-400 shrink-0 flex items-center justify-between">
              <span>Modified Files ({stashDetail.files.length})</span>
              <span className="text-[10px] italic">Click a file to view diff</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {stashDetail.files.map((file) => {
                const isActive = activeDiffFile === file.path;
                const isUntracked = file.status === 'Added' && file.deletions === 0;

                return (
                  <button
                    type="button"
                    key={file.path}
                    onClick={() => onSelectFileForDiff(file.path, stashDetail.stash.ref)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                      isActive
                        ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-stone-900 dark:text-stone-100 font-medium'
                        : 'border border-transparent hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      {isUntracked ? (
                        <FilePlus className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      ) : (
                        <FileCode className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      )}
                      <span className="truncate font-mono text-[11px]">{file.path}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                      {isUntracked && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-sans font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300">
                          untracked
                        </span>
                      )}
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{file.additions}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">
                        -{file.deletions}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
