import React, { useState } from 'react';
import {
  Cherry,
  AlertTriangle,
  CheckCircle2,
  X,
  GitBranch,
  FileCode,
  Info,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { CommitInfo, Theme, CherryPickOptions, OperationResult } from '../types';
import { cherryPickCommit } from '../ipc';

interface CherryPickModalProps {
  isOpen: boolean;
  repoPath: string;
  commit: CommitInfo | null;
  targetBranch?: string | null;
  onClose: () => void;
  onSuccess: (result: OperationResult, hasConflict?: boolean) => void;
  theme: Theme;
}

export const CherryPickModal: React.FC<CherryPickModalProps> = ({
  isOpen,
  repoPath,
  commit,
  targetBranch = 'HEAD',
  onClose,
  onSuccess,
}) => {
  const [noCommit, setNoCommit] = useState(false);
  const [recordOrigin, setRecordOrigin] = useState(true);
  const [signoff, setSignoff] = useState(false);
  const [editMessage, setEditMessage] = useState(false);
  const [mainlineParent, setMainlineParent] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !commit) return null;

  // Check if commit might be a merge commit (heuristic: multiple parents or message indicates merge)
  const isLikelyMerge =
    commit.subject.toLowerCase().startsWith('merge') ||
    commit.body.toLowerCase().includes('merge:');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !commit) return;

    setError(null);
    setSubmitting(true);

    try {
      const options: CherryPickOptions = {
        noCommit,
        recordOrigin: noCommit ? false : recordOrigin,
        signoff: noCommit ? false : signoff,
        edit: noCommit ? false : editMessage,
        mainline: mainlineParent ? Number(mainlineParent) : undefined,
      };

      const res = await cherryPickCommit(repoPath, commit.sha, options);
      const isConflict =
        !res.success &&
        (res.stderr.toLowerCase().includes('conflict') ||
          res.stdout.toLowerCase().includes('conflict') ||
          res.stderr.includes('could not apply'));
      if (!res.success && !isConflict) {
        throw new Error(res.stderr || res.stdout || 'Cherry-pick failed');
      }

      onSuccess(res, isConflict);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const shortSha = commit.sha.slice(0, 7);
  const dateFormatted = new Date(commit.author_date).toLocaleString();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cherry-pick-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Cherry className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="cherry-pick-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Cherry-Pick Commit
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Apply the changes introduced by this commit onto your current branch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Target Branch Banner */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <GitBranch className="w-4 h-4 shrink-0 text-blue-500" />
              <span>Applying onto current branch:</span>
            </div>
            <span className="px-2 py-0.5 rounded font-mono font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 text-[11px]">
              {targetBranch || 'HEAD'}
            </span>
          </div>

          {/* Source Commit Card */}
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                  {shortSha}
                </span>
                <span className="text-zinc-500 truncate max-w-[200px]">{commit.author_name}</span>
              </div>
              <span className="text-zinc-400 text-[10px]">{dateFormatted}</span>
            </div>
            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
              {commit.subject}
            </p>
          </div>

          {/* Cherry-pick Flags & Options */}
          <div className="space-y-2.5 pt-1">
            <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recordOrigin}
                disabled={noCommit || submitting}
                onChange={(e) => setRecordOrigin(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
              />
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  Record origin reference (<code>-x</code>)
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Appends &ldquo;(cherry picked from commit {shortSha})&rdquo; to the new commit
                  message.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noCommit}
                disabled={submitting}
                onChange={(e) => setNoCommit(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
              />
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  No commit (<code>-n</code> / <code>--no-commit</code>)
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Applies the commit's diff directly into your staged changes without making a
                  commit. You can inspect or edit changes first.
                </p>
              </div>
            </label>

            {!noCommit && (
              <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={signoff}
                  disabled={submitting}
                  onChange={(e) => setSignoff(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Sign-off commit (<code>-s</code> / <code>--signoff</code>)
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Adds a Signed-off-by trailer by the committer.
                  </p>
                </div>
              </label>
            )}

            {!noCommit && (
              <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editMessage}
                  disabled={submitting}
                  onChange={(e) => setEditMessage(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Edit commit message (<code>-e</code> / <code>--edit</code>)
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Launch editor to refine commit message before committing.
                  </p>
                </div>
              </label>
            )}

            {/* Merge commit mainline option */}
            {isLikelyMerge && (
              <div className="p-2.5 rounded-lg border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Merge Commit Detected</span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  To cherry-pick a merge commit, you must specify the parent number (usually{' '}
                  <code>1</code> for mainline):
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <label
                    htmlFor="mainline-input"
                    className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400"
                  >
                    -m:
                  </label>
                  <input
                    id="mainline-input"
                    type="number"
                    min="1"
                    max="5"
                    value={mainlineParent}
                    onChange={(e) =>
                      setMainlineParent(e.target.value ? Number(e.target.value) : '')
                    }
                    placeholder="1"
                    className="w-16 px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                  />
                  <span className="text-[11px] text-zinc-400">(Default: 1)</span>
                </div>
              </div>
            )}
          </div>

          {/* Conflict Guidance Notice */}
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-semibold">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Conflict Handling Guidance</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              If any changes in this commit collide with your working branch, Git will enter
              conflict state. Git Workbench will automatically highlight the conflicted files,
              allowing you to accept ours/theirs, edit manually in Monaco, and click{' '}
              <strong>Continue</strong> or <strong>Abort</strong>.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Cherry-picking...</span>
                </>
              ) : (
                <>
                  <Cherry className="w-3.5 h-3.5" />
                  <span>Cherry-Pick to {targetBranch || 'HEAD'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
