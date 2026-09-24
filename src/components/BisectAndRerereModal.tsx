import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  RotateCcw,
  SkipForward,
  Play,
  Terminal,
  Zap,
  ToggleLeft,
  ToggleRight,
  Database,
  Info,
  AlertTriangle,
} from 'lucide-react';
import type { BisectStatus, RerereStatus, OperationResult, CommitInfo } from '../types';

interface BisectAndRerereModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  commits: CommitInfo[];
  bisectStatus: BisectStatus | null;
  rerereStatus: RerereStatus | null;
  onRunBisect: (
    action: 'start' | 'good' | 'bad' | 'reset' | 'skip',
    commitSha?: string
  ) => Promise<OperationResult>;
  onToggleRerere: (enable: boolean) => Promise<OperationResult>;
  onRefresh: () => Promise<void>;
}

export const BisectAndRerereModal: React.FC<BisectAndRerereModalProps> = ({
  isOpen,
  onClose,
  commits,
  bisectStatus,
  rerereStatus,
  onRunBisect,
  onToggleRerere,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'bisect' | 'rerere'>('bisect');
  const [badCommitSha, setBadCommitSha] = useState('');
  const [goodCommitSha, setGoodCommitSha] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [outputLog, setOutputLog] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartBisect = async () => {
    setIsRunning(true);
    setError(null);
    try {
      // 1. git bisect start
      const startRes = await onRunBisect('start');
      let combinedLog = startRes.stdout || 'Bisect session started.\n';

      // 2. Mark bad commit if provided
      if (badCommitSha.trim()) {
        const badRes = await onRunBisect('bad', badCommitSha.trim());
        combinedLog += `\n[bad ${badCommitSha.slice(0, 7)}]: ${badRes.stdout || ''}`;
      }

      // 3. Mark good commit if provided
      if (goodCommitSha.trim()) {
        const goodRes = await onRunBisect('good', goodCommitSha.trim());
        combinedLog += `\n[good ${goodCommitSha.slice(0, 7)}]: ${goodRes.stdout || ''}`;
      }

      setOutputLog(combinedLog);
      await onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleBisectStep = async (action: 'good' | 'bad' | 'skip' | 'reset') => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await onRunBisect(action);
      setOutputLog(
        (prev) => `${prev}\n\n[bisect ${action}]:\n${res.stdout || res.stderr || 'Done.'}`
      );
      await onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleRerere = async () => {
    if (!rerereStatus) return;
    setIsRunning(true);
    setError(null);
    try {
      await onToggleRerere(!rerereStatus.enabled);
      await onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Git Bisect &amp; Rerere Engine
                {bisectStatus?.in_bisect && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 animate-pulse font-semibold">
                    BISECT IN PROGRESS
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Binary search regression debugger and Reuse Recorded Resolution cache
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

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 pt-2 bg-zinc-50/30 dark:bg-zinc-800/20 shrink-0 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('bisect')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'bisect'
                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Interactive Bisect</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rerere')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'rerere'
                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Git rerere (Recorded Resolution)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'bisect' ? (
            <div className="space-y-4">
              {!bisectStatus?.in_bisect ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-[11px] text-zinc-600 dark:text-zinc-300">
                    <p className="font-semibold mb-1 text-zinc-800 dark:text-zinc-200">
                      How Git Bisect Works:
                    </p>
                    <p>
                      Bisect performs a binary search through your commit history to quickly find
                      which commit introduced a bug or regression. You specify a known{' '}
                      <strong>bad commit</strong> (typically HEAD) and an older{' '}
                      <strong>good commit</strong> where the bug did not exist.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Known Bad Commit SHA (e.g. HEAD)
                      </label>
                      <input
                        type="text"
                        value={badCommitSha}
                        onChange={(e) => setBadCommitSha(e.target.value)}
                        placeholder={
                          commits[0]?.sha ? `${commits[0].sha.slice(0, 7)} (HEAD)` : 'HEAD'
                        }
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Known Good Commit SHA (older working state)
                      </label>
                      <input
                        type="text"
                        value={goodCommitSha}
                        onChange={(e) => setGoodCommitSha(e.target.value)}
                        placeholder="e.g. v1.0.0 or commit SHA"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleStartBisect}
                      disabled={isRunning}
                      className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{isRunning ? 'Starting Bisect...' : 'Start Bisect Wizard'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-violet-500/30 bg-violet-500/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-violet-700 dark:text-violet-300 text-xs">
                        Active Bisect Session
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        git bisect in progress
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                      Test your code or test suite on the currently checked out commit, then
                      classify it:
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleBisectStep('good')}
                        disabled={isRunning}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Good</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBisectStep('bad')}
                        disabled={isRunning}
                        className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Mark Bad</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBisectStep('skip')}
                        disabled={isRunning}
                        className="py-2 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Skip commit if untestable"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        <span>Skip</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBisectStep('reset')}
                        disabled={isRunning}
                        className="py-2 px-3 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Abort bisect and return to original HEAD"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Abort / Reset</span>
                      </button>
                    </div>
                  </div>

                  {bisectStatus.output && (
                    <div>
                      <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[11px] mb-1">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Bisect Log</span>
                      </div>
                      <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto border border-zinc-800">
                        {bisectStatus.output}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {outputLog && (
                <div>
                  <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[11px] mb-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>CLI Execution Output</span>
                  </div>
                  <pre className="p-3 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto border border-zinc-800">
                    {outputLog}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <Database className="w-4 h-4 text-violet-500" />
                    Reuse Recorded Resolution (git rerere)
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleRerere}
                    disabled={isRunning}
                    className="flex items-center gap-2 cursor-pointer font-semibold text-xs"
                  >
                    {rerereStatus?.enabled ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <span>Enabled</span>
                        <ToggleRight className="w-6 h-6" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <span>Disabled</span>
                        <ToggleLeft className="w-6 h-6" />
                      </span>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  <code>git rerere</code> records how you have resolved a conflicting hunk and uses
                  the recorded resolution to resolve future identical conflicts automatically during
                  rebases and merges.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Cached Conflict Resolutions:
                  </span>
                  <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {rerereStatus?.resolved_recorded ?? 0} files in <code>.git/rr-cache</code>
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 flex items-start gap-1.5 pt-1">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-500" />
                  <span>
                    When enabled, resolving a conflict once saves the resolution into your local
                    repository cache. Subsequent rebases with the same conflicts will auto-apply
                    your recorded resolution.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/40 shrink-0">
          <span className="text-[11px] text-zinc-400 font-mono">
            CLI: git bisect start|good|bad|reset &amp; git config rerere.enabled
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
