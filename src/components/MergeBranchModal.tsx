import React, { useState } from 'react';
import {
  GitMerge,
  ShieldAlert,
  Info,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type {
  BranchInfo,
  MergeStrategyType,
  MergeExecutionOptions,
  OperationResult,
} from '../types';

interface MergeBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranch: string;
  branches: BranchInfo[];
  onExecuteMerge: (options: MergeExecutionOptions) => Promise<OperationResult>;
}

export const MergeBranchModal: React.FC<MergeBranchModalProps> = ({
  isOpen,
  onClose,
  currentBranch,
  branches,
  onExecuteMerge,
}) => {
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [strategy, setStrategy] = useState<MergeStrategyType | 'default'>('default');
  const [customMessage, setCustomMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter out current branch from target candidates
  const candidateBranches = branches.filter((b) => b.name !== currentBranch);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) {
      setError('Please select a branch to merge');
      return;
    }

    setIsRunning(true);
    setError(null);
    try {
      const options: MergeExecutionOptions = {
        branchName: selectedBranch,
        strategy: strategy === 'default' ? undefined : strategy,
        message: customMessage.trim() || undefined,
      };
      await onExecuteMerge(options);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Merge Branch with Strategy Controls
              </h2>
              <p className="text-[11px] text-zinc-500">
                Merge into current HEAD{' '}
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {currentBranch}
                </span>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Branch Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Select Branch to Merge into {currentBranch}
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            >
              <option value="" disabled>
                -- Choose a branch --
              </option>
              {candidateBranches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.tip_sha ? b.tip_sha.slice(0, 7) : 'tip'})
                </option>
              ))}
            </select>
          </div>

          {/* Strict Strategy Differentiation */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              Merge Strategy &amp; Conflict Behavior
            </label>

            <div className="grid grid-cols-1 gap-2">
              {/* Default */}
              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  strategy === 'default'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="default"
                  checked={strategy === 'default'}
                  onChange={() => setStrategy('default')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Standard 3-Way Merge (Default)
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    <code>git merge &lt;branch&gt;</code> — merges histories cleanly. If conflicts
                    occur, Git pauses and lets you resolve them interactively.
                  </div>
                </div>
              </label>

              {/* -X ours */}
              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  strategy === 'recursive-ours'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="recursive-ours"
                  checked={strategy === 'recursive-ours'}
                  onChange={() => setStrategy('recursive-ours')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>
                      Recursive Strategy Option: Ours (<code>-X ours</code>)
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Merges both trees normally. Non-conflicting changes from incoming branch ARE
                    integrated, but if conflicting hunks occur, your version is automatically chosen
                    without pausing.
                  </div>
                </div>
              </label>

              {/* -X theirs */}
              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  strategy === 'recursive-theirs'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="recursive-theirs"
                  checked={strategy === 'recursive-theirs'}
                  onChange={() => setStrategy('recursive-theirs')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>
                      Recursive Strategy Option: Theirs (<code>-X theirs</code>)
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Merges both trees normally. If conflicting hunks occur, incoming branch versions
                    are automatically favored without pausing.
                  </div>
                </div>
              </label>

              {/* -s ours */}
              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  strategy === 'strategy-ours'
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="strategy-ours"
                  checked={strategy === 'strategy-ours'}
                  onChange={() => setStrategy('strategy-ours')}
                  className="mt-1 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      Full Ours Strategy (<code>-s ours</code>)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono">
                      Discard Tree
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    <strong>Critical distinction from -X ours:</strong> <code>-s ours</code> records
                    a merge commit joining the history, but{' '}
                    <em>completely ignores and drops ALL changes</em> from the incoming branch. The
                    working tree remains 100% identical to current HEAD.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Optional Message */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Custom Merge Commit Message (Optional)
            </label>
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={
                selectedBranch
                  ? `Merge branch '${selectedBranch}' into ${currentBranch}`
                  : 'Default merge message'
              }
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRunning || !selectedBranch}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <GitMerge className="w-4 h-4" />
              <span>{isRunning ? 'Merging...' : 'Execute Merge'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
