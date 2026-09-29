import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, Loader2, ShieldCheck, ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import type { StatusInfo } from '../types';

interface ResetHardModalProps {
  isOpen: boolean;
  status: StatusInfo | null;
  onClose: () => void;
  onConfirm: (createBackup?: boolean) => Promise<void>;
}

export const ResetHardModal: React.FC<ResetHardModalProps> = ({
  isOpen,
  status,
  onClose,
  onConfirm,
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);
  const [confirmCheck1, setConfirmCheck1] = useState(false);
  const [confirmCheck2, setConfirmCheck2] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const stagedCount = status?.staged.length ?? 0;
  const unstagedCount = status?.unstaged.length ?? 0;
  const totalTracked = stagedCount + unstagedCount;

  const handleConfirm = async () => {
    if (!confirmCheck1 || !confirmCheck2) return;
    try {
      setIsResetting(true);
      setError(null);
      await onConfirm(createBackup);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-hard-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-rose-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="reset-hard-title"
                  className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  Reset Working Tree to HEAD
                </h2>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-mono font-medium">
                  Warning Level 3
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Discard all tracked modifications across index &amp; working directory
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Requested Operation CLI */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Requested Operation</span>
              <span className="text-blue-600 dark:text-blue-400 normal-case font-normal">
                Recommended: git stash or backup ref
              </span>
            </div>
            <div className="p-2 rounded bg-zinc-950 text-zinc-200 font-mono text-xs border border-zinc-800 select-all">
              git reset --hard HEAD
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Current Target:</span>
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                HEAD ({status?.current_branch || 'detached'})
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Tracked files to discard:</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                {totalTracked} files ({stagedCount} staged, {unstagedCount} unstaged)
              </span>
            </div>
          </div>

          {/* Recovery Option Checkbox */}
          <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
            <label className="flex items-start gap-2 cursor-pointer text-zinc-900 dark:text-zinc-100 font-medium text-[11px]">
              <input
                type="checkbox"
                checked={createBackup}
                onChange={(e) => setCreateBackup(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Create a local backup ref before reset (recommended)</span>
            </label>
            <p className="text-[10px] text-zinc-500 pl-5 leading-normal">
              {createBackup
                ? 'Creates refs/heads/backup/pre-reset-hard-<timestamp> before clearing modifications.'
                : 'Backup declined by user. Proceeding without safety ref. Audit log will record decline.'}
            </p>
          </div>

          {/* Warning Level 3 Confirmation Checkboxes */}
          <div className="space-y-1.5 text-[11px] p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40">
            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-semibold mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Informed User Consent</span>
            </div>
            <label className="flex items-start gap-2 cursor-pointer text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={confirmCheck1}
                onChange={(e) => setConfirmCheck1(e.target.checked)}
                className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
              />
              <span>I understand this will discard {totalTracked} uncommitted file modifications.</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={confirmCheck2}
                onChange={(e) => setConfirmCheck2(e.target.checked)}
                className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
              />
              <span>I intentionally select to execute git reset --hard HEAD.</span>
            </label>
          </div>

          {/* Expandable Technical Details */}
          <div>
            <button
              type="button"
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium cursor-pointer"
            >
              {showTechDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>View technical details</span>
            </button>
            {showTechDetails && (
              <div className="mt-1.5 p-2 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 space-y-0.5">
                <div>Command: git reset --hard HEAD</div>
                <div>Backup Ref Status: {createBackup ? 'Requested' : 'Declined by user'}</div>
                <div>Rollback: Git reflog or safety backup branch</div>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="text-[10px] text-zinc-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Full Git capability</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isResetting}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isResetting || !confirmCheck1 || !confirmCheck2}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Execute git reset --hard</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
