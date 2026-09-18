import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Theme } from '../types';

interface DeleteBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName: string;
  isHead: boolean;
  onDeleteBranch: (name: string, force: boolean) => Promise<void>;
  theme: Theme;
}

export const DeleteBranchModal: React.FC<DeleteBranchModalProps> = ({
  isOpen,
  onClose,
  branchName,
  isHead,
  onDeleteBranch,
}) => {
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isHead) return;
    setLoading(true);
    setError(null);
    try {
      await onDeleteBranch(branchName, force);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-rose-500/5">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
            <Trash2 className="w-4 h-4" />
            <span>Delete Branch</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {isHead ? (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Cannot Delete Active Branch</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Branch <code className="font-mono font-bold">{branchName}</code> is currently
                checked out as HEAD. You must switch to another branch before deleting it.
              </p>
            </div>
          ) : (
            <>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Are you sure you want to delete the local branch{' '}
                <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {branchName}
                </code>
                ?
              </p>

              <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Safe Deletion Policy (git branch -d)</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  By default, Git verifies that all commits on this branch have been merged into
                  upstream or HEAD. If unmerged commits exist, the deletion will be safely aborted.
                </p>
              </div>

              {/* Force deletion toggle */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
                />
                <div className="text-[11px]">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    Force delete unmerged commits (-D)
                  </span>
                  <p className="text-zinc-500 text-[10px]">
                    Caution: Any commits unique to this branch will be pruned and may be lost.
                  </p>
                </div>
              </label>
            </>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2 text-[11px]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-all">{error}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors font-medium"
            >
              {isHead ? 'Close' : 'Cancel'}
            </button>
            {!isHead && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{force ? 'Force Delete (-D)' : 'Delete Branch (-d)'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
