import React, { useState } from 'react';
import { RotateCcw, X, GitCommit, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Theme } from '../types';

interface RestoreFileModalProps {
  isOpen: boolean;
  filePath: string | null;
  commitSha: string | null;
  commitSubject?: string | null;
  onClose: () => void;
  onConfirm: (sha: string, filePath: string) => Promise<void>;
  theme: Theme;
}

export const RestoreFileModal: React.FC<RestoreFileModalProps> = ({
  isOpen,
  filePath,
  commitSha,
  commitSubject,
  onClose,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !filePath || !commitSha) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(commitSha, filePath);
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
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
            <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Restore File from Historical Commit</span>
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
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
            Restore this file into your current working tree as it existed at the selected historical commit:
          </p>

          {/* Target File */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80">
            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate font-medium">
              {filePath}
            </span>
          </div>

          {/* Commit details */}
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center gap-2">
              <GitCommit className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                {commitSha.substring(0, 8)}
              </span>
            </div>
            {commitSubject && (
              <p className="text-zinc-600 dark:text-zinc-400 truncate pl-5">
                {commitSubject}
              </p>
            )}
          </div>

          {/* Command Preview */}
          <div className="p-2.5 rounded bg-zinc-950 text-zinc-300 font-mono text-[11px] border border-zinc-800">
            <span className="text-zinc-500 select-none">$ </span>
            git checkout {commitSha.substring(0, 8)} -- {filePath}
          </div>

          {/* Safety Notice */}
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold">Working Tree Overwrite:</span> Any uncommitted changes currently in your working copy of this file will be replaced with the contents from commit{' '}
              <span className="font-mono">{commitSha.substring(0, 8)}</span>.
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px]">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{loading ? 'Restoring File...' : 'Restore File'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
