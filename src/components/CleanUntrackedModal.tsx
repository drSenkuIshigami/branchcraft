import React, { useState, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  X,
  FileCode,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { CleanMode, CleanResult, Theme } from '../types';
import { cleanWorkingTree } from '../ipc';

interface CleanUntrackedModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  onSuccess: () => void;
  theme: Theme;
}

export const CleanUntrackedModal: React.FC<CleanUntrackedModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  onSuccess,
}) => {
  const [cleanMode, setCleanMode] = useState<CleanMode>('fd');
  const [previewItems, setPreviewItems] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  useEffect(() => {
    if (!isOpen || !repoPath) return;
    loadPreview(cleanMode);
  }, [isOpen, cleanMode, repoPath]);

  const loadPreview = async (mode: CleanMode) => {
    setLoadingPreview(true);
    setError(null);
    try {
      const res: CleanResult = await cleanWorkingTree(repoPath, mode, true);
      setPreviewItems(res.cleaned_items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteClean = async () => {
    if (!confirmCheck) return;
    setExecuting(true);
    setError(null);
    try {
      await cleanWorkingTree(repoPath, cleanMode, false);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
            <Trash2 className="w-4 h-4" />
            <span>Clean Untracked Files (git clean)</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/15 font-mono">
              Warning Level 3
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={executing}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-700 dark:text-zinc-300 block">
              Select Clean Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={`p-2 rounded-lg border cursor-pointer text-center transition-colors ${
                  cleanMode === 'f'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <input
                  type="radio"
                  name="clean-mode"
                  value="f"
                  checked={cleanMode === 'f'}
                  onChange={() => setCleanMode('f')}
                  className="sr-only"
                />
                <div>-f</div>
                <div className="text-[10px] font-normal opacity-80">Files only</div>
              </label>

              <label
                className={`p-2 rounded-lg border cursor-pointer text-center transition-colors ${
                  cleanMode === 'fd'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <input
                  type="radio"
                  name="clean-mode"
                  value="fd"
                  checked={cleanMode === 'fd'}
                  onChange={() => setCleanMode('fd')}
                  className="sr-only"
                />
                <div>-fd (Default)</div>
                <div className="text-[10px] font-normal opacity-80">Files &amp; dirs</div>
              </label>

              <label
                className={`p-2 rounded-lg border cursor-pointer text-center transition-colors ${
                  cleanMode === 'fdx'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <input
                  type="radio"
                  name="clean-mode"
                  value="fdx"
                  checked={cleanMode === 'fdx'}
                  onChange={() => setCleanMode('fdx')}
                  className="sr-only"
                />
                <div>-fdx (All)</div>
                <div className="text-[10px] font-normal opacity-80">Incl. ignored</div>
              </label>
            </div>
          </div>

          {/* Requested CLI command */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-3 h-3" />
              <span>Requested Git Operation</span>
            </span>
            <div className="p-2.5 rounded bg-zinc-950 text-zinc-200 font-mono text-xs border border-zinc-800 select-all">
              git clean -{cleanMode}
            </div>
          </div>

          {/* Dry Run Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                Dry-run Effect Preview ({previewItems.length} items to remove)
              </span>
              <button
                type="button"
                onClick={() => loadPreview(cleanMode)}
                disabled={loadingPreview}
                className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingPreview ? 'animate-spin' : ''}`} />
                <span>Refresh preview</span>
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 font-mono text-[11px] space-y-1">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-4 text-zinc-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scanning untracked files...</span>
                </div>
              ) : previewItems.length === 0 ? (
                <div className="text-zinc-400 italic py-2 text-center">
                  No untracked files match criteria for git clean -{cleanMode}.
                </div>
              ) : (
                previewItems.map((item, idx) => (
                  <div key={idx} className="text-rose-600 dark:text-rose-400 truncate">
                    &times; {item}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Warning Level 3 Informed Consent */}
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 space-y-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Permanent Deletion Warning</span>
            </div>
            <p className="text-[11px] text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
              Untracked files are not tracked by Git history and cannot be recovered via reflog once
              deleted.
            </p>
            <label className="flex items-start gap-2 cursor-pointer text-[11px] text-zinc-800 dark:text-zinc-200 pt-1">
              <input
                type="checkbox"
                checked={confirmCheck}
                onChange={(e) => setConfirmCheck(e.target.checked)}
                className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
              />
              <span>
                I understand that git clean -{cleanMode} permanently deletes these untracked files
                from disk.
              </span>
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
                <div>Command: git clean -{cleanMode}</div>
                <div>Dry-run verified: {previewItems.length} targets</div>
                <div>Policy: User choice is respected; no silent forced backups.</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>User-Controlled Safety Policy</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={executing}
              className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteClean}
              disabled={executing || !confirmCheck || previewItems.length === 0}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {executing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Cleaning...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Execute git clean -{cleanMode}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
