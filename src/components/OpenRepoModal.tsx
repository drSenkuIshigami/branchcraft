import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  X,
  Sparkles,
  FolderOpen,
  ArrowRight,
  AlertCircle,
  FolderSearch,
  Clock,
  Trash2,
  HardDrive,
  Loader2,
} from 'lucide-react';
import type { Theme } from '../types';
import { pickFolder } from '../ipc';

interface OpenRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPath: (path: string) => Promise<void>;
  onOpenSample: () => Promise<void>;
  theme: Theme;
}

const RECENT_REPOS_KEY = 'git_workbench_recent_repos';

export const OpenRepoModal: React.FC<OpenRepoModalProps> = ({
  isOpen,
  onClose,
  onOpenPath,
  onOpenSample,
}) => {
  const [inputPath, setInputPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentRepos, setRecentRepos] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem(RECENT_REPOS_KEY);
        if (stored) {
          const list: string[] = JSON.parse(stored);
          if (Array.isArray(list)) {
            setRecentRepos(list.filter(Boolean));
          }
        }
      } catch {
        setRecentRepos([]);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBrowseOSFolder = async () => {
    setPickingFolder(true);
    setError(null);
    try {
      const selected = await pickFolder();
      if (selected && selected.trim()) {
        const trimmed = selected.trim();
        setInputPath(trimmed);
        setLoading(true);
        await onOpenPath(trimmed);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setPickingFolder(false);
      setLoading(false);
    }
  };

  const handleOpenRecent = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      await onOpenPath(path);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClearRecent = () => {
    try {
      localStorage.removeItem(RECENT_REPOS_KEY);
      setRecentRepos([]);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPath.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onOpenPath(inputPath.trim());
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSample = async () => {
    setLoading(true);
    setError(null);
    try {
      await onOpenSample();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getFolderName = (p: string) => {
    return p.split(/[\\/]/).filter(Boolean).pop() || p;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Open Git Repository</h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Select a local folder on your computer or launch the sandbox
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-medium text-xs">Failed to open repository</span>
                <p className="text-[11px] opacity-90 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Primary Action: OS Folder Dialog */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                <HardDrive className="w-4 h-4 text-blue-500" />
                Select from Computer
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-mono">
                OS Dialog
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Opens your operating system&apos;s native file explorer dialog (Windows Explorer, Finder, or Linux file picker) to choose any Git repository.
            </p>
            <button
              type="button"
              onClick={handleBrowseOSFolder}
              disabled={loading || pickingFolder}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {pickingFolder ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Waiting for OS folder selection...</span>
                </>
              ) : (
                <>
                  <FolderSearch className="w-4 h-4" />
                  <span>Open Folder Dialog (Browse OS)...</span>
                </>
              )}
            </button>
          </div>

          {/* Recent Repositories */}
          {recentRepos.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Recent Repositories
                </span>
                <button
                  type="button"
                  onClick={handleClearRecent}
                  className="text-[10px] text-zinc-400 hover:text-rose-500 flex items-center gap-0.5 transition-colors cursor-pointer"
                  title="Clear recent repositories"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Clear
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900/60">
                {recentRepos.slice(0, 5).map((rPath, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOpenRecent(rPath)}
                    disabled={loading}
                    className="w-full flex items-center justify-between p-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <FolderGit2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-xs text-zinc-800 dark:text-zinc-200 truncate">
                          {getFolderName(rPath)}
                        </div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate max-w-sm">
                          {rPath}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Path Form */}
          <div className="space-y-2 pt-1">
            <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
              Or Enter Repository File Path Manually:
            </label>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <FolderOpen className="w-4 h-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inputPath}
                  onChange={(e) => setInputPath(e.target.value)}
                  placeholder="C:\Users\Name\Projects\my-repo  or  /path/to/repo"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !inputPath.trim()}
                className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-medium transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              >
                {loading ? 'Opening...' : 'Open'}
              </button>
            </form>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">or test</span>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {/* Quick Sandbox option */}
          <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                Interactive Sample Sandbox
              </span>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                Pre-populated demo repo with branches, merges, and tags.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSample}
              disabled={loading}
              className="py-1 px-3 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer shrink-0"
            >
              Launch Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
