import React from 'react';
import {
  Layers,
  AlertTriangle,
  Play,
  SkipForward,
  XCircle,
  CheckCircle2,
  GitCommit,
  ArrowRight,
} from 'lucide-react';
import type { RebaseStatus, Theme } from '../types';

interface ActiveRebasePanelProps {
  rebaseStatus: RebaseStatus;
  hasConflicts: boolean;
  theme: Theme;
  onContinue: () => void;
  onSkip: () => void;
  onAbort: () => void;
}

export const ActiveRebasePanel: React.FC<ActiveRebasePanelProps> = ({
  rebaseStatus,
  hasConflicts,
  theme,
  onContinue,
  onSkip,
  onAbort,
}) => {
  if (!rebaseStatus.in_progress) return null;

  const total = rebaseStatus.total_steps || (rebaseStatus.done_steps?.length || 0) + (rebaseStatus.todo_steps?.length || 0) + 1;
  const doneCount = rebaseStatus.done_steps?.length || 0;
  const currentStepNum = doneCount + 1;
  const progressPercent = Math.min(100, Math.round((doneCount / Math.max(1, total)) * 100));

  return (
    <div
      id="active-rebase-panel"
      className={`p-3.5 rounded-lg border mb-3 transition-all ${
        theme === 'dark'
          ? 'bg-amber-950/20 border-amber-800/80 text-amber-100'
          : 'bg-amber-50/80 border-amber-300 text-amber-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Interactive Rebase In Progress
              </span>
              {rebaseStatus.head_name && (
                <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  {rebaseStatus.head_name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400/90 mt-0.5">
              Step {currentStepNum} of {total}: Stopped at commit{' '}
              <span className="font-mono font-semibold">
                {rebaseStatus.current_commit ? rebaseStatus.current_commit.slice(0, 7) : 'paused'}
              </span>
              {hasConflicts ? ' (conflicts must be resolved)' : ' (ready to continue or amend)'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="rebase-continue-button"
            onClick={onContinue}
            disabled={hasConflicts}
            title={hasConflicts ? 'Resolve all conflicts first before continuing' : 'Continue rebase'}
            className="px-2.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1 shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Continue</span>
          </button>
          <button
            id="rebase-skip-button"
            onClick={onSkip}
            title="Skip this commit and proceed to next"
            className="px-2.5 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <SkipForward className="w-3 h-3" />
            <span>Skip</span>
          </button>
          <button
            id="rebase-abort-button"
            onClick={onAbort}
            title="Abort rebase and restore original branch state"
            className="px-2.5 py-1.5 rounded-md bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <XCircle className="w-3 h-3" />
            <span>Abort</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-amber-200/50 dark:bg-amber-900/40 rounded-full h-1.5 overflow-hidden mb-2">
        <div
          className="bg-amber-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Sequence Details */}
      {((rebaseStatus.done_steps && rebaseStatus.done_steps.length > 0) ||
        (rebaseStatus.todo_steps && rebaseStatus.todo_steps.length > 0)) && (
        <div className="mt-2 text-[11px] font-mono space-y-1 max-h-24 overflow-y-auto pr-1">
          {rebaseStatus.done_steps?.slice(-2).map((s, idx) => (
            <div key={`done-${idx}`} className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{s}</span>
            </div>
          ))}
          {rebaseStatus.current_commit && (
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200 font-semibold bg-amber-100/50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
              <ArrowRight className="w-3 h-3 shrink-0 text-amber-500" />
              <span className="truncate">
                CURRENT: {rebaseStatus.current_commit.slice(0, 7)}
              </span>
            </div>
          )}
          {rebaseStatus.todo_steps?.slice(0, 2).map((s, idx) => (
            <div key={`todo-${idx}`} className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <GitCommit className="w-3 h-3 shrink-0 opacity-50" />
              <span className="truncate">{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
