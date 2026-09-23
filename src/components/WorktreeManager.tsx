import React, { useState, useMemo } from 'react';
import {
  FolderTree,
  Plus,
  Trash2,
  Lock,
  Unlock,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Info,
  GitBranch,
  HardDrive,
  ArrowRight,
  FolderOpen,
  Search,
  Layers,
  Scissors,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { WorktreeInfo, Theme, OperationResult } from '../types';
import { lockWorktree, unlockWorktree, removeWorktree, pruneWorktrees, openSystemLocation } from '../ipc';

interface WorktreeManagerProps {
  currentRepoPath: string;
  worktrees: WorktreeInfo[];
  loading: boolean;
  onRefresh: () => void;
  onOpenAddModal: () => void;
  onSwitchRepo: (newPath: string) => void;
  onCommandExecuted: (result: OperationResult) => void;
  theme: Theme;
}

export const WorktreeManager: React.FC<WorktreeManagerProps> = ({
  currentRepoPath,
  worktrees,
  loading,
  onRefresh,
  onOpenAddModal,
  onSwitchRepo,
  onCommandExecuted,
  theme: _theme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Modals state
  const [lockingWorktree, setLockingWorktree] = useState<WorktreeInfo | null>(null);
  const [lockReasonInput, setLockReasonInput] = useState('');
  const [removingWorktree, setRemovingWorktree] = useState<WorktreeInfo | null>(null);
  const [forceRemove, setForceRemove] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleOpenSystem = async (path: string) => {
    try {
      await openSystemLocation(path, 'file_manager');
    } catch {
      // Ignore system location error in sandbox
    }
  };

  const filteredWorktrees = useMemo(() => {
    if (!searchQuery.trim()) return worktrees;
    const q = searchQuery.toLowerCase().trim();
    return worktrees.filter(
      (wt) =>
        wt.path.toLowerCase().includes(q) ||
        (wt.branch && wt.branch.toLowerCase().includes(q)) ||
        wt.head.toLowerCase().includes(q) ||
        (wt.lock_reason && wt.lock_reason.toLowerCase().includes(q))
    );
  }, [worktrees, searchQuery]);

  const handleConfirmLock = async () => {
    if (!lockingWorktree) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await lockWorktree(currentRepoPath, lockingWorktree.path, lockReasonInput.trim() || undefined);
      onCommandExecuted(res);
      setLockingWorktree(null);
      setLockReasonInput('');
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(`Failed to lock worktree: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmUnlock = async (wt: WorktreeInfo) => {
    setActionLoading(true);
    try {
      const res = await unlockWorktree(currentRepoPath, wt.path);
      onCommandExecuted(res);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(`Failed to unlock worktree: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removingWorktree) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await removeWorktree(currentRepoPath, removingWorktree.path, forceRemove);
      onCommandExecuted(res);
      setRemovingWorktree(null);
      setForceRemove(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(`Failed to remove worktree: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrune = async () => {
    setActionLoading(true);
    try {
      const res = await pruneWorktrees(currentRepoPath);
      onCommandExecuted(res);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(`Prune failed: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/30">
      {/* Top Header & Toolbar */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Git Worktrees
              </h1>
              <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                {worktrees.length} active
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Manage parallel working trees attached to this shared Git repository
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter worktrees or branches..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={handlePrune}
            disabled={actionLoading || loading}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Prune stale worktree references whose directories were deleted"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prune Stale</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            title="Refresh worktrees"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Worktree</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {actionError && (
        <div className="p-3 mx-4 mt-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Worktrees Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredWorktrees.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
            <FolderTree className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mb-2" />
            <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              No Worktrees Found
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4">
              {searchQuery
                ? `No worktree matches query "${searchQuery}"`
                : 'Worktrees allow you to have multiple branches checked out at the same time in separate folders.'}
            </p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create your first linked worktree
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWorktrees.map((wt, idx) => {
              const isActiveInWorkbench =
                wt.path.replace(/\/+$/, '') === currentRepoPath.replace(/\/+$/, '');

              return (
                <div
                  key={wt.path}
                  className={`rounded-xl border transition-all p-4 ${
                    isActiveInWorkbench
                      ? 'border-blue-500/50 bg-blue-500/5 dark:bg-blue-500/10 ring-1 ring-blue-500/30'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Metadata */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {wt.is_main ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <HardDrive className="w-3 h-3" />
                            Main Repository
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <FolderTree className="w-3 h-3" />
                            Linked Worktree #{idx}
                          </span>
                        )}

                        {isActiveInWorkbench && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
                            <ShieldCheck className="w-3 h-3 text-emerald-400 dark:text-emerald-600" />
                            Active Workbench Target
                          </span>
                        )}

                        {/* Branch badge */}
                        {wt.branch ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                            <GitBranch className="w-3 h-3 text-emerald-500" />
                            {wt.branch}
                          </span>
                        ) : wt.is_detached ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            Detached HEAD
                          </span>
                        ) : null}

                        {/* Commit SHA */}
                        <span className="font-mono text-[11px] text-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/70 px-1.5 py-0.5 rounded">
                          {wt.short_head}
                        </span>

                        {/* Locked Indicator */}
                        {wt.is_locked && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            title={wt.lock_reason ? `Locked: ${wt.lock_reason}` : 'Worktree is locked'}
                          >
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span>Locked</span>
                            {wt.lock_reason && (
                              <span className="max-w-[140px] truncate opacity-75">
                                ({wt.lock_reason})
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Directory Path */}
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 font-mono break-all">
                        <FolderOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>{wt.path}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyPath(wt.path)}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Copy path"
                        >
                          {copiedPath === wt.path ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSystem(wt.path)}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Reveal in filesystem"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!isActiveInWorkbench && (
                        <button
                          type="button"
                          onClick={() => onSwitchRepo(wt.path)}
                          className="px-3 py-1.5 rounded-lg border border-blue-500/30 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          title="Open this worktree directly in Git Workbench"
                        >
                          <span>Open in Workbench</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {!wt.is_main && (
                        <>
                          {/* Lock / Unlock Toggle */}
                          {wt.is_locked ? (
                            <button
                              type="button"
                              onClick={() => handleConfirmUnlock(wt)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs transition-colors cursor-pointer"
                              title="Unlock worktree (allows deletion and prune)"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setLockingWorktree(wt);
                                setLockReasonInput('');
                              }}
                              disabled={actionLoading}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 text-xs transition-colors cursor-pointer"
                              title="Lock worktree to prevent accidental removal or prune"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete / Remove Worktree */}
                          <button
                            type="button"
                            onClick={() => {
                              setRemovingWorktree(wt);
                              setForceRemove(false);
                            }}
                            disabled={actionLoading || wt.is_locked}
                            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              wt.is_locked
                                ? 'border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                                : 'border-rose-200 dark:border-rose-900/40 hover:bg-rose-500/10 text-rose-500 hover:text-rose-600'
                            }`}
                            title={wt.is_locked ? 'Unlock worktree first before removing' : 'Remove linked worktree'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Informative Guidance Card */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-2.5">
          <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-semibold">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Why Use Git Worktrees?</span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
            Git worktrees allow a single Git repository to have multiple checkouts at different directory paths simultaneously.
            Each worktree has its own isolated index, working tree, and HEAD branch, but shares all commits, trees, blobs, tags, and remotes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Zero Stash Switching
              </span>
              <span className="text-zinc-500">
                Fix production bugs on `main` without interrupting your unfinished work or dealing with stash conflicts.
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Concurrent Builds
              </span>
              <span className="text-zinc-500">
                Run long test suites or build processes in a separate folder while continuing your normal coding flow.
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Disk Space Efficient
              </span>
              <span className="text-zinc-500">
                Only the working files are cloned on disk; all Git history is reused from the parent `.git` object store.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Lock Worktree Modal */}
      {lockingWorktree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Lock Worktree</h3>
                <p className="text-xs text-zinc-500">
                  Prevent accidental pruning or automatic cleanup
                </p>
              </div>
            </div>

            <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono bg-zinc-50 dark:bg-zinc-800 p-2.5 rounded-lg break-all">
              {lockingWorktree.path}
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                Lock Reason (Optional)
              </label>
              <input
                type="text"
                value={lockReasonInput}
                onChange={(e) => setLockReasonInput(e.target.value)}
                placeholder="e.g., Persistent docker-compose container mapped here"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setLockingWorktree(null)}
                disabled={actionLoading}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLock}
                disabled={actionLoading}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Worktree</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Worktree Confirmation Modal */}
      {removingWorktree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Remove Linked Worktree</h3>
                <p className="text-xs text-zinc-500">
                  Delete linked worktree directory and administrative metadata
                </p>
              </div>
            </div>

            <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono bg-zinc-50 dark:bg-zinc-800 p-2.5 rounded-lg break-all">
              {removingWorktree.path}
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Removing this worktree will remove the checked-out files from disk. The branch{' '}
                <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                  {removingWorktree.branch || 'HEAD'}
                </span>{' '}
                and commit history will NOT be deleted.
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700 dark:text-zinc-300 font-medium">
              <input
                type="checkbox"
                checked={forceRemove}
                onChange={(e) => setForceRemove(e.target.checked)}
                className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
              />
              <span>Force removal (`--force`) even if there are uncommitted modifications</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setRemovingWorktree(null)}
                disabled={actionLoading}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={actionLoading}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Worktree</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
