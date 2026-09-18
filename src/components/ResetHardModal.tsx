import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import type { StatusInfo } from '../types';

interface ResetHardModalProps {
  isOpen: boolean;
  status: StatusInfo | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const ResetHardModal: React.FC<ResetHardModalProps> = ({
  isOpen,
  status,
  onClose,
  onConfirm,
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const stagedCount = status?.staged.length ?? 0;
  const unstagedCount = status?.unstaged.length ?? 0;
  const totalTracked = stagedCount + unstagedCount;

  const handleConfirm = async () => {
    try {
      setIsResetting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-hard-title"
    >
      <div className="w-full max-w-md bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="reset-hard-title"
              className="text-sm font-semibold text-stone-900 dark:text-stone-100"
            >
              Reset Working Tree to HEAD
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Discard all staged and unstaged tracked changes (<code className="font-mono">git reset --hard HEAD</code>)
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
              <span>Destructive Action Warning</span>
            </div>
            <p className="text-xs text-rose-600/90 dark:text-rose-300/90 leading-relaxed">
              This will irreversibly discard all uncommitted changes across{' '}
              <span className="font-bold">{totalTracked} tracked file{totalTracked === 1 ? '' : 's'}</span>.
              Any uncommitted edits will be lost unless previously stashed or committed.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 space-y-2 text-xs">
            <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
              <span>Target Commit:</span>
              <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                HEAD ({status?.current_branch || 'detached'})
              </span>
            </div>
            <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
              <span>Changes to discard:</span>
              <span className="text-stone-800 dark:text-stone-200">
                {stagedCount} staged, {unstagedCount} unstaged
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isResetting}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isResetting}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Resetting...</span>
                </>
              ) : (
                <span>Yes, Reset to HEAD</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
