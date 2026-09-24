import React, { useState } from 'react';
import { Archive, AlertCircle, Loader2 } from 'lucide-react';
import type { StatusInfo } from '../types';

interface CreateStashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message: string, includeUntracked: boolean, keepIndex: boolean) => Promise<void>;
  status: StatusInfo | null;
}

export const CreateStashModal: React.FC<CreateStashModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  status,
}) => {
  const [message, setMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [keepIndex, setKeepIndex] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const stagedCount = status?.staged.length ?? 0;
  const unstagedCount = status?.unstaged.length ?? 0;
  const untrackedCount = status?.untracked.length ?? 0;
  const totalCount = stagedCount + unstagedCount + (includeUntracked ? untrackedCount : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCount === 0) {
      setError('No changes detected in working tree to stash.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(message.trim(), includeUntracked, keepIndex);
      setMessage('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-stash-title"
    >
      <div className="w-full max-w-md bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="create-stash-title"
              className="text-sm font-semibold text-stone-900 dark:text-stone-100"
            >
              Stash Working Tree Changes
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Temporarily save uncommitted changes and revert to clean HEAD
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Pending Changes Summary */}
          <div className="p-3 rounded-lg bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-stone-700 dark:text-stone-300">
                Pending Changes to Stash:
              </span>
              <span className="font-mono text-stone-500 dark:text-stone-400">
                {totalCount} file{totalCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {stagedCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium">
                  {stagedCount} staged
                </span>
              )}
              {unstagedCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium">
                  {unstagedCount} modified
                </span>
              )}
              {untrackedCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-medium">
                  {untrackedCount} untracked
                </span>
              )}
              {stagedCount === 0 && unstagedCount === 0 && untrackedCount === 0 && (
                <span className="text-stone-400 italic">Working directory is clean</span>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="stash-message-input"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
            >
              Stash Message (optional)
            </label>
            <input
              id="stash-message-input"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. WIP: before switching to feature branch"
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700 dark:text-stone-300">
              <input
                type="checkbox"
                checked={includeUntracked}
                onChange={(e) => setIncludeUntracked(e.target.checked)}
                disabled={isSubmitting}
                className="rounded border-stone-300 dark:border-stone-700 text-amber-600 focus:ring-amber-500/30"
              />
              <span>
                Include untracked files (<code className="text-[11px] font-mono">-u</code>)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700 dark:text-stone-300">
              <input
                type="checkbox"
                checked={keepIndex}
                onChange={(e) => setKeepIndex(e.target.checked)}
                disabled={isSubmitting}
                className="rounded border-stone-300 dark:border-stone-700 text-amber-600 focus:ring-amber-500/30"
              />
              <span>
                Keep staged index intact (
                <code className="text-[11px] font-mono">--keep-index</code>)
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || totalCount === 0}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Stashing...</span>
                </>
              ) : (
                <span>Stash Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
