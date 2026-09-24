import React, { useState, useMemo } from 'react';
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
  loading: boolean;
  theme: Theme;
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
  loading,
  theme,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const filteredCommits = useMemo(() => {
    if (!searchTerm.trim()) return commits;
    const q = searchTerm.toLowerCase();
    return commits.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q) ||
        c.sha.toLowerCase().startsWith(q) ||
        c.refs.some((r) => r.toLowerCase().includes(q))
    );
  }, [commits, searchTerm]);

  const handleCopy = (e: React.MouseEvent, sha: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 1500);
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

  if (loading && commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs">Loading commit graph from Git...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
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

      {/* Table Header */}
      <div className="flex items-center px-2 py-1.5 bg-zinc-100/60 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 uppercase tracking-wider select-none shrink-0">
        <div className="w-16 shrink-0 text-center">Graph</div>
        <div className="flex-1 truncate px-2">Subject / Refs</div>
        <div className="w-32 shrink-0 truncate px-2">Author</div>
        <div className="w-20 shrink-0 text-right px-2">Date</div>
        <div className="w-20 shrink-0 text-right px-2">SHA</div>
      </div>

      {/* Scrollable Rows with Graph Canvas */}
      <div className="flex-1 overflow-y-auto relative">
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
              return (
                <div
                  key={c.sha}
                  onClick={() => onSelectCommit(c.sha)}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  className={`group flex items-center border-b border-zinc-100 dark:border-zinc-800/60 cursor-pointer transition-colors px-2 select-none ${
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
                  <div className="w-32 shrink-0 truncate px-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {c.author_name}
                  </div>

                  {/* Date */}
                  <div className="w-20 shrink-0 text-right px-2 text-[11px] font-mono text-zinc-400">
                    {formatRelativeDate(c.author_date)}
                  </div>

                  {/* Short SHA & Action */}
                  <div className="w-28 shrink-0 text-right px-2 flex items-center justify-end gap-1">
                    {onCherryPick && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCherryPick(c);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all"
                        title="Cherry-pick this commit onto HEAD"
                      >
                        <Cherry className="w-3 h-3" />
                      </button>
                    )}
                    {onRevert && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRevert(c);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-indigo-500/10 text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all"
                        title="Revert this commit (undo via inverse commit)"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                    {onModifyAuthorDate && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onModifyAuthorDate(c);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-all"
                        title="Modify commit author / date"
                      >
                        <Clock className="w-3 h-3" />
                      </button>
                    )}
                    {onStartInteractiveRebase && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartInteractiveRebase(c.sha, c.subject);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-indigo-500/10 text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all"
                        title="Interactive rebase onto this commit"
                      >
                        <Layers className="w-3 h-3" />
                      </button>
                    )}
                    {onResetToCommit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResetToCommit(c);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-all"
                        title="Reset HEAD to this commit (--soft / --mixed / --hard)"
                      >
                        <Undo2 className="w-3 h-3" />
                      </button>
                    )}
                    {onForceRelocateBranch && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onForceRelocateBranch(c);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-all"
                        title="Force relocate a branch pointer to this commit (branch -f)"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleCopy(e, c.sha)}
                      className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-200/50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
