import React, { useState } from 'react';
import {
  GitBranch,
  FolderGit2,
  FileCheck,
  FileEdit,
  FileQuestion,
  AlertTriangle,
  Tag,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Globe,
  PlusCircle,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { BranchInfo, StatusInfo, Theme } from '../types';

interface SidebarProps {
  status: StatusInfo | null;
  branches: BranchInfo[];
  selectedView: 'graph' | 'working-tree';
  onSelectView: (view: 'graph' | 'working-tree') => void;
  onOpenRepoDialog: () => void;
  onSwitchBranch: (name: string) => Promise<void>;
  onOpenCreateBranch: (startSha?: string, refName?: string) => void;
  onOpenRenameBranch: (branchName: string) => void;
  onOpenDeleteBranch: (branchName: string, isHead: boolean) => void;
  theme: Theme;
}

export const Sidebar: React.FC<SidebarProps> = ({
  status,
  branches,
  selectedView,
  onSelectView,
  onOpenRepoDialog,
  onSwitchBranch,
  onOpenCreateBranch,
  onOpenRenameBranch,
  onOpenDeleteBranch,
}) => {
  const [branchesOpen, setBranchesOpen] = useState(true);
  const [workingTreeOpen, setWorkingTreeOpen] = useState(true);

  const localBranches = branches.filter((b) => b.is_local);
  const remoteBranches = branches.filter((b) => b.is_remote);

  const stagedCount = status?.staged.length || 0;
  const unstagedCount = status?.unstaged.length || 0;
  const untrackedCount = status?.untracked.length || 0;
  const conflictedCount = status?.conflicted.length || 0;
  const totalDirty = stagedCount + unstagedCount + untrackedCount;

  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col h-full select-none text-xs shrink-0">
      {/* Repository Header */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200 truncate">
            <FolderGit2 className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="truncate">
              {status ? status.root_path.split('/').pop() || 'Repository' : 'No Repository'}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenRepoDialog}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            title="Open / Change Repository"
          >
            <PlusCircle className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 font-mono truncate" title={status?.root_path || ''}>
          {status?.root_path || 'Open a Git repository to begin'}
        </p>
      </div>

      {/* Navigation & Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Working Tree Section */}
        <div>
          <button
            type="button"
            onClick={() => setWorkingTreeOpen(!workingTreeOpen)}
            className="w-full flex items-center justify-between px-2 py-1 font-semibold text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <span className="uppercase tracking-wider">Working Tree</span>
            {workingTreeOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          {workingTreeOpen && (
            <div className="mt-1 space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectView('working-tree')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors ${
                  selectedView === 'working-tree'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                    : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileEdit className="w-3.5 h-3.5 text-blue-500" />
                  <span>Uncommitted Changes</span>
                </div>
                {totalDirty > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {totalDirty}
                  </span>
                )}
              </button>

              {stagedCount > 0 && (
                <div className="flex items-center justify-between px-3 py-1 text-zinc-500 pl-6 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <FileCheck className="w-3 h-3" />
                    <span>Staged</span>
                  </div>
                  <span className="font-mono text-[10px]">{stagedCount}</span>
                </div>
              )}

              {unstagedCount > 0 && (
                <div className="flex items-center justify-between px-3 py-1 text-zinc-500 pl-6 text-[11px]">
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <FileEdit className="w-3 h-3" />
                    <span>Modified</span>
                  </div>
                  <span className="font-mono text-[10px]">{unstagedCount}</span>
                </div>
              )}

              {untrackedCount > 0 && (
                <div className="flex items-center justify-between px-3 py-1 text-zinc-500 pl-6 text-[11px]">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <FileQuestion className="w-3 h-3" />
                    <span>Untracked</span>
                  </div>
                  <span className="font-mono text-[10px]">{untrackedCount}</span>
                </div>
              )}

              {conflictedCount > 0 && (
                <div className="flex items-center justify-between px-3 py-1 text-rose-500 pl-6 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Conflicted</span>
                  </div>
                  <span className="font-mono text-[10px]">{conflictedCount}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Commit Graph View Button */}
        <div>
          <button
            type="button"
            onClick={() => onSelectView('graph')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors ${
              selectedView === 'graph'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-blue-500" />
              <span>Commit Graph</span>
            </div>
            <span className="font-mono text-[10px] text-zinc-400">All Refs</span>
          </button>
        </div>

        {/* Branches Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1">
            <button
              type="button"
              onClick={() => setBranchesOpen(!branchesOpen)}
              className="flex items-center gap-1 font-semibold text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              <span className="uppercase tracking-wider">Local Branches</span>
              {branchesOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onOpenCreateBranch()}
              className="p-1 rounded text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
              title="Create New Branch"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {branchesOpen && (
            <div className="mt-1 space-y-0.5">
              {localBranches.length === 0 ? (
                <div className="px-3 py-1 text-zinc-400 italic text-[11px]">No branches</div>
              ) : (
                localBranches.map((b) => (
                  <div
                    key={b.name}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-mono transition-colors ${
                      b.is_head
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => !b.is_head && onSwitchBranch(b.name)}
                      className={`flex items-center gap-2 truncate text-left flex-1 min-w-0 ${
                        !b.is_head ? 'cursor-pointer hover:underline' : 'cursor-default'
                      }`}
                      title={b.is_head ? 'Current HEAD branch' : `Switch to ${b.name}`}
                    >
                      <GitBranch className="w-3 h-3 shrink-0" />
                      <span className="truncate">{b.name}</span>
                      {b.is_head && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 uppercase shrink-0">
                          HEAD
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {(b.ahead > 0 || b.behind > 0) && (
                        <div className="flex items-center gap-1 text-[10px] mr-1">
                          {b.ahead > 0 && (
                            <span
                              className="flex items-center text-blue-500"
                              title={`${b.ahead} ahead`}
                            >
                              <ArrowUp className="w-2.5 h-2.5" />
                              {b.ahead}
                            </span>
                          )}
                          {b.behind > 0 && (
                            <span
                              className="flex items-center text-amber-500"
                              title={`${b.behind} behind`}
                            >
                              <ArrowDown className="w-2.5 h-2.5" />
                              {b.behind}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Branch Actions on hover */}
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRenameBranch(b.name);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                          title={`Rename branch ${b.name}`}
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        {!b.is_head && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDeleteBranch(b.name, b.is_head);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title={`Delete branch ${b.name}`}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {remoteBranches.length > 0 && (
                <div className="pt-2">
                  <div className="px-2 py-0.5 text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                    Remotes
                  </div>
                  {remoteBranches.map((b) => (
                    <div
                      key={b.name}
                      className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      <Globe className="w-3 h-3 shrink-0" />
                      <span className="truncate">{b.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 text-[11px] text-zinc-500 flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1">
          <Tag className="w-3 h-3 text-zinc-400" />
          <span>Phase 1 (Read-Only)</span>
        </span>
        <span className="text-[10px] opacity-75 font-mono">Risk Level 0</span>
      </div>
    </aside>
  );
};
