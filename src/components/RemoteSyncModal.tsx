import React, { useState } from 'react';
import {
  Globe,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';
import type { RemoteInfo, SyncStatus } from '../types';

interface RemoteSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus | null;
  remotes: RemoteInfo[];
  currentBranch: string | null;
  onFetch: (remote: string, prune: boolean) => Promise<void>;
  onPull: (remote: string, branch?: string) => Promise<void>;
  onPush: (
    remote: string,
    branch?: string,
    forceWithLease?: boolean,
    setUpstream?: boolean
  ) => Promise<void>;
}

export const RemoteSyncModal: React.FC<RemoteSyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  remotes,
  currentBranch,
  onFetch,
  onPull,
  onPush,
}) => {
  const [selectedRemote, setSelectedRemote] = useState<string>(
    syncStatus?.remote_name || (remotes.length > 0 ? remotes[0].name : 'origin')
  );
  const [pruneOnFetch, setPruneOnFetch] = useState<boolean>(true);
  const [forceWithLease, setForceWithLease] = useState<boolean>(false);
  const [setUpstreamOnPush, setSetUpstreamOnPush] = useState<boolean>(!syncStatus?.has_upstream);
  const [activeAction, setActiveAction] = useState<'fetch' | 'pull' | 'push' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveRemote = selectedRemote || 'origin';
  const aheadCount = syncStatus?.ahead || 0;
  const behindCount = syncStatus?.behind || 0;
  const hasUpstream = Boolean(syncStatus?.has_upstream);

  const handleFetch = async () => {
    setActiveAction('fetch');
    setActionError(null);
    setActionSuccess(null);
    try {
      await onFetch(effectiveRemote, pruneOnFetch);
      setActionSuccess(
        `Successfully fetched from ${effectiveRemote}${pruneOnFetch ? ' (with --prune)' : ''}.`
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActiveAction(null);
    }
  };

  const handlePull = async () => {
    setActiveAction('pull');
    setActionError(null);
    setActionSuccess(null);
    try {
      await onPull(effectiveRemote, currentBranch || undefined);
      setActionSuccess(`Successfully pulled updates into ${currentBranch || 'HEAD'}.`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActiveAction(null);
    }
  };

  const handlePush = async () => {
    setActiveAction('push');
    setActionError(null);
    setActionSuccess(null);
    try {
      await onPush(effectiveRemote, currentBranch || undefined, forceWithLease, setUpstreamOnPush);
      setActionSuccess(
        `Successfully pushed ${currentBranch || 'HEAD'} to ${effectiveRemote}${
          forceWithLease ? ' (--force-with-lease)' : ''
        }.`
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Remote Synchronization
              </h2>
              <p className="text-[11px] text-zinc-500">
                Safe remote fetch, pull, and lease-protected push operations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={activeAction !== null}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Status Indicator Card */}
          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
                <span className="text-[11px] text-zinc-500">Branch:</span>
                <span className="font-mono px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold">
                  {currentBranch || 'HEAD'}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                {hasUpstream ? (
                  <span className="text-zinc-500 flex items-center gap-1">
                    Upstream:
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {syncStatus?.upstream_name}
                    </span>
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    No upstream tracking branch
                  </span>
                )}
              </div>
            </div>

            {/* Ahead / Behind Metrics */}
            <div className="flex items-center gap-3 pt-1 border-t border-zinc-200 dark:border-zinc-800/60">
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                <ArrowUp className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  <strong className="text-blue-600 dark:text-blue-400 font-mono">
                    {aheadCount}
                  </strong>{' '}
                  ahead
                </span>
              </div>
              <div className="w-px h-3.5 bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                <ArrowDown className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  <strong className="text-amber-600 dark:text-amber-400 font-mono">
                    {behindCount}
                  </strong>{' '}
                  behind
                </span>
              </div>
            </div>
          </div>

          {/* Remote Selection */}
          <div className="space-y-1.5">
            <label className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Target Remote</span>
              {remotes.length > 0 && (
                <span className="text-[11px] text-zinc-400 font-normal">
                  {remotes.length} configured
                </span>
              )}
            </label>
            {remotes.length > 0 ? (
              <select
                value={selectedRemote}
                onChange={(e) => setSelectedRemote(e.target.value)}
                disabled={activeAction !== null}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {remotes.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name} ({r.fetch_url || 'no url'})
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-2.5 rounded bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 text-[11px] font-mono">
                No remotes configured in this repository. Defaulting to &quot;origin&quot;.
              </div>
            )}
          </div>

          {/* Feedback Messages */}
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[11px]">Command Failed</div>
                <div className="text-[11px] font-mono break-words mt-0.5">{actionError}</div>
              </div>
            </div>
          )}

          {actionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div className="text-[11px] font-medium">{actionSuccess}</div>
            </div>
          )}

          {/* Action Grid: Fetch, Pull, Push */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {/* 1. Fetch */}
            <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                  <span>Fetch</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  Downloads objects and updates remote branches without altering working tree.
                </p>
                <label className="flex items-center gap-2 mt-2.5 cursor-pointer text-[11px] text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={pruneOnFetch}
                    onChange={(e) => setPruneOnFetch(e.target.checked)}
                    disabled={activeAction !== null}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Prune deleted refs (--prune)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleFetch}
                disabled={activeAction !== null}
                className="w-full py-1.5 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${activeAction === 'fetch' ? 'animate-spin' : ''}`}
                />
                <span>{activeAction === 'fetch' ? 'Fetching...' : 'Run Fetch'}</span>
              </button>
            </div>

            {/* 2. Pull */}
            <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Pull</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  Fetches and integrates remote commits into the current active branch.
                </p>
                {behindCount > 0 && (
                  <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Branch is {behindCount} commit{behindCount > 1 ? 's' : ''} behind upstream.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handlePull}
                disabled={activeAction !== null}
                className="w-full py-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download
                  className={`w-3.5 h-3.5 ${activeAction === 'pull' ? 'animate-spin' : ''}`}
                />
                <span>{activeAction === 'pull' ? 'Pulling...' : 'Run Pull'}</span>
              </button>
            </div>

            {/* 3. Push */}
            <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                  <Upload className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Push</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  Publishes committed local commits to the target remote.
                </p>

                <div className="mt-2 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-600 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={setUpstreamOnPush}
                      onChange={(e) => setSetUpstreamOnPush(e.target.checked)}
                      disabled={activeAction !== null}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Set upstream (-u)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-amber-600 dark:text-amber-400">
                    <input
                      type="checkbox"
                      checked={forceWithLease}
                      onChange={(e) => setForceWithLease(e.target.checked)}
                      disabled={activeAction !== null}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-amber-600 focus:ring-amber-500"
                    />
                    <span title="Safe force-push: rejects if remote ref changed independently">
                      Safe force (--force-with-lease)
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePush}
                disabled={activeAction !== null}
                className="w-full py-1.5 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Upload
                  className={`w-3.5 h-3.5 ${activeAction === 'push' ? 'animate-spin' : ''}`}
                />
                <span>{activeAction === 'push' ? 'Pushing...' : 'Run Push'}</span>
              </button>
            </div>
          </div>

          {/* Safety Notice per SAFETY_POLICY.md */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <div>
              <span className="font-semibold">Local-First Safety Policy:</span> Remote
              synchronization is strictly user-triggered. Destructive raw{' '}
              <code className="px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 font-mono">
                --force
              </code>{' '}
              is forbidden in favor of lease-protected verification (
              <code className="px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 font-mono">
                --force-with-lease
              </code>
              ).
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={activeAction !== null}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
