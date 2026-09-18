import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import type { StashInfo } from '../types';

interface DropStashModalProps {
  isOpen: boolean;
  stash: StashInfo | null;
  onClose: () => void;
  onConfirm: (stashRef: string) => Promise<void>;
}

export const DropStashModal: React.FC<DropStashModalProps> = ({
  isOpen,
  stash,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !stash) return null;

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm(stash.ref);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drop-stash-title"
    >
      <div className="w-full max-w-md bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="drop-stash-title"
              className="text-sm font-semibold text-stone-900 dark:text-stone-100"
            >
              Drop Stash Entry
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Permanently discard stashed changes
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 space-y-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>This operation cannot be easily undone</span>
            </div>
            <p className="text-xs text-rose-600/90 dark:text-rose-300/90 leading-relaxed">
              Dropping <span className="font-mono font-bold">{stash.ref}</span> removes these
              stashed changes permanently from Git reflog history.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-500 dark:text-stone-400">Stash Reference:</span>
              <span className="font-mono font-semibold text-stone-800 dark:text-stone-200">
                {stash.ref}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 dark:text-stone-400">Created:</span>
              <span className="text-stone-700 dark:text-stone-300">{stash.relative_time}</span>
            </div>
            <div className="pt-1 border-t border-stone-200 dark:border-stone-700/60">
              <span className="text-stone-500 dark:text-stone-400 block mb-0.5">Message:</span>
              <span className="text-stone-800 dark:text-stone-200 font-medium break-all">
                {stash.message || '(No message)'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dropping...</span>
                </>
              ) : (
                <span>Drop Stash</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
