import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Tag,
  GitBranch,
  Copy,
  Check,
  Layers,
  Clock,
  Cherry,
  RotateCcw,
  Undo2,
  ArrowRightLeft,
  MoreHorizontal,
  FileText,
  Plus,
} from 'lucide-react';
import type { CommitInfo, Theme } from '../types';
import { CommitGraphCanvas } from './CommitGraphCanvas';

interface CommitListProps {
  commits: CommitInfo[];
  selectedSha: string | null;
  onSelectCommit: (sha: string) => void;
  onStartInteractiveRebase?: (sha: string, subject: string) => void;
  onCherryPick?: (commit: CommitInfo) => void;
  onRevert?: (commit: CommitInfo) => void;
  onModifyAuthorDate?: (commit: CommitInfo) => void;
  onResetToCommit?: (commit: CommitInfo) => void;
  onForceRelocateBranch?: (commit: CommitInfo) => void;
  onCreateBranchAtCommit?: (sha: string, subject: string) => void;
  loading: boolean;
  theme: Theme;
}

interface ActiveMenuState {
  commit: CommitInfo;
  x?: number;
  y?: number;
  triggerRect?: DOMRect;
}

const ROW_HEIGHT = 40;

export const CommitList: React.FC<CommitListProps> = ({
  commits,
  selectedSha,
  onSelectCommit,
  onStartInteractiveRebase,
  onCherryPick,
  onRevert,
  onModifyAuthorDate,
  onResetToCommit,
  onForceRelocateBranch,
  onCreateBranchAtCommit,
  loading,
  theme,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [copiedMsgSha, setCopiedMsgSha] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Close active dropdown menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!activeMenu) return;

    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    };

    window.addEventListener('pointerdown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenu]);

  const filteredCommits = useMemo(() => {
    const baseList = commits.filter(
      (c) =>
        !c.refs.some((r) => r.includes('refs/stash')) &&
        !c.subject.startsWith('WIP on ') &&
        !c.subject.startsWith('index on ')
    );
    if (!searchTerm.trim()) return baseList;
    const q = searchTerm.toLowerCase();
    return baseList.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q) ||
        c.sha.toLowerCase().startsWith(q) ||
        c.refs.some((r) => r.toLowerCase().includes(q))
    );
  }, [commits, searchTerm]);

  const handleCopySha = (e: React.MouseEvent, sha: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 1500);
  };

  const handleCopyMessage = (e: React.MouseEvent, subject: string, sha: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(subject);
    setCopiedMsgSha(sha);
    setTimeout(() => setCopiedMsgSha(null), 1500);
  };

  const handleToggleMenu = (e: React.MouseEvent, commit: CommitInfo) => {
    e.stopPropagation();
    if (activeMenu?.commit.sha === commit.sha) {
      setActiveMenu(null);
    } else {
      const buttonRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setActiveMenu({
        commit,
        triggerRect: buttonRect,
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, commit: CommitInfo) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectCommit(commit.sha);
    setActiveMenu({
      commit,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 30) return date.toLocaleDateString();
      if (diffDays > 0) return `${diffDays}d ago`;
      if (diffHours > 0) return `${diffHours}h ago`;
      if (diffMins > 0) return `${diffMins}m ago`;
      return 'just now';
    } catch {
      return dateStr;
    }
  };

  // Smart non-clipping menu positioning calculation
  const getMenuStyles = (): React.CSSProperties => {
    if (!activeMenu) return { display: 'none' };

    const menuEstimatedHeight = 310;

    if (activeMenu.triggerRect) {
      const rect = activeMenu.triggerRect;
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 310px below, flip UPWARDS to prevent clipping
      const openUpwards = spaceBelow < menuEstimatedHeight;

      return {
        position: 'fixed',
        top: openUpwards ? undefined : `${rect.bottom + 4}px`,
        bottom: openUpwards ? `${window.innerHeight - rect.top + 4}px` : undefined,
        right: `${Math.max(12, window.innerWidth - rect.right)}px`,
        zIndex: 50,
      };
    }

    if (activeMenu.x !== undefined && activeMenu.y !== undefined) {
      const spaceBelow = window.innerHeight - activeMenu.y;
      const openUpwards = spaceBelow < menuEstimatedHeight;
      const spaceRight = window.innerWidth - activeMenu.x;

      return {
        position: 'fixed',
        top: openUpwards ? undefined : `${activeMenu.y + 4}px`,
        bottom: openUpwards ? `${window.innerHeight - activeMenu.y + 4}px` : undefined,
        left: spaceRight >= 260 ? `${activeMenu.x}px` : undefined,
        right: spaceRight < 260 ? `${Math.max(12, window.innerWidth - activeMenu.x)}px` : undefined,
        zIndex: 50,
      };
    }

    return { display: 'none' };
  };

  if (loading && commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs">Loading commit graph from Git...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs relative">
      {/* Search Header */}
      <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 shrink-0 flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search commits by message, author, or SHA..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-[11px] font-mono text-zinc-400 shrink-0 px-1">
          {filteredCommits.length} commits
        </span>
      </div>

      {/* Table Header: Clear columns including dedicated Actions header */}
      <div className="flex items-center px-2 py-1.5 bg-zinc-100/70 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 uppercase tracking-wider select-none shrink-0">
        <div className="w-16 shrink-0 text-center">Graph</div>
        <div className="flex-1 truncate px-2">Subject / Refs</div>
        <div className="w-28 shrink-0 truncate px-2">Author</div>
        <div className="w-24 shrink-0 text-right px-2">Date</div>
        <div className="w-20 shrink-0 text-right px-2">SHA</div>
        <div className="w-24 shrink-0 text-center pr-2">Actions</div>
      </div>

      {/* Scrollable Rows with Graph Canvas */}
      <div
        ref={scrollContainerRef}
        onScroll={() => {
          if (activeMenu) setActiveMenu(null);
        }}
        className="flex-1 overflow-y-auto relative"
      >
        <div className="flex min-w-full relative">
          {/* Canvas Graph Column */}
          <div className="shrink-0 bg-transparent" style={{ width: 'auto' }}>
            <CommitGraphCanvas
              commits={filteredCommits}
              selectedSha={selectedSha}
              theme={theme}
              rowHeight={ROW_HEIGHT}
              laneWidth={18}
            />
          </div>

          {/* Commit Rows */}
          <div className="flex-1 flex flex-col min-w-0">
            {filteredCommits.map((c) => {
              const isSelected = c.sha === selectedSha;
              const isMenuActive = activeMenu?.commit.sha === c.sha;

              return (
                <div
                  key={c.sha}
                  onClick={() => onSelectCommit(c.sha)}
                  onContextMenu={(e) => handleContextMenu(e, c)}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  className={`group relative flex items-center border-b border-zinc-100 dark:border-zinc-800/60 cursor-pointer transition-colors px-2 select-none ${
                    isSelected
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  {/* Subject and Refs */}
                  <div className="flex-1 flex items-center gap-1.5 truncate min-w-0 pr-2">
                    {c.refs.map((r, rIdx) => {
                      const isTag = r.startsWith('tag: ');
                      const isHead = r.includes('HEAD');
                      return (
                        <span
                          key={rIdx}
                          className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-mono text-[10px] shrink-0 border ${
                            isTag
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : isHead
                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-semibold'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isTag ? (
                            <Tag className="w-2.5 h-2.5" />
                          ) : (
                            <GitBranch className="w-2.5 h-2.5" />
                          )}
                          <span className="truncate max-w-[120px]">{r.replace('tag: ', '')}</span>
                        </span>
                      );
                    })}
                    <span className="truncate font-medium text-xs">{c.subject}</span>
                  </div>

                  {/* Author */}
                  <div className="w-28 shrink-0 truncate px-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {c.author_name}
                  </div>

                  {/* Date: ALWAYS fully visible and crisp - NEVER obscured by hover icons */}
                  <div className="w-24 shrink-0 text-right px-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 select-none">
                    {formatRelativeDate(c.author_date)}
                  </div>

                  {/* Short SHA */}
                  <div className="w-20 shrink-0 text-right px-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={(e) => handleCopySha(e, c.sha)}
                      className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title="Click to copy full commit SHA"
                    >
                      {copiedSha === c.sha ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 opacity-60" />
                      )}
                      <span>{c.sha.substring(0, 7)}</span>
                    </button>
                  </div>

                  {/* Actions Column: Dedicated, clearly detectable action buttons + Menu trigger */}
                  <div className="w-24 shrink-0 flex items-center justify-end pr-1 gap-1">
                    {/* Quick action: Cherry-pick (visible on hover) */}
                    {onCherryPick && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCherryPick(c);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-500 transition-all cursor-pointer"
                        title="Cherry-pick onto HEAD"
                      >
                        <Cherry className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Quick action: Revert (visible on hover) */}
                    {onRevert && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRevert(c);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-indigo-500/10 text-zinc-400 hover:text-indigo-500 transition-all cursor-pointer"
                        title="Revert commit"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Detectable Menu Trigger Button: '•••' Actions Menu */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleMenu(e, c)}
                      className={`p-1 rounded transition-all cursor-pointer ${
                        isMenuActive
                          ? 'bg-blue-600 text-white shadow-xs opacity-100'
                          : 'opacity-60 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300'
                      }`}
                      title="Commit actions menu (or right-click row)"
                      aria-label="Commit actions"
                      aria-expanded={isMenuActive}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Smart, Non-Clipping Single Active Dropdown Menu (Fixed positioning avoids container overflow) */}
      {activeMenu && (
        <div
          ref={menuRef}
          style={getMenuStyles()}
          className="w-64 max-h-[320px] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-2xl p-1.5 text-xs text-zinc-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-100 space-y-0.5"
        >
          {/* Menu Header with commit SHA badge */}
          <div className="px-2.5 py-1.5 border-b border-zinc-100 dark:border-zinc-700/60 mb-1 flex items-center justify-between">
            <span className="font-semibold text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Commit Actions
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
              {activeMenu.commit.sha.substring(0, 7)}
            </span>
          </div>

          {/* Action: Cherry-pick */}
          {onCherryPick && (
            <button
              type="button"
              onClick={() => {
                const c = activeMenu.commit;
                setActiveMenu(null);
                onCherryPick(c);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors cursor-pointer"
            >
              <Cherry className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium">Cherry-Pick onto HEAD</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  git cherry-pick {activeMenu.commit.sha.substring(0, 7)}
                </span>
              </div>
            </button>
          )}

          {/* Action: Revert */}
          {onRevert && (
            <button
              type="button"
              onClick={() => {
                const c = activeMenu.commit;
                setActiveMenu(null);
                onRevert(c);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 text-left transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium">Revert Commit</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  Undo changes via inverse commit
                </span>
              </div>
            </button>
          )}

          {/* Action: Interactive Rebase */}
          {onStartInteractiveRebase && (
            <button
              type="button"
              onClick={() => {
                const c = activeMenu.commit;
                setActiveMenu(null);
                onStartInteractiveRebase(c.sha, c.subject);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 text-left transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-purple-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium">Interactive Rebase from here</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  git rebase -i {activeMenu.commit.sha.substring(0, 7)}
                </span>
              </div>
            </button>
          )}

          {/* Action: Modify Author / Date */}
          {onModifyAuthorDate && (
            <button
              type="button"
              onClick={() => {
                const c = activeMenu.commit;
                setActiveMenu(null);
                onModifyAuthorDate(c);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 text-left transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium">Modify Author / Date</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  Amend author credentials or timestamp
                </span>
              </div>
            </button>
          )}

          {/* Action: Reset HEAD to this commit */}
          {onResetToCommit && (
            <button
              type="button"
              onClick={() => {
                const c = activeMenu.commit;
                setActiveMenu(null);
                onResetToCommit(c);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 text-left transition-colors cursor-pointer"
            >
              <Undo2 className="w-4 h-4 text-rose-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium">Reset HEAD to this Commit...</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  --soft, --mixed, or --hard reset
                </span>
              </div>
            </button>
          )}

          {/* Action: Relocate branch pointer */}
          {onForceRelocateBranch && (
            <button
              type="button"
              onClick={() => {
                const c = activeMenu.commit;
                setActiveMenu(null);
                onForceRelocateBranch(c);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium">Relocate Branch pointer here...</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  git branch -f &lt;branch&gt;
                </span>
              </div>
            </button>
          )}

          {/* Action: New branch at this commit */}
          {onCreateBranchAtCommit && (
            <button
              type="button"
              onClick={() => {
                const c = activeMenu.commit;
                setActiveMenu(null);
                onCreateBranchAtCommit(c.sha, c.subject);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium">New Branch at Commit...</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  git checkout -b &lt;branch&gt;
                </span>
              </div>
            </button>
          )}

          <div className="my-1 border-t border-zinc-100 dark:border-zinc-700/60" />

          {/* Action: Copy Full SHA */}
          <button
            type="button"
            onClick={(e) => {
              handleCopySha(e, activeMenu.commit.sha);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-left transition-colors cursor-pointer"
          >
            {copiedSha === activeMenu.commit.sha ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-zinc-400 shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-medium">
                {copiedSha === activeMenu.commit.sha ? 'SHA Copied!' : 'Copy Full SHA'}
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate">
                {activeMenu.commit.sha}
              </span>
            </div>
          </button>

          {/* Action: Copy Commit Message */}
          <button
            type="button"
            onClick={(e) => {
              handleCopyMessage(e, activeMenu.commit.subject, activeMenu.commit.sha);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-left transition-colors cursor-pointer"
          >
            {copiedMsgSha === activeMenu.commit.sha ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-medium">
                {copiedMsgSha === activeMenu.commit.sha
                  ? 'Message Copied!'
                  : 'Copy Commit Message'}
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                {activeMenu.commit.subject}
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
