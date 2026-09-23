import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderTree,
  X,
  Plus,
  GitBranch,
  Lock,
  Terminal,
  AlertTriangle,
  Info,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';
import type { BranchInfo, OperationResult, Theme } from '../types';
import { addWorktree } from '../ipc';

interface AddWorktreeModalProps {
  isOpen: boolean;
  repoPath: string;
  branches: BranchInfo[];
  existingWorktreePaths: string[];
  existingWorktreeBranches: string[];
  onClose: () => void;
  onSuccess: (result: OperationResult, newPath: string) => void;
  theme: Theme;
}

export const AddWorktreeModal: React.FC<AddWorktreeModalProps> = ({
  isOpen,
  repoPath,
  branches,
  existingWorktreePaths,
  existingWorktreeBranches,
  onClose,
  onSuccess,
  theme: _theme,
}) => {
  const [branchMode, setBranchMode] = useState<'existing' | 'new' | 'detach'>('existing');
  const [targetPath, setTargetPath] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [startPoint, setStartPoint] = useState('HEAD');
  const [commitIsh, setCommitIsh] = useState('');
  const [lockOnCreate, setLockOnCreate] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive repo parent dir and suggested name
  const { parentDir, repoName } = useMemo(() => {
    const parts = repoPath.replace(/\/+$/, '').split('/');
    const rName = parts[parts.length - 1] || 'repo';
    const pDir = parts.slice(0, -1).join('/') || '/';
    return { parentDir: pDir, repoName: rName };
  }, [repoPath]);

  // Filter branches: Git does not allow checking out a branch in a worktree if it's already checked out
  const availableBranches = useMemo(() => {
    return branches.filter((b) => b.is_local);
  }, [branches]);

  // Set initial default target path and branch when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Pick first local branch not currently checked out
      const candidateBranch = availableBranches.find(
        (b) => !existingWorktreeBranches.includes(b.name) && !b.is_head
      );

      if (candidateBranch) {
        setSelectedBranch(candidateBranch.name);
        const slug = candidateBranch.name.replace(/[^a-zA-Z0-9_-]/g, '-');
        setTargetPath(`${parentDir}/${repoName}-${slug}`);
        setBranchMode('existing');
      } else {
        setBranchMode('new');
        setNewBranchName('feature/worktree-task');
        setTargetPath(`${parentDir}/${repoName}-worktree-task`);
      }
    }
  }, [isOpen, parentDir, repoName, availableBranches, existingWorktreeBranches]);

  // Auto-update path suggestion when new branch name changes
  const handleNewBranchChange = (val: string) => {
    setNewBranchName(val);
    const slug = val.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    if (slug) {
      setTargetPath(`${parentDir}/${repoName}-${slug}`);
    }
  };

  const handleExistingBranchChange = (branchName: string) => {
    setSelectedBranch(branchName);
    const slug = branchName.replace(/[^a-zA-Z0-9_-]/g, '-');
    setTargetPath(`${parentDir}/${repoName}-${slug}`);
  };

  const isBranchAlreadyCheckedOut = useMemo(() => {
    if (branchMode === 'existing') {
      return existingWorktreeBranches.includes(selectedBranch);
    }
    return false;
  }, [branchMode, selectedBranch, existingWorktreeBranches]);

  const isPathAlreadyUsed = useMemo(() => {
    const normalized = targetPath.trim().replace(/\/+$/, '');
    return existingWorktreePaths.some(
      (p) => p.trim().replace(/\/+$/, '') === normalized
    );
  }, [targetPath, existingWorktreePaths]);

  // Computed command preview
  const commandPreview = useMemo(() => {
    const parts = ['git', 'worktree', 'add'];
    if (lockOnCreate) {
      parts.push('--lock');
      if (lockReason.trim()) {
        parts.push(`--reason "${lockReason.trim()}"`);
      }
    }
    if (branchMode === 'new' && newBranchName.trim()) {
      parts.push('-b', newBranchName.trim(), targetPath || '<path>');
      if (startPoint.trim() && startPoint.trim() !== 'HEAD') {
        parts.push(startPoint.trim());
      }
    } else if (branchMode === 'detach') {
      parts.push('--detach', targetPath || '<path>', commitIsh.trim() || 'HEAD');
    } else {
      parts.push(targetPath || '<path>', selectedBranch || '<branch>');
    }
    return parts.join(' ');
  }, [branchMode, targetPath, selectedBranch, newBranchName, startPoint, commitIsh, lockOnCreate, lockReason]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPath.trim()) {
      setError('Please specify a valid directory path for the new worktree.');
      return;
    }
    if (isPathAlreadyUsed) {
      setError('The specified directory path is already an active worktree.');
      return;
    }
    if (branchMode === 'existing' && isBranchAlreadyCheckedOut) {
      setError(`Branch '${selectedBranch}' is already checked out in another worktree. Select a different branch or create a new branch.`);
      return;
    }
    if (branchMode === 'new' && !newBranchName.trim()) {
      setError('Please specify a valid name for the new branch.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await addWorktree(repoPath, {
        path: targetPath.trim(),
        branch: branchMode === 'existing' ? selectedBranch : undefined,
        new_branch: branchMode === 'new' ? newBranchName.trim() : undefined,
        commit_ish:
          branchMode === 'detach'
            ? commitIsh.trim() || 'HEAD'
            : branchMode === 'new' && startPoint.trim() !== 'HEAD'
              ? startPoint.trim()
              : undefined,
        lock: lockOnCreate,
        lock_reason: lockOnCreate && lockReason.trim() ? lockReason.trim() : undefined,
      });

      if (!result.success) {
        setError(result.stderr || result.stdout || 'Failed to create worktree');
      } else {
        onSuccess(result, targetPath.trim());
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Add Linked Worktree
              </h2>
              <p className="text-xs text-zinc-500">
                Checkout an isolated working directory sharing this repository's Git history
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 break-words">{error}</div>
            </div>
          )}

          {/* Educational Info Callout */}
          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 text-zinc-600 dark:text-zinc-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-blue-600 dark:text-blue-400">
                Independent Workspace Architecture
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Linked worktrees allow you to work on multiple branches simultaneously without stash overhead or resetting HEAD. All worktrees share the same Git objects and refs.
              </p>
            </div>
          </div>

          {/* Branch Strategy Selector */}
          <div className="space-y-2">
            <label className="block font-medium text-zinc-700 dark:text-zinc-300">
              Branch Checkout Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBranchMode('existing')}
                className={`py-2 px-3 rounded-lg border text-center transition-all cursor-pointer ${
                  branchMode === 'existing'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Existing Branch
              </button>
              <button
                type="button"
                onClick={() => setBranchMode('new')}
                className={`py-2 px-3 rounded-lg border text-center transition-all cursor-pointer ${
                  branchMode === 'new'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                New Branch
              </button>
              <button
                type="button"
                onClick={() => setBranchMode('detach')}
                className={`py-2 px-3 rounded-lg border text-center transition-all cursor-pointer ${
                  branchMode === 'detach'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Detached HEAD
              </button>
            </div>
          </div>

          {/* Mode Form Controls */}
          {branchMode === 'existing' && (
            <div className="space-y-1.5">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                Select Existing Branch
              </label>
              <div className="relative">
                <select
                  value={selectedBranch}
                  onChange={(e) => handleExistingBranchChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                >
                  {availableBranches.map((b) => {
                    const isCheckedOut = existingWorktreeBranches.includes(b.name);
                    return (
                      <option
                        key={b.name}
                        value={b.name}
                        disabled={isCheckedOut}
                      >
                        {b.name} {isCheckedOut ? '(checked out in another worktree)' : b.is_head ? '(active in main)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              {isBranchAlreadyCheckedOut && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Git forbids checking out the same branch across multiple worktrees simultaneously.
                </p>
              )}
            </div>
          )}

          {branchMode === 'new' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                  New Branch Name
                </label>
                <div className="relative">
                  <GitBranch className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => handleNewBranchChange(e.target.value)}
                    placeholder="e.g. feature/canvas-benchmark"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                  Start Point / Base Ref (Optional)
                </label>
                <input
                  type="text"
                  value={startPoint}
                  onChange={(e) => setStartPoint(e.target.value)}
                  placeholder="HEAD or branch/commit"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {branchMode === 'detach' && (
            <div className="space-y-1">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                Commit SHA or Tag to Inspect
              </label>
              <input
                type="text"
                value={commitIsh}
                onChange={(e) => setCommitIsh(e.target.value)}
                placeholder="HEAD or 73a4b92..."
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
              />
            </div>
          )}

          {/* Target Worktree Directory Path */}
          <div className="space-y-1.5">
            <label className="block font-medium text-zinc-700 dark:text-zinc-300">
              Worktree Directory Destination
            </label>
            <div className="relative">
              <FolderOpen className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="/path/to/worktree-folder"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
              />
            </div>
            {isPathAlreadyUsed && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                This path is already registered as an active worktree directory.
              </p>
            )}
          </div>

          {/* Optional Lock Checkbox */}
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300 font-medium">
              <input
                type="checkbox"
                checked={lockOnCreate}
                onChange={(e) => setLockOnCreate(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Lock Worktree immediately (prevents accidental pruning/removal)</span>
            </label>
            {lockOnCreate && (
              <input
                type="text"
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="Optional lock reason (e.g., Long-running benchmark in progress)"
                className="w-full px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>

          {/* Command Preview */}
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
              <Terminal className="w-3 h-3 text-emerald-500" />
              Preview Execution
            </span>
            <div className="p-2.5 rounded bg-zinc-900 text-emerald-400 font-mono text-[11px] break-all select-all">
              {commandPreview}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isPathAlreadyUsed || (branchMode === 'existing' && isBranchAlreadyCheckedOut)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Worktree...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Worktree</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
