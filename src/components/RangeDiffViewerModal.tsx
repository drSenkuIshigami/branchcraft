import React, { useState } from 'react';
import {
  GitCompare,
  Terminal,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { RangeDiffResult } from '../types';

interface RangeDiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunRangeDiff: (baseSha: string, oldSha: string, newSha: string) => Promise<RangeDiffResult>;
}

export const RangeDiffViewerModal: React.FC<RangeDiffViewerModalProps> = ({
  isOpen,
  onClose,
  onRunRangeDiff,
}) => {
  const [baseSha, setBaseSha] = useState('');
  const [oldSha, setOldSha] = useState('');
  const [newSha, setNewSha] = useState('');
  const [result, setResult] = useState<RangeDiffResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseSha.trim() || !oldSha.trim() || !newSha.trim()) {
      setError('Base commit, old head, and new head SHAs are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await onRunRangeDiff(baseSha.trim(), oldSha.trim(), newSha.trim());
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Git Range-Diff Inspector
              </h2>
              <p className="text-[11px] text-zinc-500">
                Compare commit series before &amp; after rebase:{' '}
                <code>git range-diff base..old base..new</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* Form and Controls */}
        <form
          onSubmit={handleExecute}
          className="p-6 border-b border-zinc-200 dark:border-zinc-800 space-y-4 shrink-0"
        >
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Common Base SHA
              </label>
              <input
                type="text"
                value={baseSha}
                onChange={(e) => setBaseSha(e.target.value)}
                placeholder="e.g. main or commit SHA"
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Old Head SHA (Pre-rebase)
              </label>
              <input
                type="text"
                value={oldSha}
                onChange={(e) => setOldSha(e.target.value)}
                placeholder="e.g. branch@{1} or commit SHA"
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                New Head SHA (Post-rebase)
              </label>
              <input
                type="text"
                value={newSha}
                onChange={(e) => setNewSha(e.target.value)}
                placeholder="e.g. branch or HEAD"
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <Info className="w-3.5 h-3.5 text-cyan-500" />
              <span>Compares how the patches in a branch changed after rewriting or rebasing.</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Comparing...' : 'Compute Range-Diff'}</span>
            </button>
          </div>
        </form>

        {/* Results View */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {result ? (
            <div className="space-y-4">
              {/* Diff summary badges */}
              <div className="space-y-2">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-xs">
                  Commit Patch Alignments
                </span>
                <div className="space-y-1.5">
                  {result.diff_entries.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg font-mono text-[11px] flex items-center justify-between border ${
                        entry.status === 'matched'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : entry.status === 'modified'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
                            : entry.status === 'added'
                              ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      <span className="truncate pr-2">{entry.summary}</span>
                      <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 shrink-0">
                        {entry.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full range diff output */}
              <div>
                <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[11px] mb-1">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Full Range-Diff Raw Stream</span>
                </div>
                <pre className="p-3.5 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] whitespace-pre-wrap max-h-72 overflow-y-auto border border-zinc-800">
                  {result.output}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-400 italic">
              Specify base and comparing branch heads above and click Compute Range-Diff.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/40 shrink-0">
          <span className="text-[11px] text-zinc-400 font-mono">
            CLI: git range-diff {baseSha || 'base'}..{oldSha || 'old'} {baseSha || 'base'}..
            {newSha || 'new'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
