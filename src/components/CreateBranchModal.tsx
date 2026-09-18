import React, { useState, useEffect } from 'react';
import { GitBranch, X, AlertCircle } from 'lucide-react';
import type { Theme } from '../types';

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  startSha?: string;
  startRefName?: string;
  existingBranches: string[];
  onCreateBranch: (name: string, startSha?: string) => Promise<void>;
  theme: Theme;
}

export const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
  isOpen,
  onClose,
  startSha,
  startRefName,
  existingBranches,
  onCreateBranch,
}) => {
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBranchName('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return 'Branch name cannot be empty';
    if (existingBranches.includes(trimmed)) {
      return `Branch '${trimmed}' already exists`;
    }
    if (
      trimmed.startsWith('-') ||
      trimmed.startsWith('/') ||
      trimmed.endsWith('/') ||
      trimmed.endsWith('.') ||
      trimmed.endsWith('.lock')
    ) {
      return 'Branch name cannot start with "-" or "/" or end with "/", ".", or ".lock"';
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
      trimmed.includes('@{') ||
      trimmed.includes('//')
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

  const validationError = branchName ? validate(branchName) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const vErr = validate(branchName);
    if (vErr) {
      setError(vErr);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onCreateBranch(branchName.trim(), startSha);
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
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-blue-500/5">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm">
            <GitBranch className="w-4 h-4" />
            <span>Create New Branch</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Starting From
            </label>
            <div className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 font-mono text-zinc-700 dark:text-zinc-300 truncate">
              {startSha ? (
                <div className="flex items-center gap-2">
                  <span className="text-blue-500 font-semibold">{startSha.substring(0, 8)}</span>
                  {startRefName && <span className="text-zinc-400 truncate">({startRefName})</span>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-semibold">HEAD</span>
                  {startRefName && <span className="text-zinc-400 truncate">({startRefName})</span>}
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="branch-name-input"
              className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1"
            >
              Branch Name
            </label>
            <input
              id="branch-name-input"
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g. feature/checkout-flow or bugfix/gh-102"
              autoFocus
              className="w-full px-3 py-2 rounded-lg font-mono text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
            {validationError && (
              <div className="flex items-center gap-1.5 text-rose-500 text-[11px] mt-1.5 font-sans">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
            <p className="text-[10px] text-zinc-500 mt-1 font-sans">
              Switch will automatically switch your working tree to this branch upon creation.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2 text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !branchName.trim() || !!validationError}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
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
