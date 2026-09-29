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
  ChevronDown,
  ChevronRight,
  Trash2,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import type { RemoteInfo, SyncStatus, PushMode } from '../types';

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
    setUpstream?: boolean,
    mode?: PushMode
  ) => Promise<void>;
  onDeleteRemoteRef?: (
    remote: string,
    refType: 'branch' | 'tag',
    refName: string
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
  onDeleteRemoteRef,
}) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'delete_ref'>('sync');
  const [selectedRemote, setSelectedRemote] = useState<string>(
    syncStatus?.remote_name || (remotes.length > 0 ? remotes[0].name : 'origin')
  );
  const [pruneOnFetch, setPruneOnFetch] = useState<boolean>(true);
  const [pushMode, setPushMode] = useState<PushMode>('normal');
  const [setUpstreamOnPush, setSetUpstreamOnPush] = useState<boolean>(!syncStatus?.has_upstream);
  const [activeAction, setActiveAction] = useState<'fetch' | 'pull' | 'push' | 'delete_ref' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Warning Level 3 Checkboxes for Raw Force Push
  const [rawForceCheck1, setRawForceCheck1] = useState(false);
  const [rawForceCheck2, setRawForceCheck2] = useState(false);
  const [rawForceCheck3, setRawForceCheck3] = useState(false);

  // Mirror push confirmation
  const [mirrorCheck, setMirrorCheck] = useState(false);

  // Delete remote ref state
  const [deleteRefType, setDeleteRefType] = useState<'branch' | 'tag'>('branch');
  const [deleteRefName, setDeleteRefName] = useState('');
  const [deleteRefConfirmed, setDeleteRefConfirmed] = useState(false);

  // Technical details toggle
  const [showTechDetails, setShowTechDetails] = useState(false);

  if (!isOpen) return null;

  const effectiveRemote = selectedRemote || 'origin';
  const aheadCount = syncStatus?.ahead || 0;
  const behindCount = syncStatus?.behind || 0;
  const hasUpstream = Boolean(syncStatus?.has_upstream);
  const remoteObj = remotes.find((r) => r.name === effectiveRemote);
  const sanitizedUrl = remoteObj?.push_url
    ? remoteObj.push_url.replace(/:\/\/[^@]+@/, '://<credentials-redacted>@')
    : '<no-url>';

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

  const canExecutePush = () => {
    if (pushMode === 'raw_force') {
      return rawForceCheck1 && rawForceCheck2 && rawForceCheck3;
    }
    if (pushMode === 'mirror') {
      return mirrorCheck;
    }
    return true;
  };

  const handlePush = async () => {
    if (!canExecutePush()) return;
    setActiveAction('push');
    setActionError(null);
    setActionSuccess(null);
    try {
      const forceWithLease = pushMode === 'force_with_lease';
      await onPush(
        effectiveRemote,
        currentBranch || undefined,
        forceWithLease,
        setUpstreamOnPush,
        pushMode
      );
      const modeLabel =
        pushMode === 'raw_force'
          ? ' (--force)'
          : pushMode === 'force_with_lease'
          ? ' (--force-with-lease)'
          : pushMode === 'mirror'
          ? ' (--mirror)'
          : '';
      setActionSuccess(
        `Successfully pushed ${pushMode === 'mirror' ? 'all refs' : currentBranch || 'HEAD'} to ${effectiveRemote}${modeLabel}.`
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActiveAction(null);
    }
  };

  const handleDeleteRemoteRef = async () => {
    if (!deleteRefName.trim() || !onDeleteRemoteRef || !deleteRefConfirmed) return;
    setActiveAction('delete_ref');
    setActionError(null);
    setActionSuccess(null);
    try {
      await onDeleteRemoteRef(effectiveRemote, deleteRefType, deleteRefName.trim());
      setActionSuccess(
        `Successfully deleted remote ${deleteRefType} "${deleteRefName.trim()}" from ${effectiveRemote}.`
      );
      setDeleteRefName('');
      setDeleteRefConfirmed(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActiveAction(null);
    }
  };

  const getExactPushCommand = () => {
    const parts = ['git', 'push'];
    if (setUpstreamOnPush && pushMode !== 'mirror') parts.push('-u');
    if (pushMode === 'force_with_lease') parts.push('--force-with-lease');
    if (pushMode === 'raw_force') parts.push('--force');
    if (pushMode === 'mirror') parts.push('--mirror');
    parts.push(effectiveRemote);
    if (pushMode !== 'mirror' && currentBranch) parts.push(currentBranch);
    return parts.join(' ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
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
                Full Git capability with user-controlled risk policy &amp; explicit consent
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

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/20 px-5 pt-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`pb-2 px-3 font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'sync'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Fetch, Pull &amp; Push
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('delete_ref')}
            className={`pb-2 px-3 font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'delete_ref'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Delete Remote Branch / Tag
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
                    {r.name} ({r.push_url || r.fetch_url || 'no url'})
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

          {activeTab === 'sync' ? (
            <>
              {/* Action Grid: Fetch, Pull */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* 1. Fetch */}
                <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                        <span>Fetch</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">
                        Warning Level 0
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      Downloads objects without altering working tree.
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                        <Download className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Pull</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">
                        Warning Level 1
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      Fetches and integrates remote commits into active branch.
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
              </div>

              {/* 3. Push Section with Full User Choice Model */}
              <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                    <Upload className="w-4 h-4 text-indigo-500" />
                    <span>Push to Remote</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                      pushMode === 'raw_force' || pushMode === 'mirror'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : pushMode === 'force_with_lease'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    Warning Level {pushMode === 'raw_force' || pushMode === 'mirror' ? '3' : pushMode === 'force_with_lease' ? '2' : '1'}
                  </span>
                </div>

                {/* Push Mode Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block">
                    Push Strategy &amp; Safety Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <label
                      className={`p-2 rounded-lg border cursor-pointer transition-colors flex items-start gap-2 ${
                        pushMode === 'normal'
                          ? 'border-blue-500/60 bg-blue-500/5 dark:bg-blue-500/10'
                          : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="push-mode"
                        value="normal"
                        checked={pushMode === 'normal'}
                        onChange={() => setPushMode('normal')}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">Normal Push</div>
                        <div className="text-[10px] text-zinc-500">Standard fast-forward push</div>
                      </div>
                    </label>

                    <label
                      className={`p-2 rounded-lg border cursor-pointer transition-colors flex items-start gap-2 ${
                        pushMode === 'force_with_lease'
                          ? 'border-amber-500/60 bg-amber-500/5 dark:bg-amber-500/10'
                          : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="push-mode"
                        value="force_with_lease"
                        checked={pushMode === 'force_with_lease'}
                        onChange={() => setPushMode('force_with_lease')}
                        className="mt-0.5 accent-amber-600"
                      />
                      <div>
                        <div className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <span>--force-with-lease</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono">
                            Recommended
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500">Safe lease verification</div>
                      </div>
                    </label>

                    <label
                      className={`p-2 rounded-lg border cursor-pointer transition-colors flex items-start gap-2 ${
                        pushMode === 'raw_force'
                          ? 'border-rose-500/60 bg-rose-500/5 dark:bg-rose-500/10'
                          : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="push-mode"
                        value="raw_force"
                        checked={pushMode === 'raw_force'}
                        onChange={() => setPushMode('raw_force')}
                        className="mt-0.5 accent-rose-600"
                      />
                      <div>
                        <div className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <span>Raw --force</span>
                          <Flame className="w-3 h-3 text-rose-500" />
                        </div>
                        <div className="text-[10px] text-zinc-500">Unconditional remote overwrite</div>
                      </div>
                    </label>

                    <label
                      className={`p-2 rounded-lg border cursor-pointer transition-colors flex items-start gap-2 ${
                        pushMode === 'mirror'
                          ? 'border-purple-500/60 bg-purple-500/5 dark:bg-purple-500/10'
                          : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="push-mode"
                        value="mirror"
                        checked={pushMode === 'mirror'}
                        onChange={() => setPushMode('mirror')}
                        className="mt-0.5 accent-purple-600"
                      />
                      <div>
                        <div className="font-semibold text-purple-600 dark:text-purple-400">--mirror</div>
                        <div className="text-[10px] text-zinc-500">Mirror all local branches &amp; tags</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Set upstream checkbox */}
                {pushMode !== 'mirror' && (
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-600 dark:text-zinc-400 pt-1">
                    <input
                      type="checkbox"
                      checked={setUpstreamOnPush}
                      onChange={(e) => setSetUpstreamOnPush(e.target.checked)}
                      disabled={activeAction !== null}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Set upstream tracking branch (-u)</span>
                  </label>
                )}

                {/* Requested Operation CLI representation */}
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Requested Operation</span>
                    {pushMode === 'raw_force' && (
                      <span className="text-amber-600 dark:text-amber-400 font-normal normal-case">
                        Recommended: git push --force-with-lease {effectiveRemote} {currentBranch || 'HEAD'}
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 rounded bg-zinc-950 text-zinc-200 font-mono text-xs border border-zinc-800 select-all overflow-x-auto">
                    {getExactPushCommand()}
                  </div>
                </div>

                {/* Warning Level 3 Impact & Confirmations for Raw Force */}
                {pushMode === 'raw_force' && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>Warning Level 3: Destructive Remote Overwrite</span>
                    </div>

                    <div className="text-[11px] text-rose-800/90 dark:text-rose-300/90 space-y-1">
                      <p className="font-semibold">Potential Impact:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>The remote branch history will be overwritten.</li>
                        <li>Commits pushed by other collaborators may be lost from that remote branch.</li>
                        <li>Existing pull requests and commit links may change or break.</li>
                        <li>Collaborators with old clones may need to rebase, reset, or re-clone.</li>
                      </ul>
                      <p className="pt-1 font-mono text-[10px]">
                        Target remote: <strong>{effectiveRemote}</strong> &rarr; {sanitizedUrl}
                      </p>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-rose-200 dark:border-rose-800/40 text-[11px]">
                      <label className="flex items-start gap-2 cursor-pointer text-zinc-800 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          checked={rawForceCheck1}
                          onChange={(e) => setRawForceCheck1(e.target.checked)}
                          className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                        />
                        <span>I understand that raw --force can overwrite remote commits.</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer text-zinc-800 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          checked={rawForceCheck2}
                          onChange={(e) => setRawForceCheck2(e.target.checked)}
                          className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                        />
                        <span>I understand that --force-with-lease is safer but I intentionally selected raw --force.</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer text-zinc-800 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          checked={rawForceCheck3}
                          onChange={(e) => setRawForceCheck3(e.target.checked)}
                          className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                        />
                        <span>I reviewed the target remote and branch ({effectiveRemote} / {currentBranch || 'HEAD'}).</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Mirror Push Warning */}
                {pushMode === 'mirror' && (
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-purple-600" />
                      <span>Warning Level 3: Repository Mirror Push</span>
                    </div>
                    <p className="text-[11px] text-purple-900 dark:text-purple-200 leading-relaxed">
                      Mirroring pushes all local branches, tags, and references directly to{' '}
                      <code className="font-mono font-bold">{effectiveRemote}</code>, overwriting
                      remote state to match the local repository.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-zinc-800 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={mirrorCheck}
                        onChange={(e) => setMirrorCheck(e.target.checked)}
                        className="mt-0.5 rounded border-purple-400 text-purple-600 focus:ring-purple-500"
                      />
                      <span>I understand that --mirror overwrites all remote refs to match local state.</span>
                    </label>
                  </div>
                )}

                {/* Push Execute Button */}
                <button
                  type="button"
                  onClick={handlePush}
                  disabled={activeAction !== null || !canExecutePush()}
                  className={`w-full py-2 px-4 rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    pushMode === 'raw_force'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : pushMode === 'mirror'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : pushMode === 'force_with_lease'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <Upload
                    className={`w-3.5 h-3.5 ${activeAction === 'push' ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {activeAction === 'push'
                      ? 'Pushing...'
                      : pushMode === 'raw_force'
                      ? 'Execute git push --force'
                      : pushMode === 'mirror'
                      ? 'Execute git push --mirror'
                      : pushMode === 'force_with_lease'
                      ? 'Execute git push --force-with-lease'
                      : 'Run Standard Push'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            /* Delete Remote Reference Tab */
            <div className="p-4 rounded-lg border border-rose-200 dark:border-rose-800/40 bg-rose-50/30 dark:bg-rose-950/20 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold text-sm">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Delete Remote Branch or Tag</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono">
                  Warning Level 3
                </span>
              </div>

              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Permanently deletes a branch or tag from the remote repository (
                <code className="font-mono">git push &lt;remote&gt; --delete &lt;ref&gt;</code>).
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Reference Type
                  </label>
                  <select
                    value={deleteRefType}
                    onChange={(e) => setDeleteRefType(e.target.value as 'branch' | 'tag')}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                  >
                    <option value="branch">Branch</option>
                    <option value="tag">Tag</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
                    Reference Name
                  </label>
                  <input
                    type="text"
                    value={deleteRefName}
                    onChange={(e) => setDeleteRefName(e.target.value)}
                    placeholder={deleteRefType === 'branch' ? 'feature/legacy-code' : 'v0.1.0'}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                </div>
              </div>

              {deleteRefName.trim() && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Requested Operation
                  </span>
                  <div className="p-2 rounded bg-zinc-950 text-zinc-200 font-mono text-xs border border-zinc-800">
                    git push {effectiveRemote} --delete {deleteRefType === 'tag' ? `refs/tags/${deleteRefName.trim()}` : deleteRefName.trim()}
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2 cursor-pointer text-[11px] text-zinc-800 dark:text-zinc-200 pt-1">
                <input
                  type="checkbox"
                  checked={deleteRefConfirmed}
                  onChange={(e) => setDeleteRefConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  I understand this permanently removes the reference from the remote server.
                </span>
              </label>

              <button
                type="button"
                onClick={handleDeleteRemoteRef}
                disabled={!deleteRefName.trim() || !deleteRefConfirmed || activeAction !== null}
                className="w-full py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {activeAction === 'delete_ref'
                    ? 'Deleting Reference...'
                    : `Execute git push ${effectiveRemote} --delete ${deleteRefName.trim() || '<ref>'}`}
                </span>
              </button>
            </div>
          )}

          {/* Technical Details Disclosure Section */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium cursor-pointer"
            >
              {showTechDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>View Technical Details &amp; Informed Consent Disclosures</span>
            </button>

            {showTechDetails && (
              <div className="mt-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/30 text-[10px] font-mono space-y-1 text-zinc-600 dark:text-zinc-400">
                <div>Operation: {activeTab === 'delete_ref' ? 'Remote Ref Deletion' : `Push (${pushMode})`}</div>
                <div>Target Remote: {effectiveRemote} ({sanitizedUrl})</div>
                <div>Current Branch: {currentBranch || 'HEAD'}</div>
                <div>Upstream State: {hasUpstream ? syncStatus?.upstream_name : 'None'}</div>
                <div>Rollback Mechanism: Git reflog or remote branch restore via commit SHA</div>
                <div>Refusal Boundaries: Technical failures only (network timeout, authentication failure, invalid ref format). Policy never blocks user consent.</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>User-Controlled Risk Policy: Informed consent, no feature restriction</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={activeAction !== null}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
