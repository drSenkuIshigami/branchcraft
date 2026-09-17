import React from 'react';
import {
  FileEdit,
  FileCheck,
  FileQuestion,
  AlertTriangle,
  Plus,
  Minus,
  FileText,
  FilePlus,
  FileMinus,
  RefreshCw,
} from 'lucide-react';
import type { StatusInfo, FileChange, Theme } from '../types';

interface WorkingTreePanelProps {
  status: StatusInfo | null;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  onRefresh: () => void;
  loading: boolean;
  theme: Theme;
}

export const WorkingTreePanel: React.FC<WorkingTreePanelProps> = ({
  status,
  selectedFile,
  onSelectFile,
  onRefresh,
  loading,
}) => {
  if (!status) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 p-6 text-xs">
        No active repository status available.
      </div>
    );
  }

  const { staged, unstaged, untracked, conflicted } = status;
  const isClean =
    staged.length === 0 &&
    unstaged.length === 0 &&
    untracked.length === 0 &&
    conflicted.length === 0;

  const renderFileRow = (
    file: FileChange | { path: string; change_type?: string },
    isStaged: boolean
  ) => {
    const isSelected = selectedFile === file.path;
    return (
      <button
        key={`${isStaged ? 'staged' : 'unstaged'}-${file.path}`}
        type="button"
        onClick={() => onSelectFile(file.path)}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors rounded ${
          isSelected
            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {file.change_type === 'Added' ? (
            <FilePlus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : file.change_type === 'Deleted' ? (
            <FileMinus className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          )}
          <span className="font-mono truncate">{file.path}</span>
        </div>
        <span className="font-mono text-[10px] text-zinc-400 shrink-0 uppercase">
          {file.change_type || 'untracked'}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-blue-500" />
            Working Tree Status
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Branch:{' '}
            <span className="font-mono text-zinc-700 dark:text-zinc-300">
              {status.current_branch || 'HEAD (detached)'}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-200/70 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isClean ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400">
          <FileCheck className="w-10 h-10 text-emerald-500 mb-2 stroke-1" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Working tree clean</p>
          <p className="text-xs text-zinc-500 mt-1">
            No unstaged, staged, or untracked changes in the current directory.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Conflicted */}
          {conflicted.length > 0 && (
            <div className="border border-rose-500/30 bg-rose-500/5 rounded-lg p-3">
              <div className="flex items-center gap-2 font-semibold text-rose-600 dark:text-rose-400 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Unmerged / Conflicted Files ({conflicted.length})</span>
              </div>
              <div className="space-y-1">
                {conflicted.map((path) => (
                  <div key={path} className="font-mono text-xs text-rose-700 dark:text-rose-300">
                    {path}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staged */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <FileCheck className="w-4 h-4" />
                <span>Staged Changes ({staged.length})</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Index</span>
            </div>
            {staged.length === 0 ? (
              <p className="text-[11px] text-zinc-400 italic">No staged changes</p>
            ) : (
              <div className="space-y-0.5">{staged.map((f) => renderFileRow(f, true))}</div>
            )}
          </div>

          {/* Unstaged */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                <FileEdit className="w-4 h-4" />
                <span>Modified Files ({unstaged.length})</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Worktree</span>
            </div>
            {unstaged.length === 0 ? (
              <p className="text-[11px] text-zinc-400 italic">No modified files</p>
            ) : (
              <div className="space-y-0.5">{unstaged.map((f) => renderFileRow(f, false))}</div>
            )}
          </div>

          {/* Untracked */}
          {untracked.length > 0 && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-500 dark:text-zinc-400">
                  <FileQuestion className="w-4 h-4" />
                  <span>Untracked Files ({untracked.length})</span>
                </div>
              </div>
              <div className="space-y-0.5">
                {untracked.map((path) => renderFileRow({ path, change_type: 'Untracked' }, false))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
