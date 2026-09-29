import React, { useState } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  X,
  FileCode,
  Info,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import type { ResetMode, Theme } from '../types';

interface ResetConfirmModalProps {
  isOpen: boolean;
  targetRef: string;
  targetSubject?: string;
  onClose: () => void;
  onConfirm: (mode: ResetMode, createBackup?: boolean) => Promise<void>;
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
  const [createBackup, setCreateBackup] = useState<boolean>(true);
  const [confirmCheckbox1, setConfirmCheckbox1] = useState(false);
  const [confirmCheckbox2, setConfirmCheckbox2] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  if (!isOpen) return null;

  const isHard = selectedMode === 'hard';
  const canSubmit = !isHard || (confirmCheckbox1 && confirmCheckbox2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !canSubmit) return;
    await onConfirm(selectedMode, createBackup);
  };

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
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Reset HEAD to Reference</h2>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                    isHard
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  Warning Level {isHard ? '3' : '2'}
                </span>
              </div>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {targetSubject && (
            <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60">
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
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    --mixed (Default / Safe)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                    Recommended
                  </span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                  Moves HEAD pointer to target. Unstages changes in index, but preserves all modified
                  files in your working directory.
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
              <div className="space-y-0.5">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  --soft (Keep staged)
                </span>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                  Moves HEAD pointer to target. Leaves all file modifications staged in index for
                  immediate re-committing.
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
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    --hard (Destructive)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono">
                    Warning Level 3
                  </span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                  Completely resets index and working tree. Any uncommitted changes are discarded.
                </p>
              </div>
            </label>
          </div>

          {/* Recovery Option & Backup Choice */}
          {isHard ? (
            <div className="space-y-3 p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Destructive Reset Warning</span>
              </div>
              <p className="text-[11px] text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
                Resetting hard will permanently discard uncommitted changes in tracked files.
              </p>

              {/* Recovery Option Checkbox */}
              <div className="p-2.5 rounded bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800/40 space-y-1">
                <label className="flex items-start gap-2 cursor-pointer text-zinc-900 dark:text-zinc-100 font-medium text-[11px]">
                  <input
                    type="checkbox"
                    checked={createBackup}
                    onChange={(e) => setCreateBackup(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Create a local backup ref before reset (recommended)</span>
                </label>
                <p className="text-[10px] text-zinc-500 pl-6">
                  {createBackup
                    ? 'A backup branch (backup/pre-reset-<timestamp>) will be created at current HEAD for instant rollback.'
                    : 'Backup declined by user. Proceeding without safety ref. Audit log will record that backup was declined.'}
                </p>
              </div>

              {/* Warning Level 3 Explicit Confirmation Checkboxes */}
              <div className="space-y-1.5 pt-1 text-[11px] border-t border-rose-200 dark:border-rose-800/30">
                <label className="flex items-start gap-2 cursor-pointer text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox1}
                    onChange={(e) => setConfirmCheckbox1(e.target.checked)}
                    className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                  />
                  <span>I understand that --hard discards all uncommitted modifications.</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox2}
                    onChange={(e) => setConfirmCheckbox2(e.target.checked)}
                    className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                  />
                  <span>I reviewed the target commit ref ({targetRef}).</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 text-[11px]">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Working directory files will be safely preserved.</span>
            </div>
          )}

          {/* Live CLI Command Preview & User Choice Model */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileCode className="w-3 h-3" />
                <span>Requested Operation</span>
              </span>
              {isHard && (
                <span className="text-blue-600 dark:text-blue-400 font-normal normal-case">
                  Recommended: git reset --mixed {targetRef}
                </span>
              )}
            </div>
            <div className="p-2.5 rounded bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto border border-zinc-800 select-all">
              git reset --{selectedMode} {targetRef}
            </div>
          </div>

          {/* Expandable Technical Details */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium cursor-pointer"
            >
              {showTechDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>View technical details &amp; recovery options</span>
            </button>

            {showTechDetails && (
              <div className="mt-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/30 text-[10px] font-mono space-y-1 text-zinc-600 dark:text-zinc-400">
                <div>Operation: git reset --{selectedMode}</div>
                <div>Target Ref: {targetRef}</div>
                <div>Warning Level: {isHard ? '3 (Destructive)' : '2 (Local History Change)'}</div>
                <div>Backup Ref Status: {createBackup ? 'Enabled (automatic pre-reset ref)' : 'Intentionally declined by user'}</div>
                <div>Rollback: Through Git reflog or created backup ref</div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="text-[10px] text-zinc-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Full Git capability with explicit consent</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !canSubmit}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isHard
                    ? 'bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-500/40'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500/40'
                }`}
              >
                {loading ? (
                  <span>Executing reset...</span>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Execute git reset --{selectedMode}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
