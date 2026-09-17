import React, { useState } from 'react';
import { FolderGit2, X, Sparkles, FolderOpen, ArrowRight, AlertCircle } from 'lucide-react';
import type { Theme } from '../types';

interface OpenRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPath: (path: string) => Promise<void>;
  onOpenSample: () => Promise<void>;
  theme: Theme;
}

export const OpenRepoModal: React.FC<OpenRepoModalProps> = ({
  isOpen,
  onClose,
  onOpenPath,
  onOpenSample,
}) => {
  const [inputPath, setInputPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPath.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onOpenPath(inputPath.trim());
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSample = async () => {
    setLoading(true);
    setError(null);
    try {
      await onOpenSample();
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
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Open Git Repository
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-xs leading-relaxed">{error}</span>
            </div>
          )}

          {/* Quick Sandbox option */}
          <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                Interactive Sample Sandbox
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-mono">
                Instant Test
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Loads an isolated demo repository featuring historical branches, merges, tags, and
              working tree changes for testing graph rendering and diffs.
            </p>
            <button
              type="button"
              onClick={handleSample}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-xs"
            >
              <span>{loading ? 'Initializing Sandbox...' : 'Open Sample Sandbox Repository'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-zinc-200 dark:border-zinc-800" />
            <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">
              or local path
            </span>
            <div className="flex-1 h-px bg-zinc-200 dark:border-zinc-800" />
          </div>

          {/* Path Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Repository File Path
              </label>
              <div className="relative">
                <FolderOpen className="w-4 h-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inputPath}
                  onChange={(e) => setInputPath(e.target.value)}
                  placeholder="/path/to/git-repository"
                  className="w-full pl-8 pr-3 py-1.5 rounded-md bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !inputPath.trim()}
                className="px-4 py-1.5 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Validating...' : 'Open Repository'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
