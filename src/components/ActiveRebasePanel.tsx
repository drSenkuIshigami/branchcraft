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
  FileEdit,
  Save,
  Check,
} from 'lucide-react';
import type { RebaseStatus, Theme } from '../types';

interface ActiveRebasePanelProps {
  rebaseStatus: RebaseStatus;
  hasConflicts: boolean;
  theme: Theme;
  onContinue: () => void;
  onSkip: () => void;
  onAbort: () => void;
  onOpenEditor?: () => void;
  onAmendAndContinue?: () => void;
}

export const ActiveRebasePanel: React.FC<ActiveRebasePanelProps> = ({
  rebaseStatus,
  hasConflicts,
  theme,
  onContinue,
  onSkip,
  onAbort,
  onOpenEditor,
  onAmendAndContinue,
}) => {
  if (!rebaseStatus.in_progress) return null;

  const total =
    rebaseStatus.total_steps ||
    (rebaseStatus.done_steps?.length || 0) + (rebaseStatus.todo_steps?.length || 0) + 1;
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
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-2.5">
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
              {hasConflicts ? ' (conflicts must be resolved)' : ' (ready to edit files or amend)'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-1.5 shrink-0">
          {onOpenEditor && (
            <button
              type="button"
              id="rebase-open-editor-button"
              onClick={onOpenEditor}
              title="Open repository file editor (e.g. README.md)"
              className="px-2.5 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Edit Files</span>
            </button>
          )}

          {onAmendAndContinue && (
            <button
              type="button"
              id="rebase-amend-continue-button"
              onClick={onAmendAndContinue}
              disabled={hasConflicts}
              title="Amend staged changes into this commit and continue rebase"
              className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Amend & Continue</span>
            </button>
          )}

          <button
            type="button"
            id="rebase-continue-button"
            onClick={onContinue}
            disabled={hasConflicts}
            title={
              hasConflicts ? 'Resolve all conflicts first before continuing' : 'Continue rebase'
            }
            className="px-2.5 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Continue</span>
          </button>

          <button
            type="button"
            id="rebase-skip-button"
            onClick={onSkip}
            title="Skip this commit and proceed to next"
            className="px-2.5 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <SkipForward className="w-3 h-3" />
            <span>Skip</span>
          </button>

          <button
            type="button"
            id="rebase-abort-button"
            onClick={onAbort}
            title="Abort rebase and restore original branch state"
            className="px-2.5 py-1.5 rounded-md bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <XCircle className="w-3 h-3" />
            <span>Abort</span>
          </button>
        </div>
      </div>

      {/* Helper message banner */}
      <div className="flex items-center justify-between px-2.5 py-1.5 mb-2 rounded bg-amber-100/60 dark:bg-amber-900/40 text-[11px] text-amber-800 dark:text-amber-200">
        <div className="flex items-center gap-1.5">
          <FileEdit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Git is paused at this commit. Use <strong>Edit Files</strong> to view or change files (e.g. <code className="font-mono">README.md</code>), then click <strong>Amend & Continue</strong>.
          </span>
        </div>
        {onOpenEditor && (
          <button
            type="button"
            onClick={onOpenEditor}
            className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 underline hover:no-underline ml-2 shrink-0 cursor-pointer"
          >
            Open Editor →
          </button>
        )}
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
            <div
              key={`done-${idx}`}
              className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{s}</span>
            </div>
          ))}
          {rebaseStatus.current_commit && (
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200 font-semibold bg-amber-100/50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
              <ArrowRight className="w-3 h-3 shrink-0 text-amber-500" />
              <span className="truncate">CURRENT: {rebaseStatus.current_commit.slice(0, 7)}</span>
            </div>
          )}
          {rebaseStatus.todo_steps?.slice(0, 2).map((s, idx) => (
            <div
              key={`todo-${idx}`}
              className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400"
            >
              <GitCommit className="w-3 h-3 shrink-0 opacity-50" />
              <span className="truncate">{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
