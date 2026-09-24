import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, ShieldCheck, X, FileCode, Check, Info } from 'lucide-react';
import type { ResetMode, Theme } from '../types';

interface ResetConfirmModalProps {
  isOpen: boolean;
  targetRef: string;
  targetSubject?: string;
  onClose: () => void;
  onConfirm: (mode: ResetMode) => Promise<void>;
  loading?: boolean;
  theme: Theme;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  targetRef,
  targetSubject,
  onClose,
  onConfirm,
  loading = false,
  theme,
}) => {
  const [selectedMode, setSelectedMode] = useState<ResetMode>('mixed');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    await onConfirm(selectedMode);
  };

  const isHard = selectedMode === 'hard';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden flex flex-col ${
          theme === 'dark'
            ? 'bg-zinc-900 border-zinc-700/80 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isHard
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
              : 'border-zinc-200 dark:border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <RotateCcw className={`w-5 h-5 ${isHard ? 'text-rose-500' : 'text-blue-500'}`} />
            <div>
              <h2 className="font-semibold text-sm">Reset HEAD to Reference</h2>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                Target:{' '}
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{targetRef}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {targetSubject && (
            <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">
                Target Commit Description
              </span>
              <p className="font-mono text-zinc-800 dark:text-zinc-200 break-words line-clamp-2">
                {targetSubject}
              </p>
            </div>
          )}

          {/* Reset Mode Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Select Reset Mode
            </label>

            {/* Mixed Mode (Recommended) */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedMode === 'mixed'
                  ? 'border-blue-500/60 bg-blue-500/5 dark:bg-blue-500/10'
                  : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
              }`}
            >
              <input
                type="radio"
                name="reset-mode"
                value="mixed"
                checked={selectedMode === 'mixed'}
                onChange={() => setSelectedMode('mixed')}
                className="mt-0.5 accent-blue-600"
              />
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    --mixed (Default / Safe)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                    Recommended
                  </span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                  Moves HEAD pointer to target. Unstages changes in the index, but preserves all
                  modified files in your working tree.
                </p>
              </div>
            </label>

            {/* Soft Mode */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedMode === 'soft'
                  ? 'border-blue-500/60 bg-blue-500/5 dark:bg-blue-500/10'
                  : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
              }`}
            >
              <input
                type="radio"
                name="reset-mode"
                value="soft"
                checked={selectedMode === 'soft'}
                onChange={() => setSelectedMode('soft')}
                className="mt-0.5 accent-blue-600"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  --soft (Keep staged)
                </span>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                  Moves HEAD pointer to target. Leaves all file modifications completely staged in
                  your index for immediate re-committing.
                </p>
              </div>
            </label>

            {/* Hard Mode */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedMode === 'hard'
                  ? 'border-rose-500/60 bg-rose-500/5 dark:bg-rose-500/10'
                  : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
              }`}
            >
              <input
                type="radio"
                name="reset-mode"
                value="hard"
                checked={selectedMode === 'hard'}
                onChange={() => setSelectedMode('hard')}
                className="mt-0.5 accent-rose-600"
              />
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    --hard (Destructive)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono">
                    Level 3 Risk
                  </span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                  Completely resets index and working tree. Any uncommitted changes are discarded.
                </p>
              </div>
            </label>
          </div>

          {/* Safety Notice for Hard Reset */}
          {isHard ? (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px]">
                <p className="font-semibold">Automated Safety Backup Active</p>
                <p className="opacity-90">
                  Per Safety Policy Level 3, Git Workbench will automatically create a backup branch
                  (
                  <code className="font-mono text-[10px] bg-rose-100 dark:bg-rose-900 px-1 py-0.2 rounded">
                    backup/pre-reset-&lt;timestamp&gt;
                  </code>
                  ) before executing this reset so previous work is never permanently lost.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 text-[11px]">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Working directory files will be safely preserved.</span>
            </div>
          )}

          {/* Live CLI Command Preview */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider flex items-center gap-1.5">
              <FileCode className="w-3 h-3" />
              <span>Command to Execute</span>
            </span>
            <div className="p-2.5 rounded bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto border border-zinc-800 select-all">
              git reset --{selectedMode} {targetRef}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 ${
                isHard
                  ? 'bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-500/40'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500/40'
              }`}
            >
              {loading ? (
                <span>Resetting HEAD...</span>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Execute git reset --{selectedMode}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
