import React, { useState } from 'react';
import {
  FolderGit2,
  RefreshCw,
  Layers,
  Database,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  ArrowUpRight,
  ShieldCheck,
  FileCode,
  HardDrive,
} from 'lucide-react';
import type { SubmoduleInfo, LfsDiagnostics, OperationResult } from '../types';

interface SubmodulesAndLfsModalProps {
  isOpen: boolean;
  onClose: () => void;
  submodules: SubmoduleInfo[];
  lfsDiagnostics: LfsDiagnostics | null;
  onUpdateSubmodules: (recursive: boolean) => Promise<OperationResult>;
  onRefreshData: () => Promise<void>;
  onOpenSubmoduleRepo?: (submodulePath: string) => void;
}

export const SubmodulesAndLfsModal: React.FC<SubmodulesAndLfsModalProps> = ({
  isOpen,
  onClose,
  submodules,
  lfsDiagnostics,
  onUpdateSubmodules,
  onRefreshData,
  onOpenSubmoduleRepo,
}) => {
  const [activeTab, setActiveTab] = useState<'submodules' | 'lfs'>('submodules');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdate = async (recursive = true) => {
    setIsUpdating(true);
    setUpdateResult(null);
    try {
      const res = await onUpdateSubmodules(recursive);
      setUpdateResult(res.stdout || (res.success ? 'Submodules updated successfully.' : 'Submodule update failed.'));
      await onRefreshData();
    } catch (err: unknown) {
      setUpdateResult(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Submodules &amp; Git LFS Dashboard
              </h2>
              <p className="text-[11px] text-zinc-500">
                Track nested git repositories and large binary media objects (Phase 3 Power Tools)
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
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 pt-2 bg-zinc-50/30 dark:bg-zinc-800/20 shrink-0 justify-between items-center">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('submodules')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'submodules'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Submodules ({submodules.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lfs')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'lfs'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Git LFS Diagnostics</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="mb-2 p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
            title="Refresh status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {updateResult && (
            <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[11px] whitespace-pre-wrap border border-zinc-200 dark:border-zinc-700">
              {updateResult}
            </div>
          )}

          {activeTab === 'submodules' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                    Configured Git Submodules
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Run git submodule status &amp; recursive initialization
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(true)}
                    disabled={isUpdating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 cursor-pointer text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                    <span>{isUpdating ? 'Updating...' : 'Sync & Update Recursive'}</span>
                  </button>
                </div>
              </div>

              {submodules.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">No submodules configured in this repository.</p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    To add a submodule via CLI: <code>git submodule add &lt;url&gt; &lt;path&gt;</code>
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {submodules.map((sub) => (
                    <div
                      key={sub.path}
                      className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-between"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-[13px]">
                            {sub.path}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              sub.status === 'clean'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : sub.status === 'uninitialized'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                          <span>HEAD commit: {sub.short_head || sub.head_sha}</span>
                        </div>
                      </div>

                      {onOpenSubmoduleRepo && (
                        <button
                          type="button"
                          onClick={() => onOpenSubmoduleRepo(sub.path)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer text-xs"
                          title="Open submodule directory in Git Workbench"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Open</span>
                          <ArrowUpRight className="w-3 h-3 text-zinc-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    Git LFS Binary Support
                  </span>
                  {lfsDiagnostics?.is_installed ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Git LFS Installed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      LFS Binary Not Found
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Git Large File Storage (LFS) replaces large files such as audio samples, videos, datasets, and graphics with text pointers inside Git, storing file contents on remote servers.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs mb-2 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-zinc-500" />
                  Tracked LFS Patterns in <code>.gitattributes</code>
                </h4>
                {lfsDiagnostics?.tracked_patterns && lfsDiagnostics.tracked_patterns.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {lfsDiagnostics.tracked_patterns.map((pat) => (
                      <span
                        key={pat}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-zinc-700 dark:text-zinc-300 text-xs flex items-center gap-1"
                      >
                        <HardDrive className="w-3 h-3 text-indigo-500" />
                        {pat}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-400 dark:text-zinc-500 text-[11px] italic">
                    No active <code>filter=lfs</code> patterns detected in repository root <code>.gitattributes</code>.
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-indigo-700 dark:text-indigo-300 text-[11px]">
                <p className="font-semibold mb-1">Recommended LFS Tracking Commands:</p>
                <code className="font-mono block bg-black/5 dark:bg-black/20 p-2 rounded text-[11px]">
                  git lfs install<br />
                  git lfs track &quot;*.psd&quot; &quot;*.zip&quot; &quot;*.mp4&quot; &quot;*.weights&quot;<br />
                  git add .gitattributes
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/40 shrink-0">
          <span className="text-[11px] text-zinc-400 font-mono">
            CLI: git submodule status / git lfs version
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
