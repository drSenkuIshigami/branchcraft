import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { Theme } from '../types';

interface DiscardConfirmModalProps {
  isOpen: boolean;
  filePath: string | null;
  isUntracked: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  theme: Theme;
}

export const DiscardConfirmModal: React.FC<DiscardConfirmModalProps> = ({
  isOpen,
  filePath,
  isUntracked,
  onClose,
  onConfirm,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen || !filePath) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
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
            <AlertTriangle className="w-4 h-4" />
            <span>Discard Changes</span>
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
            Are you sure you want to discard changes in this file?
          </p>

          <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-zinc-800 dark:text-zinc-200 truncate">
            {filePath}
          </div>

          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
            {isUntracked
              ? 'This is an untracked file. Discarding will permanently delete it from your disk.'
              : 'This action cannot be undone. All uncommitted modifications will be permanently reverted to HEAD.'}
          </div>

          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium transition-colors shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Discarding...' : 'Discard Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
