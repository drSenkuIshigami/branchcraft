import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  Terminal,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  X,
  RotateCcw,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import type { RebaseAction, RebaseTodoItem, Theme } from '../types';
import { getRebaseCandidates, executeInteractiveRebase } from '../ipc';

interface InteractiveRebaseModalProps {
  isOpen: boolean;
  repoPath: string;
  baseSha: string;
  baseSummary?: string;
  theme: Theme;
  onClose: () => void;
  onRebaseStarted: (commandTokens: string[]) => void;
}

const ACTION_CONFIG: Record<
  RebaseAction,
  { label: string; desc: string; badgeClass: string; darkBadgeClass: string }
> = {
  pick: {
    label: 'pick',
    desc: 'Keep commit as is',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    darkBadgeClass: 'bg-blue-950/60 text-blue-300 border-blue-800',
  },
  reword: {
    label: 'reword',
    desc: 'Keep commit, edit message',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    darkBadgeClass: 'bg-amber-950/60 text-amber-300 border-amber-800',
  },
  edit: {
    label: 'edit',
    desc: 'Stop here to amend files/commit',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
    darkBadgeClass: 'bg-purple-950/60 text-purple-300 border-purple-800',
  },
  squash: {
    label: 'squash',
    desc: 'Meld into previous commit',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    darkBadgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
  },
  fixup: {
    label: 'fixup',
    desc: 'Meld into previous, discard log',
    badgeClass: 'bg-teal-100 text-teal-700 border-teal-200',
    darkBadgeClass: 'bg-teal-950/60 text-teal-300 border-teal-800',
  },
  drop: {
    label: 'drop',
    desc: 'Delete commit completely',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
    darkBadgeClass: 'bg-rose-950/60 text-rose-300 border-rose-800',
  },
  exec: {
    label: 'exec',
    desc: 'Run shell command at this point',
    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    darkBadgeClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-800',
  },
};

export const InteractiveRebaseModal: React.FC<InteractiveRebaseModalProps> = ({
  isOpen,
  repoPath,
  baseSha,
  baseSummary,
  theme,
  onClose,
  onRebaseStarted,
}) => {
  const [items, setItems] = useState<RebaseTodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !repoPath || !baseSha) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    getRebaseCandidates(repoPath, baseSha)
      .then((candidates) => {
        if (mounted) {
          setItems(candidates);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, repoPath, baseSha]);

  if (!isOpen) return null;

  const handleActionChange = (id: string, newAction: RebaseAction) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          action: newAction,
          new_message: newAction === 'reword' ? item.new_message || item.summary : item.new_message,
          exec_command: newAction === 'exec' ? item.exec_command || 'npm test' : item.exec_command,
        };
      })
    );
  };

  const handleMessageChange = (id: string, msg: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, new_message: msg } : item)));
  };

  const handleExecCommandChange = (id: string, cmd: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, exec_command: cmd } : item))
    );
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleResetAllToPick = () => {
    setItems((prev) => prev.map((item) => ({ ...item, action: 'pick' })));
  };

  const handleSquashAllIntoFirst = () => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === 0 ? { ...item, action: 'pick' } : { ...item, action: 'squash' }
      )
    );
  };

  const handleFixupAllIntoFirst = () => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === 0 ? { ...item, action: 'pick' } : { ...item, action: 'fixup' }
      )
    );
  };

  // Validation: First item cannot be squash or fixup without a preceding commit
  const hasInvalidFirstItem =
    items.length > 0 && (items[0].action === 'squash' || items[0].action === 'fixup');

  const actionCounts = items.reduce(
    (acc, it) => {
      acc[it.action] = (acc[it.action] || 0) + 1;
      return acc;
    },
    {} as Record<RebaseAction, number>
  );

  const handleExecute = async () => {
    if (hasInvalidFirstItem || items.length === 0) return;
    setSubmitting(true);
    setError(null);

    const cmdTokens = ['rebase', '-i', baseSha];
    try {
      onRebaseStarted(cmdTokens);
      const res = await executeInteractiveRebase(repoPath, baseSha, items);
      if (!res.success && res.stderr && !res.stderr.includes('CONFLICT')) {
        setError(res.stderr);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        id="interactive-rebase-modal"
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl border overflow-hidden transition-all ${
          theme === 'dark'
            ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-800'
        }`}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Interactive Rebase</h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  onto {baseSha.slice(0, 7)}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Reorder, squash, edit, reword, or drop commits prior to HEAD.
              </p>
            </div>
          </div>
          <button
            id="close-rebase-modal-button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Base Info & Quick Presets Bar */}
        <div className="px-4 py-2.5 bg-zinc-100/70 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <GitCommit className="w-4 h-4 text-zinc-400" />
            <span>
              Rebasing {items.length} commit{items.length !== 1 ? 's' : ''} onto:
            </span>
            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
              {baseSummary || baseSha.slice(0, 10)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 mr-1">Presets:</span>
            <button
              onClick={handleFixupAllIntoFirst}
              disabled={items.length < 2 || submitting}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
            >
              Fixup All into #1
            </button>
            <button
              onClick={handleSquashAllIntoFirst}
              disabled={items.length < 2 || submitting}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
            >
              Squash All into #1
            </button>
            <button
              onClick={handleResetAllToPick}
              disabled={submitting}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3 inline mr-1 text-zinc-400" />
              Reset All to Pick
            </button>
          </div>
        </div>

        {/* Action Summary Pill Bar */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto text-[11px] shrink-0">
          <span className="text-zinc-400 font-medium">Plan summary:</span>
          {(Object.keys(ACTION_CONFIG) as RebaseAction[]).map((action) => {
            const count = actionCounts[action] || 0;
            if (count === 0) return null;
            const config = ACTION_CONFIG[action];
            return (
              <span
                key={action}
                className={`px-2 py-0.5 rounded-full border font-mono font-medium ${
                  theme === 'dark' ? config.darkBadgeClass : config.badgeClass
                }`}
              >
                {count} {action}
              </span>
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-mono break-all">{error}</div>
          </div>
        )}

        {/* Invalid first item warning */}
        {hasInvalidFirstItem && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              The first commit in a rebase cannot be "squash" or "fixup". Change it to "pick" or
              move another commit before it.
            </span>
          </div>
        )}

        {/* Commit List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading rebase candidates...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              No commits found between {baseSha.slice(0, 7)} and HEAD.
            </div>
          ) : (
            items.map((item, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === items.length - 1;
              const config = ACTION_CONFIG[item.action];

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border transition-all ${
                    item.action === 'drop'
                      ? 'opacity-60 bg-zinc-50 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-800'
                      : 'bg-white dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/80 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Index & Reorder Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-mono text-zinc-400 w-5 text-center">
                        #{idx + 1}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleMoveUp(idx)}
                          disabled={isFirst || submitting}
                          title="Move commit earlier in sequence"
                          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 transition-colors"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(idx)}
                          disabled={isLast || submitting}
                          title="Move commit later in sequence"
                          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 transition-colors"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Action Selector */}
                    <div className="shrink-0">
                      <select
                        value={item.action}
                        onChange={(e) =>
                          handleActionChange(item.id, e.target.value as RebaseAction)
                        }
                        disabled={submitting}
                        className={`text-xs font-mono font-medium rounded-md px-2.5 py-1.5 border appearance-none cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors ${
                          theme === 'dark' ? config.darkBadgeClass : config.badgeClass
                        }`}
                      >
                        {(Object.keys(ACTION_CONFIG) as RebaseAction[]).map((action) => (
                          <option key={action} value={action}>
                            {action.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Commit SHA & Author */}
                    <div className="shrink-0 font-mono text-xs text-indigo-500 dark:text-indigo-400 font-medium">
                      {item.short_sha}
                    </div>

                    {/* Summary / Reword / Exec Input */}
                    <div className="flex-1 min-w-0">
                      {item.action === 'reword' ? (
                        <div className="flex items-center gap-2">
                          <Edit2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <input
                            type="text"
                            value={item.new_message ?? item.summary}
                            onChange={(e) => handleMessageChange(item.id, e.target.value)}
                            placeholder="Enter amended commit message..."
                            className="w-full text-xs px-2.5 py-1 rounded border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      ) : item.action === 'exec' ? (
                        <div className="flex items-center gap-2">
                          <Terminal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <input
                            type="text"
                            value={item.exec_command ?? ''}
                            onChange={(e) => handleExecCommandChange(item.id, e.target.value)}
                            placeholder="Shell command (e.g. npm test)..."
                            className="w-full text-xs font-mono px-2.5 py-1 rounded border border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs truncate ${
                              item.action === 'drop'
                                ? 'line-through text-zinc-400'
                                : 'text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {item.summary}
                          </span>
                          <span className="text-[11px] text-zinc-400 truncate shrink-0">
                            {item.author}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Legend & Safety Notice Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              If conflicts arise, rebase automatically pauses allowing resolution, continuing, or
              aborting safely.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              id="start-rebase-button"
              onClick={handleExecute}
              disabled={hasInvalidFirstItem || items.length === 0 || submitting}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Starting Rebase...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Rebase ({items.length} commits)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
