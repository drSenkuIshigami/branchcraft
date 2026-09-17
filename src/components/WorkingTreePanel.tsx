import React, { useState } from 'react';
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
  Trash2,
  CheckCheck,
} from 'lucide-react';
import type { StatusInfo, FileChange, Theme } from '../types';
import { DiscardConfirmModal } from './DiscardConfirmModal';
import { CommitBox } from './CommitBox';

interface WorkingTreePanelProps {
  status: StatusInfo | null;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  onRefresh: () => void;
  onStageFile: (filePath: string) => Promise<void>;
  onUnstageFile: (filePath: string) => Promise<void>;
  onDiscardFile: (filePath: string, isUntracked: boolean) => Promise<void>;
  onStageAll: () => Promise<void>;
  onUnstageAll: () => Promise<void>;
  onCommit: (message: string, isAmend: boolean) => Promise<void>;
  lastCommitMessage?: string;
  loading: boolean;
  theme: Theme;
}

export const WorkingTreePanel: React.FC<WorkingTreePanelProps> = ({
  status,
  selectedFile,
  onSelectFile,
  onRefresh,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onStageAll,
  onUnstageAll,
  onCommit,
  lastCommitMessage,
  loading,
  theme,
}) => {
  const [actionLoadingPath, setActionLoadingPath] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState<string | null>(null);
  const [discardTarget, setDiscardTarget] = useState<{ path: string; isUntracked: boolean } | null>(
    null
  );

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

  const handleStage = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setActionLoadingPath(path);
    try {
      await onStageFile(path);
    } finally {
      setActionLoadingPath(null);
    }
  };

  const handleUnstage = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setActionLoadingPath(path);
    try {
      await onUnstageFile(path);
    } finally {
      setActionLoadingPath(null);
    }
  };

  const handleDiscardClick = (e: React.MouseEvent, path: string, isUntracked: boolean) => {
    e.stopPropagation();
    setDiscardTarget({ path, isUntracked });
  };

  const handleStageAll = async () => {
    setBatchLoading('stage');
    try {
      await onStageAll();
    } finally {
      setBatchLoading(null);
    }
  };

  const handleUnstageAll = async () => {
    setBatchLoading('unstage');
    try {
      await onUnstageAll();
    } finally {
      setBatchLoading(null);
    }
  };

  const renderFileRow = (
    file: FileChange | { path: string; change_type?: string },
    isStaged: boolean,
    isUntracked = false
  ) => {
    const isSelected = selectedFile === file.path;
    const isRowLoading = actionLoadingPath === file.path;

    return (
      <div
        key={`${isStaged ? 'staged' : 'unstaged'}-${file.path}`}
        onClick={() => onSelectFile(file.path)}
        className={`w-full group flex items-center justify-between px-2.5 py-1.5 text-xs transition-colors rounded cursor-pointer ${
          isSelected
            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
        }`}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0 mr-2">
          {file.change_type === 'Added' ? (
            <FilePlus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : file.change_type === 'Deleted' ? (
            <FileMinus className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          ) : isUntracked ? (
            <FileQuestion className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          )}
          <span className="font-mono truncate">{file.path}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[10px] text-zinc-400 uppercase hidden sm:inline mr-1">
            {file.change_type || (isUntracked ? 'Untracked' : 'Modified')}
          </span>

          {/* Action buttons on hover or selection */}
          {isStaged ? (
            <button
              type="button"
              onClick={(e) => handleUnstage(e, file.path)}
              disabled={isRowLoading}
              title="Unstage changes (git restore --staged)"
              className="p-1 rounded text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => handleDiscardClick(e, file.path, isUntracked)}
                disabled={isRowLoading}
                title="Discard changes with preview"
                className="p-1 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => handleStage(e, file.path)}
                disabled={isRowLoading}
                title="Stage changes (git add)"
                className="p-1 rounded text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
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

          {/* Staged Section */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <FileCheck className="w-4 h-4" />
                <span>Staged Changes ({staged.length})</span>
              </div>
              {staged.length > 0 && (
                <button
                  type="button"
                  onClick={handleUnstageAll}
                  disabled={batchLoading !== null}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 font-medium transition-colors"
                  title="Unstage all staged files"
                >
                  <Minus className="w-3 h-3" />
                  <span>Unstage All</span>
                </button>
              )}
            </div>
            {staged.length === 0 ? (
              <p className="text-[11px] text-zinc-400 italic">No staged changes</p>
            ) : (
              <div className="space-y-0.5">{staged.map((f) => renderFileRow(f, true))}</div>
            )}
          </div>

          {/* Unstaged Section */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                <FileEdit className="w-4 h-4" />
                <span>Modified Files ({unstaged.length})</span>
              </div>
              {(unstaged.length > 0 || untracked.length > 0) && (
                <button
                  type="button"
                  onClick={handleStageAll}
                  disabled={batchLoading !== null}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium transition-colors"
                  title="Stage all modified & untracked files"
                >
                  <CheckCheck className="w-3 h-3 text-emerald-500" />
                  <span>Stage All</span>
                </button>
              )}
            </div>
            {unstaged.length === 0 ? (
              <p className="text-[11px] text-zinc-400 italic">No modified files</p>
            ) : (
              <div className="space-y-0.5">{unstaged.map((f) => renderFileRow(f, false))}</div>
            )}
          </div>

          {/* Untracked Section */}
          {untracked.length > 0 && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-500 dark:text-zinc-400">
                  <FileQuestion className="w-4 h-4" />
                  <span>Untracked Files ({untracked.length})</span>
                </div>
              </div>
              <div className="space-y-0.5">
                {untracked.map((path) =>
                  renderFileRow({ path, change_type: 'Untracked' }, false, true)
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Commit Authoring Area (Always accessible or positioned neatly) */}
      <div className="pt-2">
        <CommitBox
          stagedCount={staged.length}
          lastCommitMessage={lastCommitMessage}
          onCommit={onCommit}
          loading={loading}
          theme={theme}
        />
      </div>

      {/* Discard Confirmation Modal */}
      <DiscardConfirmModal
        isOpen={discardTarget !== null}
        filePath={discardTarget?.path || null}
        isUntracked={discardTarget?.isUntracked || false}
        onClose={() => setDiscardTarget(null)}
        onConfirm={async () => {
          if (discardTarget) {
            await onDiscardFile(discardTarget.path, discardTarget.isUntracked);
          }
        }}
        theme={theme}
      />
    </div>
  );
};
