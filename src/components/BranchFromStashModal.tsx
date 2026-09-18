import React, { useState } from 'react';
import { GitBranch, AlertCircle, Loader2 } from 'lucide-react';
import type { BranchInfo, StashInfo } from '../types';

interface BranchFromStashModalProps {
  isOpen: boolean;
  stash: StashInfo | null;
  existingBranches: BranchInfo[];
  onClose: () => void;
  onConfirm: (branchName: string, stashRef: string) => Promise<void>;
}

export const BranchFromStashModal: React.FC<BranchFromStashModalProps> = ({
  isOpen,
  stash,
  existingBranches,
  onClose,
  onConfirm,
}) => {
  const [branchName, setBranchName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !stash) return null;

  const validate = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return 'Branch name cannot be empty';
    if (existingBranches.some((b) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      return `Branch '${trimmed}' already exists`;
    }
    if (trimmed.startsWith('/') || trimmed.endsWith('/')) {
      return 'Branch name cannot start or end with a slash';
    }
    if (trimmed.endsWith('.')) {
      return 'Branch name cannot end with a period';
    }
    if (
      trimmed.includes('..') ||
      trimmed.includes('~') ||
      trimmed.includes('^') ||
      trimmed.includes(':') ||
      trimmed.includes('?') ||
      trimmed.includes('*') ||
      trimmed.includes('[') ||
      trimmed.includes('\\') ||
      trimmed.includes('@{')
    ) {
      return 'Branch name contains forbidden characters (~, ^, :, ?, *, [, \\, .., @{)';
    }
    if (
      /\s/.test(trimmed) ||
      Array.from(trimmed).some((c) => {
        const code = c.charCodeAt(0);
        return code < 32 || code === 127;
      })
    ) {
      return 'Branch name cannot contain whitespace or control characters';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate(branchName);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(branchName.trim(), stash.ref);
      setBranchName('');
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
      aria-labelledby="branch-stash-title"
    >
      <div className="w-full max-w-md bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="branch-stash-title"
              className="text-sm font-semibold text-stone-900 dark:text-stone-100"
            >
              New Branch from Stash
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Create and check out a new branch starting at stash base commit
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

          <div className="p-3 rounded-lg bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 text-xs space-y-1">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
              <span>Source Stash:</span>
              <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                {stash.ref} ({stash.hash.substring(0, 7)})
              </span>
            </div>
            <p className="text-stone-700 dark:text-stone-300 font-medium truncate">
              {stash.message || '(No message)'}
            </p>
          </div>

          <div>
            <label
              htmlFor="branch-from-stash-name"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
            >
              New Branch Name
            </label>
            <input
              id="branch-from-stash-name"
              type="text"
              value={branchName}
              onChange={(e) => {
                setBranchName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. feature/restored-experiment"
              disabled={isSubmitting}
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
            />
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
              disabled={isSubmitting || !branchName.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Branch...</span>
                </>
              ) : (
                <span>Create & Switch</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
