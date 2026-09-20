import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  RefreshCw,
  GitBranch,
  RotateCcw,
  GitCommit,
  Eye,
  Copy,
  Check,
  ShieldAlert,
  ArrowRight,
  Filter,
} from 'lucide-react';
import type { ReflogEntry, Theme } from '../types';

interface ReflogViewerProps {
  repoPath: string;
  reflogEntries: ReflogEntry[];
  loading: boolean;
  onRefresh: () => void;
  onSelectCommit: (sha: string) => void;
  selectedSha: string | null;
  onRescueBranch: (sha: string, refSelector: string) => void;
  onResetHead: (targetRef: string, subject: string) => void;
  onCherryPick: (sha: string) => void;
  theme: Theme;
}

export const ReflogViewer: React.FC<ReflogViewerProps> = ({
  reflogEntries,
  loading,
  onRefresh,
  onSelectCommit,
  selectedSha,
  onRescueBranch,
  onResetHead,
  onCherryPick,
  theme: _theme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('all');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const handleCopySha = (sha: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 1800);
  };

  const actionCategories = useMemo(() => {
    const counts: Record<string, number> = { all: reflogEntries.length };
    for (const entry of reflogEntries) {
      counts[entry.action] = (counts[entry.action] || 0) + 1;
    }
    return counts;
  }, [reflogEntries]);

  const filteredEntries = useMemo(() => {
    return reflogEntries.filter((entry) => {
      if (selectedActionFilter !== 'all' && entry.action !== selectedActionFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          entry.subject.toLowerCase().includes(query) ||
          entry.sha.toLowerCase().includes(query) ||
          entry.selector.toLowerCase().includes(query) ||
          entry.author_name.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [reflogEntries, selectedActionFilter, searchQuery]);

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'commit':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'checkout':
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
      case 'rebase':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'reset':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'cherry-pick':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'revert':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'merge':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'branch':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
    }
  };

  const availableFilters = ['all', 'commit', 'checkout', 'rebase', 'reset', 'cherry-pick', 'revert', 'merge'];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 select-none overflow-hidden">
      {/* Header Bar */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-zinc-50/70 dark:bg-zinc-900/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                Reference Log (HEAD Reflog)
              </h2>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Complete chronological audit trail of all HEAD updates and history recovery points.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs transition-colors cursor-pointer"
            title="Refresh reflog"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-2.5 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-zinc-50/30 dark:bg-zinc-900/20">
        {/* Action Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
          <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1" />
          {availableFilters.map((action) => {
            const count = actionCategories[action] || 0;
            if (action !== 'all' && count === 0) return null;
            const isActive = selectedActionFilter === action;
            return (
              <button
                key={action}
                type="button"
                onClick={() => setSelectedActionFilter(action)}
                className={`px-2 py-0.8 rounded text-[11px] font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1 capitalize ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                <span>{action}</span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-zinc-300/60 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reflog subject or SHA..."
            className="w-full pl-8 pr-3 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Reflog Entries List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y-0">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-zinc-500 dark:text-zinc-400">
            <History className="w-8 h-8 stroke-1 text-zinc-400 mb-2 opacity-60" />
            <p className="text-xs font-medium">No reflog entries match your filter.</p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-blue-500 hover:underline"
              >
                Clear search query
              </button>
            )}
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isSelected = selectedSha === entry.sha;
            const isHeadZero = entry.index === 0;

            return (
              <div
                key={`${entry.selector}-${entry.sha}`}
                onClick={() => onSelectCommit(entry.sha)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                    : isHeadZero
                    ? 'border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-500'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/30 dark:bg-zinc-900/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  {/* Left: Selector, Action Badge, SHA */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Selector Badge */}
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                      {entry.selector}
                    </span>

                    {/* Current HEAD Flag */}
                    {isHeadZero && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white shadow-xs">
                        Current HEAD
                      </span>
                    )}

                    {/* Action Category Badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border capitalize ${getActionBadgeClass(
                        entry.action
                      )}`}
                    >
                      {entry.action}
                    </span>

                    {/* Commit SHA */}
                    <button
                      type="button"
                      onClick={(e) => handleCopySha(entry.sha, e)}
                      className="flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                      title="Click to copy full commit SHA"
                    >
                      <span>{entry.short_sha}</span>
                      {copiedSha === entry.sha ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 opacity-60" />
                      )}
                    </button>
                  </div>

                  {/* Right: Timestamp & Author */}
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>{entry.author_name}</span>
                    <span>•</span>
                    <span className="font-mono">{entry.date.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </div>

                {/* Subject Description */}
                <p className="text-xs font-mono text-zinc-800 dark:text-zinc-200 break-words mb-2.5 pl-0.5 leading-relaxed">
                  {entry.subject}
                </p>

                {/* Recovery & Action Buttons Bar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex-wrap">
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <span className="italic">Click row to preview diff</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Inspect Diff Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCommit(entry.sha);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Inspect commit details and files"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>

                    {/* Rescue Branch Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRescueBranch(entry.sha, entry.selector);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer"
                      title="Create a new branch pointing directly at this commit to rescue lost history"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>Rescue as Branch</span>
                    </button>

                    {/* Cherry-Pick Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCherryPick(entry.sha);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors cursor-pointer"
                      title="Cherry-pick this commit to current HEAD"
                    >
                      <GitCommit className="w-3.5 h-3.5" />
                      <span>Cherry-pick</span>
                    </button>

                    {/* Reset HEAD Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetHead(entry.selector, entry.subject);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                      title="Reset HEAD to this reference point"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset HEAD</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
