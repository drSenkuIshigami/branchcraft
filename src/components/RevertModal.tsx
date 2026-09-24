import React, { useState } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  X,
  GitBranch,
  Info,
  RefreshCw,
  GitMerge,
  ShieldCheck,
} from 'lucide-react';
import type { CommitInfo, Theme, RevertOptions, OperationResult } from '../types';
import { revertCommit } from '../ipc';

interface RevertModalProps {
  isOpen: boolean;
  repoPath: string;
  commit: CommitInfo | null;
  targetBranch?: string | null;
  onClose: () => void;
  onSuccess: (result: OperationResult, hasConflict?: boolean) => void;
  theme: Theme;
}

export const RevertModal: React.FC<RevertModalProps> = ({
  isOpen,
  repoPath,
  commit,
  targetBranch = 'HEAD',
  onClose,
  onSuccess,
}) => {
  const [noCommit, setNoCommit] = useState(false);
  const [signoff, setSignoff] = useState(false);
  const [editMessage, setEditMessage] = useState(false);
  const [mainlineParent, setMainlineParent] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !commit) return null;

  // Determine if this is a merge commit (either has >1 parents or subject/body indicates merge)
  const isMergeCommit =
    (commit.parents && commit.parents.length > 1) ||
    commit.subject.toLowerCase().startsWith('merge') ||
    commit.body.toLowerCase().includes('merge:');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !commit) return;

    setError(null);
    setSubmitting(true);

    try {
      const options: RevertOptions = {
        noCommit,
        signoff: noCommit ? false : signoff,
        edit: noCommit ? false : editMessage,
        mainline: isMergeCommit ? mainlineParent : undefined,
      };

      const res = await revertCommit(repoPath, commit.sha, options);
      const isConflict =
        !res.success &&
        (res.stderr.toLowerCase().includes('conflict') ||
          res.stdout.toLowerCase().includes('conflict') ||
          res.stderr.includes('could not apply') ||
          res.stderr.includes('revert failed'));

      if (!res.success && !isConflict) {
        throw new Error(res.stderr || res.stdout || 'Revert operation failed');
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

  // Compute command preview string
  const commandParts = ['git revert'];
  if (isMergeCommit) {
    commandParts.push(`-m ${mainlineParent}`);
  }
  if (noCommit) {
    commandParts.push('-n');
  } else {
    if (signoff) commandParts.push('-s');
    if (editMessage) {
      commandParts.push('--edit');
    } else {
      commandParts.push('--no-edit');
    }
  }
  commandParts.push(shortSha);
  const commandPreview = commandParts.join(' ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revert-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="revert-modal-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Revert Commit
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Safely inverse the changes of this commit by creating a new inverse commit
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
              <span>Applying revert commit onto:</span>
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
                <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                  by {commit.author_name}
                </span>
              </div>
              <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
                {dateFormatted}
              </span>
            </div>
            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2">
              {commit.subject}
            </p>
            {commit.body && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 font-mono whitespace-pre-wrap">
                {commit.body}
              </p>
            )}
          </div>

          {/* Merge Commit Mainline Selection */}
          {isMergeCommit && (
            <div className="p-3 rounded-lg border border-amber-300/80 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 text-xs space-y-2">
              <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <GitMerge className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-xs">Merge Commit Detected</h4>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 mt-0.5">
                    Reverting a merge requires selecting which parent branch to keep as the baseline
                    history (<code className="font-mono font-bold">-m &lt;parent&gt;</code>).
                  </p>
                </div>
              </div>

              <div className="pt-1.5 space-y-1.5">
                <label className="flex items-start gap-2 p-2 rounded-md border border-amber-200/80 dark:border-amber-900/60 bg-white/70 dark:bg-zinc-900/60 cursor-pointer">
                  <input
                    type="radio"
                    name="mainline"
                    value={1}
                    checked={mainlineParent === 1}
                    onChange={() => setMainlineParent(1)}
                    disabled={submitting}
                    className="mt-0.5 text-indigo-600 focus:ring-0"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 text-[11px]">
                      <span>Parent 1 (Mainline Branch)</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        -m 1 (Recommended)
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Keeps the mainline/target branch that received the merge as baseline. Undoes
                      the changes introduced by the merged feature branch.
                      {commit.parents?.[0] && (
                        <span className="block font-mono text-[9px] text-zinc-400 mt-0.5">
                          Parent 1 SHA: {commit.parents[0].slice(0, 7)}
                        </span>
                      )}
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2 p-2 rounded-md border border-amber-200/80 dark:border-amber-900/60 bg-white/70 dark:bg-zinc-900/60 cursor-pointer">
                  <input
                    type="radio"
                    name="mainline"
                    value={2}
                    checked={mainlineParent === 2}
                    onChange={() => setMainlineParent(2)}
                    disabled={submitting}
                    className="mt-0.5 text-indigo-600 focus:ring-0"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 text-[11px]">
                      <span>Parent 2 (Merged Branch)</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        -m 2
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Keeps the side/feature branch that was merged in as baseline. Undoes the
                      mainline state relative to the feature branch.
                      {commit.parents?.[1] && (
                        <span className="block font-mono text-[9px] text-zinc-400 mt-0.5">
                          Parent 2 SHA: {commit.parents[1].slice(0, 7)}
                        </span>
                      )}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Options Checklist */}
          <div className="space-y-2.5 pt-1">
            <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Revert Options
            </h4>

            {/* No Commit Option */}
            <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noCommit}
                disabled={submitting}
                onChange={(e) => setNoCommit(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
              />
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  Stage inverse changes without committing (<code>-n</code> /{' '}
                  <code>--no-commit</code>)
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Applies the reverted inverse changes into your staging index and working tree,
                  allowing review or adjustments before committing.
                </p>
              </div>
            </label>

            {/* Edit Message Option */}
            {!noCommit && (
              <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editMessage}
                  disabled={submitting}
                  onChange={(e) => setEditMessage(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Edit commit message (<code>-e</code> / <code>--edit</code>)
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Prompt to edit the commit message instead of using Git's default message.
                  </p>
                </div>
              </label>
            )}

            {/* Signoff Option */}
            {!noCommit && (
              <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={signoff}
                  disabled={submitting}
                  onChange={(e) => setSignoff(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Add Signed-off-by trailer (<code>-s</code> / <code>--signoff</code>)
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Adds your committer signature line to the revert commit message.
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Command Preview */}
          <div className="p-2.5 rounded-lg bg-zinc-900 text-zinc-200 text-xs font-mono border border-zinc-800 space-y-1">
            <div className="text-[10px] text-zinc-400 font-sans flex items-center gap-1">
              <Info className="w-3 h-3 text-indigo-400" />
              <span>Git CLI command that will be executed:</span>
            </div>
            <div className="text-emerald-400 font-mono text-[11px] select-all break-all">
              {commandPreview}
            </div>
          </div>

          {/* Safety Explanation Banner */}
          <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs flex items-start gap-2 text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <p className="text-[11px]">
              <strong>Shared History Safe:</strong> Unlike reset, <code>git revert</code> does not
              rewrite history. It adds a new commit with inverted diffs, preserving audit trails and
              safe collaboration on remote branches.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <span className="font-semibold">Revert failed:</span>
                <p className="font-mono text-[11px] mt-0.5 whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Reverting...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Revert Commit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
