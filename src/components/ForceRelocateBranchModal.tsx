import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  GitCommit,
  CheckCircle2,
} from 'lucide-react';
import type { ForceRelocateBranchPreview, CommitInfo, OperationResult } from '../types';

interface ForceRelocateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName: string;
  targetSha: string;
  targetSubject?: string;
  currentBranch?: string;
  onPreview: (branchName: string, newSha: string) => Promise<ForceRelocateBranchPreview>;
  onExecute: (
    branchName: string,
    newSha: string,
    createBackup?: boolean
  ) => Promise<OperationResult>;
}

export const ForceRelocateBranchModal: React.FC<ForceRelocateBranchModalProps> = ({
  isOpen,
  onClose,
  branchName,
  targetSha,
  targetSubject,
  currentBranch,
  onPreview,
  onExecute,
}) => {
  const [preview, setPreview] = useState<ForceRelocateBranchPreview | null>(null);
  const [createBackup, setCreateBackup] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRelocating, setIsRelocating] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentBranch = currentBranch ? currentBranch.trim() === branchName.trim() : false;

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setIsLoading(true);
    setError(null);
    onPreview(branchName, targetSha)
      .then((p) => {
        if (mounted) setPreview(p);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, branchName, targetSha, onPreview]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (isCurrentBranch) {
      setError('Cannot force relocate the active branch. Switch branches first or use Reset.');
      return;
    }
    setIsRelocating(true);
    setError(null);
    try {
      await onExecute(branchName, targetSha, createBackup);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRelocating(false);
    }
  };

  const hasLostCommits = (preview?.lostCommits.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Force Relocate Branch Pointer (<code>branch -f</code>)
              </h2>
              <p className="text-[11px] text-zinc-500">
                Move branch reference{' '}
                <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                  {branchName}
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

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Relocation summary */}
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between font-mono">
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-sans font-semibold">
                Current Position
              </div>
              <div className="font-bold text-zinc-800 dark:text-zinc-200">
                {preview?.currentSha ? preview.currentSha.slice(0, 7) : '...'}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-400" />
            <div className="text-right">
              <div className="text-[10px] text-zinc-400 uppercase font-sans font-semibold">
                New Target (<code>-f</code>)
              </div>
              <div className="font-bold text-amber-600 dark:text-amber-400">
                {targetSha.slice(0, 7)}
              </div>
            </div>
          </div>

          {targetSubject && (
            <div className="text-[11px] text-zinc-500">
              Target commit:{' '}
              <span className="text-zinc-800 dark:text-zinc-200 italic">{targetSubject}</span>
            </div>
          )}

          {/* Lost commits warning */}
          {isLoading ? (
            <div className="py-4 text-center text-zinc-400 italic">
              Calculating reachable commit divergence...
            </div>
          ) : hasLostCommits ? (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {preview!.lostCommits.length} Commit{preview!.lostCommits.length > 1 ? 's' : ''}{' '}
                  will become unreferenced!
                </span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                These commits exist on <code>{branchName}</code> but are not in the ancestry of the
                new target SHA. They can still be recovered from the <strong>Reflog</strong> if
                needed.
              </p>

              {/* List of lost commits */}
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 pt-1">
                {preview!.lostCommits.map((c) => (
                  <div
                    key={c.sha}
                    className="p-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-[11px]"
                  >
                    <span className="truncate pr-2 font-medium text-zinc-800 dark:text-zinc-200">
                      {c.subject}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                      {c.sha.slice(0, 7)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Fast-forward or ancestor repositioning: No commits will be orphaned by this
                relocation.
              </span>
            </div>
          )}

          {/* Active branch check */}
          {isCurrentBranch && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Cannot force relocate active branch:</span>
                Git prohibits <code>branch -f</code> on the currently checked-out branch (
                <code>{branchName}</code>). To move HEAD, switch branches first or use the{' '}
                <strong>Reset HEAD</strong> tool.
              </div>
            </div>
          )}

          {/* Backup Branch Option */}
          <label className="flex items-start gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={createBackup}
              onChange={(e) => setCreateBackup(e.target.checked)}
              className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
            />
            <span className="text-[11px] text-zinc-600 dark:text-zinc-300">
              Create automatic safety backup ref (<code>backup/{branchName}-&lt;timestamp&gt;</code>
              ) before relocating.
            </span>
          </label>

          {/* Safety confirmation checkbox */}
          {hasLostCommits && (
            <label className="flex items-start gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="text-[11px] text-zinc-600 dark:text-zinc-300">
                I understand this will force-move <code>{branchName}</code> away from its current
                tip and orphan {preview!.lostCommits.length} commit(s).
              </span>
            </label>
          )}

          {/* Footer actions */}
          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={
                isRelocating || isLoading || isCurrentBranch || (hasLostCommits && !confirmed)
              }
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRelocating ? 'Relocating...' : 'Force Relocate (branch -f)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
