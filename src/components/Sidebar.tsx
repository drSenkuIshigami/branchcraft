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
  Archive,
  RotateCcw,
  History,
  FolderTree,
} from 'lucide-react';
import type { BranchInfo, RemoteInfo, StashInfo, StatusInfo, Theme } from '../types';

interface SidebarProps {
  status: StatusInfo | null;
  branches: BranchInfo[];
  stashes?: StashInfo[];
  remotes?: RemoteInfo[];
  reflogCount?: number;
  worktreesCount?: number;
  selectedView: 'graph' | 'working-tree' | 'stashes' | 'reflog' | 'worktrees';
  onSelectView: (view: 'graph' | 'working-tree' | 'stashes' | 'reflog' | 'worktrees') => void;
  onOpenRepoDialog: () => void;
  onSwitchBranch: (name: string) => Promise<void>;
  onOpenCreateBranch: (startSha?: string, refName?: string) => void;
  onOpenRenameBranch: (branchName: string) => void;
  onOpenDeleteBranch: (branchName: string, isHead: boolean) => void;
  onOpenCreateStash?: () => void;
  onOpenAddWorktree?: () => void;
  onOpenResetHard?: () => void;
  onOpenSync?: () => void;
  theme: Theme;
}

export const Sidebar: React.FC<SidebarProps> = ({
  status,
  branches,
  stashes = [],
  remotes = [],
  reflogCount = 0,
  worktreesCount = 1,
  selectedView,
  onSelectView,
  onOpenRepoDialog,
  onSwitchBranch,
  onOpenCreateBranch,
  onOpenRenameBranch,
  onOpenDeleteBranch,
  onOpenCreateStash,
  onOpenAddWorktree,
  onOpenResetHard,
  onOpenSync,
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
          <div className="flex items-center justify-between px-2 py-1">
            <button
              type="button"
              onClick={() => setWorkingTreeOpen(!workingTreeOpen)}
              className="flex items-center gap-1 font-semibold text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              <span className="uppercase tracking-wider">Working Tree</span>
              {workingTreeOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
            {totalDirty > 0 && onOpenResetHard && (
              <button
                type="button"
                onClick={onOpenResetHard}
                className="p-1 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Discard all changes (git reset --hard HEAD)"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

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

        {/* Stashes Navigation Button */}
        <div>
          <div
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors ${
              selectedView === 'stashes'
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium'
                : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectView('stashes')}
              className="flex items-center gap-2 flex-1 text-left min-w-0 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">Stashes</span>
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                {stashes.length}
              </span>
              {onOpenCreateStash && (
                <button
                  type="button"
                  onClick={onOpenCreateStash}
                  className="p-0.5 rounded text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  title="Stash changes"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
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

        {/* Reflog & Emergency Recovery Button (Phase 3 Step 5) */}
        <div>
          <button
            type="button"
            onClick={() => onSelectView('reflog')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors ${
              selectedView === 'reflog'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium'
                : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-purple-500" />
              <span>Reflog & Recovery</span>
            </div>
            {reflogCount > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {reflogCount}
              </span>
            )}
          </button>
        </div>

        {/* Worktrees Navigation (Phase 3 Step 6) */}
        <div>
          <div
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors ${
              selectedView === 'worktrees'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium'
                : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectView('worktrees')}
              className="flex items-center gap-2 flex-1 text-left min-w-0 cursor-pointer"
            >
              <FolderTree className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Worktrees</span>
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {worktreesCount}
              </span>
              {onOpenAddWorktree && (
                <button
                  type="button"
                  onClick={onOpenAddWorktree}
                  className="p-0.5 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  title="Add new linked worktree"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
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

              {(remoteBranches.length > 0 || remotes.length > 0) && (
                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 mt-2">
                  <div className="flex items-center justify-between px-2 py-0.5">
                    <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                      Remotes
                    </div>
                    {onOpenSync && (
                      <button
                        type="button"
                        onClick={onOpenSync}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                        title="Remote sync (fetch, pull, push)"
                      >
                        <Globe className="w-2.5 h-2.5" />
                        <span>Sync...</span>
                      </button>
                    )}
                  </div>
                  {remoteBranches.map((b) => (
                    <div
                      key={b.name}
                      className="flex items-center justify-between px-2.5 py-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Globe className="w-3 h-3 shrink-0 text-zinc-400" />
                        <span className="truncate">{b.name}</span>
                      </div>
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
