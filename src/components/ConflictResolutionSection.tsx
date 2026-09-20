import React, { useState } from 'react';
import {
  AlertTriangle,
  GitMerge,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Split,
  ChevronRight,
  ShieldAlert,
  Play,
  Check,
  Cherry,
  SkipForward,
} from 'lucide-react';
import type { ConflictState, ConflictResolutionType, Theme } from '../types';

interface ConflictResolutionSectionProps {
  conflictState: ConflictState | null;
  conflictedFiles: string[];
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  onResolveConflict: (filePath: string, resolution: ConflictResolutionType) => Promise<void>;
  onLaunchMergetool: (filePath?: string) => Promise<void>;
  onContinue: () => Promise<void>;
  onSkip?: () => Promise<void>;
  onAbort: () => Promise<void>;
  onCreateDemoConflict?: () => Promise<void>;
  onCreateDemoCherryPickConflict?: () => Promise<void>;
  onCreateDemoRevertConflict?: () => Promise<void>;
  loading: boolean;
  theme: Theme;
}

export const ConflictResolutionSection: React.FC<ConflictResolutionSectionProps> = ({
  conflictState,
  conflictedFiles,
  selectedFile,
  onSelectFile,
  onResolveConflict,
  onLaunchMergetool,
  onContinue,
  onSkip,
  onAbort,
  onCreateDemoConflict,
  onCreateDemoCherryPickConflict,
  onCreateDemoRevertConflict,
  loading,
}) => {
  const [actionFile, setActionFile] = useState<string | null>(null);
  const [globalActionLoading, setGlobalActionLoading] = useState<string | null>(null);
  const [confirmAbort, setConfirmAbort] = useState(false);

  const inMerge = conflictState?.in_merge ?? false;
  const inRebase = conflictState?.in_rebase ?? false;
  const inCherryPick = conflictState?.in_cherry_pick ?? false;
  const inRevert = conflictState?.in_revert ?? false;
  const hasConflictState = inMerge || inRebase || inCherryPick || inRevert || conflictedFiles.length > 0;

  if (!hasConflictState) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2 text-zinc-500">
          <GitMerge className="w-3.5 h-3.5 text-zinc-400" />
          <span>No merge, rebase, cherry-pick, or revert conflicts currently detected</span>
        </div>
        <div className="flex items-center gap-2">
          {onCreateDemoConflict && (
            <button
              type="button"
              onClick={async () => {
                setGlobalActionLoading('demo');
                try {
                  await onCreateDemoConflict();
                } finally {
                  setGlobalActionLoading(null);
                }
              }}
              disabled={globalActionLoading !== null || loading}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
              title="Create a sandbox conflict on src/index.js to test merge conflict resolution"
            >
              <Play className="w-3 h-3 text-blue-500" />
              <span>Simulate Merge Conflict</span>
            </button>
          )}
          {onCreateDemoCherryPickConflict && (
            <button
              type="button"
              onClick={async () => {
                setGlobalActionLoading('cherry_demo');
                try {
                  await onCreateDemoCherryPickConflict();
                } finally {
                  setGlobalActionLoading(null);
                }
              }}
              disabled={globalActionLoading !== null || loading}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
              title="Create a sandbox conflict to test cherry-pick conflict guidance and resolution"
            >
              <Cherry className="w-3 h-3 text-emerald-500" />
              <span>Simulate Cherry-pick</span>
            </button>
          )}
          {onCreateDemoRevertConflict && (
            <button
              type="button"
              onClick={async () => {
                setGlobalActionLoading('revert_demo');
                try {
                  await onCreateDemoRevertConflict();
                } finally {
                  setGlobalActionLoading(null);
                }
              }}
              disabled={globalActionLoading !== null || loading}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
              title="Create a sandbox conflict to test revert conflict guidance and resolution"
            >
              <RotateCcw className="w-3 h-3 text-indigo-500" />
              <span>Simulate Revert</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const opTitle = inRebase
    ? 'Rebase Conflict in Progress'
    : inCherryPick
    ? 'Cherry-pick Conflict in Progress'
    : inRevert
    ? 'Revert Conflict in Progress'
    : inMerge
    ? 'Merge Conflict in Progress'
    : 'Unmerged Working Tree Conflicts';

  const opDescription = inCherryPick
    ? `A cherry-pick was paused due to colliding changes${
        conflictState?.cherry_pick_head
          ? ` while applying commit ${conflictState.cherry_pick_head.slice(0, 7)}`
          : ''
      }${
        conflictState?.cherry_pick_subject
          ? ` ("${conflictState.cherry_pick_subject}")`
          : ''
      }. Resolve the conflicted files below and click Continue, or click Skip to omit this commit.`
    : inRevert
    ? `A revert operation was paused due to conflicting changes${
        conflictState?.revert_head
          ? ` while reverting commit ${conflictState.revert_head.slice(0, 7)}`
          : ''
      }${
        conflictState?.revert_subject
          ? ` ("${conflictState.revert_subject}")`
          : ''
      }. Resolve the conflicted files below and click Continue to finalize the revert commit, or click Skip/Abort.`
    : inRebase
    ? 'A rebase sequence was paused due to merge conflicts. Resolve files then continue or abort.'
    : inMerge
    ? 'A merge operation encountered conflicting changes between local branch and incoming branch.'
    : 'Files have unresolved conflict markers. Choose which version to keep or edit manually.';

  const handleResolve = async (filePath: string, resolution: ConflictResolutionType) => {
    setActionFile(`${filePath}:${resolution}`);
    try {
      await onResolveConflict(filePath, resolution);
    } finally {
      setActionFile(null);
    }
  };

  const handleMergetool = async (filePath?: string) => {
    setGlobalActionLoading(filePath || 'mergetool');
    try {
      await onLaunchMergetool(filePath);
    } finally {
      setGlobalActionLoading(null);
    }
  };

  const handleContinue = async () => {
    setGlobalActionLoading('continue');
    try {
      await onContinue();
    } finally {
      setGlobalActionLoading(null);
    }
  };

  const handleSkip = async () => {
    if (!onSkip) return;
    setGlobalActionLoading('skip');
    try {
      await onSkip();
    } finally {
      setGlobalActionLoading(null);
    }
  };

  const handleAbort = async () => {
    setGlobalActionLoading('abort');
    try {
      await onAbort();
      setConfirmAbort(false);
    } finally {
      setGlobalActionLoading(null);
    }
  };

  const allResolved = conflictedFiles.length === 0;

  return (
    <div className="border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20 rounded-xl p-3.5 space-y-3">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            {inCherryPick ? (
              <Cherry className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : inRevert ? (
              <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-xs text-amber-900 dark:text-amber-200">
                {opTitle}
              </h3>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium">
                {conflictedFiles.length} file{conflictedFiles.length === 1 ? '' : 's'} remaining
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70 mt-0.5">
              {opDescription}
            </p>
          </div>
        </div>

        {/* Action Controls: Skip / Abort / Continue */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
          {(inCherryPick || inRebase || inRevert) && onSkip && (
            <button
              type="button"
              onClick={handleSkip}
              disabled={globalActionLoading !== null}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-200/70 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              title={
                inCherryPick
                  ? 'Skip applying this commit (git cherry-pick --skip)'
                  : inRevert
                  ? 'Skip reverting this commit (git revert --skip)'
                  : 'Skip current rebase commit (git rebase --skip)'
              }
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Skip Commit</span>
            </button>
          )}

          {confirmAbort ? (
            <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 p-1 rounded-lg text-[11px]">
              <span className="text-rose-600 dark:text-rose-400 font-medium px-1">Abort operation?</span>
              <button
                type="button"
                onClick={handleAbort}
                disabled={globalActionLoading !== null}
                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] transition-colors cursor-pointer"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmAbort(false)}
                className="px-1.5 py-0.5 rounded text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAbort(true)}
              disabled={globalActionLoading !== null}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-200/70 dark:bg-zinc-800/80 hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              title="Safely abort active cherry-pick or merge, restoring previous HEAD state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Abort</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!allResolved || globalActionLoading !== null}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-all shadow-sm ${
              allResolved
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer animate-pulse'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-60'
            }`}
            title={
              allResolved
                ? inCherryPick
                  ? 'All conflicts resolved! Continue cherry-pick'
                  : 'All conflicts resolved! Complete merge / continue rebase'
                : 'Resolve all conflicting files before continuing'
            }
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{inCherryPick ? 'Continue Cherry-Pick' : 'Continue'}</span>
          </button>
        </div>
      </div>

      {/* Conflicted Files List */}
      <div className="space-y-1.5">
        {conflictedFiles.map((path) => {
          const isSelected = selectedFile === path;
          return (
            <div
              key={path}
              onClick={() => onSelectFile(path)}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
                isSelected
                  ? 'border-amber-500/50 bg-amber-500/15'
                  : 'border-amber-500/20 bg-white/60 dark:bg-zinc-900/60 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Split className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100 font-medium truncate">
                  {path}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Conflict
                </span>
              </div>

              {/* Conflict Action Buttons */}
              <div
                className="flex items-center gap-1 shrink-0 flex-wrap"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => handleResolve(path, 'ours')}
                  disabled={actionFile !== null}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  title="Accept Ours: Keep HEAD branch version (--ours) and stage"
                >
                  {actionFile === `${path}:ours` ? 'Resolving...' : 'Accept Ours'}
                </button>

                <button
                  type="button"
                  onClick={() => handleResolve(path, 'theirs')}
                  disabled={actionFile !== null}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 hover:bg-purple-500/20 hover:text-purple-600 dark:hover:text-purple-400 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  title="Accept Theirs: Take incoming branch version (--theirs) and stage"
                >
                  {actionFile === `${path}:theirs` ? 'Resolving...' : 'Accept Theirs'}
                </button>

                <button
                  type="button"
                  onClick={() => handleResolve(path, 'mark_resolved')}
                  disabled={actionFile !== null}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                  title="Mark Resolved: Stage current file content (git add)"
                >
                  <Check className="w-3 h-3" />
                  <span>{actionFile === `${path}:mark_resolved` ? 'Staging...' : 'Mark Resolved'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleMergetool(path)}
                  disabled={globalActionLoading !== null}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Launch external mergetool for 3-way visual resolution"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
