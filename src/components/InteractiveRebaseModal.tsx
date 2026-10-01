import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  GitCommit,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  Terminal,
  Layers,
  AlertTriangle,
  Play,
  X,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Search,
  Check,
  Package,
  Paperclip,
  Info,
  Archive,
} from 'lucide-react';
import type { RebaseAction, RebaseTodoItem, Theme } from '../types';
import { getRebaseCandidates, executeInteractiveRebase, createStash } from '../ipc';

interface InteractiveRebaseModalProps {
  isOpen: boolean;
  repoPath: string;
  baseSha: string;
  baseSummary?: string;
  isRoot?: boolean;
  hasDirtyWorkingTree?: boolean;
  theme: Theme;
  onClose: () => void;
  onRebaseStarted: (commandTokens: string[]) => void;
  onRebaseCompleted?: (hasEditOrPause: boolean) => void;
}

const ACTION_CONFIG: Record<
  RebaseAction,
  { label: string; desc: string; badgeClass: string; darkBadgeClass: string; icon: React.ReactNode }
> = {
  pick: {
    label: 'pick',
    desc: 'Keep commit as is',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200/80',
    darkBadgeClass: 'bg-blue-950/70 text-blue-300 border-blue-800 hover:bg-blue-900/60',
    icon: <Check className="w-3 h-3 text-blue-500" />,
  },
  edit: {
    label: 'edit',
    desc: 'Stop here to edit/amend files in working tree',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200/80',
    darkBadgeClass: 'bg-purple-950/70 text-purple-300 border-purple-800 hover:bg-purple-900/60',
    icon: <Edit2 className="w-3 h-3 text-purple-500" />,
  },
  reword: {
    label: 'reword',
    desc: 'Keep commit, edit commit message',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200/80',
    darkBadgeClass: 'bg-amber-950/70 text-amber-300 border-amber-800 hover:bg-amber-900/60',
    icon: <Edit2 className="w-3 h-3 text-amber-500" />,
  },
  squash: {
    label: 'squash',
    desc: 'Meld into previous commit, combining messages',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200/80',
    darkBadgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60',
    icon: <Package className="w-3 h-3 text-emerald-500" />,
  },
  fixup: {
    label: 'fixup',
    desc: 'Meld into previous commit, discarding log message',
    badgeClass: 'bg-teal-100 text-teal-700 border-teal-300 hover:bg-teal-200/80',
    darkBadgeClass: 'bg-teal-950/70 text-teal-300 border-teal-800 hover:bg-teal-900/60',
    icon: <Paperclip className="w-3 h-3 text-teal-500" />,
  },
  drop: {
    label: 'drop',
    desc: 'Delete commit completely from history',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200/80',
    darkBadgeClass: 'bg-rose-950/70 text-rose-300 border-rose-800 hover:bg-rose-900/60',
    icon: <Trash2 className="w-3 h-3 text-rose-500" />,
  },
  exec: {
    label: 'exec',
    desc: 'Run shell command (e.g. test) at this point',
    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-300 hover:bg-indigo-200/80',
    darkBadgeClass: 'bg-indigo-950/70 text-indigo-300 border-indigo-800 hover:bg-indigo-900/60',
    icon: <Terminal className="w-3 h-3 text-indigo-500" />,
  },
};

export const InteractiveRebaseModal: React.FC<InteractiveRebaseModalProps> = ({
  isOpen,
  repoPath,
  baseSha,
  baseSummary,
  isRoot,
  hasDirtyWorkingTree = false,
  theme,
  onClose,
  onRebaseStarted,
  onRebaseCompleted,
}) => {
  const [items, setItems] = useState<RebaseTodoItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isRootRebase, setIsRootRebase] = useState<boolean>(Boolean(isRoot || baseSha === '--root'));
  const [autoStash, setAutoStash] = useState<boolean>(true);
  const [isStashing, setIsStashing] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Sync isRoot from props when modal opens or baseSha changes
  useEffect(() => {
    if (isOpen) {
      setIsRootRebase(Boolean(isRoot || baseSha === '--root'));
    }
  }, [isOpen, isRoot, baseSha]);

  useEffect(() => {
    if (!isOpen || !repoPath || !baseSha) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setSearchTerm('');
    setOpenDropdownId(null);

    getRebaseCandidates(repoPath, baseSha, isRootRebase)
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
  }, [isOpen, repoPath, baseSha, isRootRebase]);

  // Click outside to close dropdowns
  useEffect(() => {
    if (!openDropdownId) return;

    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdownId(null);
      }
    };

    window.addEventListener('pointerdown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDropdownId]);

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
    setOpenDropdownId(null);
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

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.summary.toLowerCase().includes(q) ||
        item.short_sha.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.action.toLowerCase().includes(q)
    );
  }, [items, searchTerm]);

  const handleExecute = async () => {
    if (hasInvalidFirstItem || items.length === 0) return;
    setSubmitting(true);
    setError(null);

    const cmdTokens: string[] = ['rebase', '-i'];
    if (autoStash) cmdTokens.push('--autostash');
    if (isRootRebase) cmdTokens.push('--root');
    else cmdTokens.push(baseSha);

    const hasEditAction = items.some((it) => it.action === 'edit');
    try {
      onRebaseStarted(cmdTokens);
      const res = await executeInteractiveRebase(repoPath, baseSha, items, isRootRebase, autoStash);
      const combinedOutput = (res.stderr || '') + '\n' + (res.stdout || '');

      if (!res.success) {
        if (combinedOutput.includes('CONFLICT') || combinedOutput.includes('Stopped at')) {
          onClose();
          if (onRebaseCompleted) {
            onRebaseCompleted(true);
          }
        } else {
          const errMsg =
            res.stderr?.trim() ||
            res.stdout?.trim() ||
            `Interactive rebase failed to start (exit code ${res.exit_code}).`;
          setError(errMsg);
        }
        return;
      }

      onClose();
      if (onRebaseCompleted) {
        const isPaused = hasEditAction || Boolean(combinedOutput.includes('Stopped at'));
        onRebaseCompleted(isPaused);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // 1-Click Auto-Stash & Retry Action for unstaged changes error
  const handleStashAndRetry = async () => {
    setIsStashing(true);
    setError(null);
    const hasEditAction = items.some((it) => it.action === 'edit');
    try {
      await createStash(repoPath, 'Auto-stash before interactive rebase', true);
      // Run rebase with autostash enabled
      const cmdTokens: string[] = ['rebase', '-i'];
      if (isRootRebase) cmdTokens.push('--root');
      else cmdTokens.push(baseSha);

      onRebaseStarted(cmdTokens);
      const res = await executeInteractiveRebase(repoPath, baseSha, items, isRootRebase, true);
      const combinedOutput = (res.stderr || '') + '\n' + (res.stdout || '');

      if (!res.success) {
        if (combinedOutput.includes('CONFLICT') || combinedOutput.includes('Stopped at')) {
          onClose();
          if (onRebaseCompleted) {
            onRebaseCompleted(true);
          }
        } else {
          const errMsg =
            res.stderr?.trim() ||
            res.stdout?.trim() ||
            `Interactive rebase failed to start (exit code ${res.exit_code}).`;
          setError(errMsg);
        }
        return;
      }

      onClose();
      if (onRebaseCompleted) {
        const isPaused = hasEditAction || Boolean(combinedOutput.includes('Stopped at'));
        onRebaseCompleted(isPaused);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStashing(false);
    }
  };

  const isUnstagedChangesError =
    Boolean(
      error &&
        (error.includes('unstaged changes') ||
          error.includes('commit or stash them') ||
          error.includes('cannot rebase: You have unstaged changes'))
    );

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
                <h2 className="text-base font-semibold">
                  Interactive Rebase {isRootRebase ? '(from Initial / Root commit)' : ''}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {isRootRebase ? '--root' : `onto ${baseSha.slice(0, 7)}`}
                </span>
                {hasDirtyWorkingTree && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                    <Archive className="w-2.5 h-2.5" />
                    <span>Auto-stash enabled</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Reorder, squash, edit, reword, or drop commits prior to HEAD.
              </p>
            </div>
          </div>
          <button
            id="close-rebase-modal-button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* How-to edit banner: Explains how to edit files in previous commits including initial commit */}
        <div className="px-4 py-2.5 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-200 dark:border-purple-800/60 flex items-start gap-2.5 text-xs text-purple-800 dark:text-purple-300 shrink-0">
          <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold">How to edit files in a previous commit:</span>{' '}
            {isRootRebase ? (
              <span>
                The <strong>Initial / Root commit</strong> is listed as <strong>#1</strong> below. Click{' '}
                <strong className="underline">Edit Files</strong> on commit #1 (or click{' '}
                <span className="font-mono px-1.5 py-0.2 rounded bg-purple-200/60 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 font-bold">
                  PICK ▾
                </span>{' '}
                and select <strong>EDIT</strong>). When you click <em>Start Rebase</em>, Git will pause at the initial commit so you can edit <code>README.md</code>, stage it, and continue!
              </span>
            ) : (
              <span>
                Click <strong className="underline">Edit Files</strong> on the commit you want to modify (or change its action to <strong className="uppercase">EDIT</strong>). If you want to edit the <strong>Initial commit</strong>, click{' '}
                <strong>+ Include Initial Commit (--root)</strong> in the bar above.
              </span>
            )}
          </div>
        </div>

        {/* Base Info & Quick Presets Bar */}
        <div className="px-4 py-2.5 bg-zinc-100/70 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <GitCommit className="w-4 h-4 text-zinc-400" />
            <span>
              Rebasing {items.length} commit{items.length !== 1 ? 's' : ''}{' '}
              {isRootRebase ? 'including Initial commit:' : 'onto:'}
            </span>
            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
              {isRootRebase ? 'Root commit (--root)' : baseSummary || baseSha.slice(0, 10)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Toggle root commit inclusion */}
            <button
              type="button"
              onClick={() => setIsRootRebase(!isRootRebase)}
              disabled={submitting}
              className={`px-2 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                isRootRebase
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
              title="Include the initial root commit in the rebase (git rebase -i --root)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isRootRebase ? '✓ Initial Commit Included' : '+ Include Initial Commit'}</span>
            </button>

            <span className="text-zinc-300 dark:text-zinc-600 mx-1">|</span>

            <span className="text-zinc-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={handleFixupAllIntoFirst}
              disabled={items.length < 2 || submitting}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Fixup All into #1
            </button>
            <button
              type="button"
              onClick={handleSquashAllIntoFirst}
              disabled={items.length < 2 || submitting}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Squash All into #1
            </button>
            <button
              type="button"
              onClick={handleResetAllToPick}
              disabled={submitting}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 inline mr-1 text-zinc-400" />
              Reset All to Pick
            </button>
          </div>
        </div>

        {/* Filter and Plan Summary Bar */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 bg-white dark:bg-zinc-900">
          {/* Search box to find candidate commit in long lists */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter commits by message, author, or SHA..."
              className="w-full pl-8 pr-3 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-[10px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Summary Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-zinc-400 font-medium">Plan:</span>
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
        </div>

        {/* Error Alert with 1-Click Stash & Retry Helper */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex flex-col gap-2 animate-in fade-in duration-150">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-mono break-all">{error}</div>
            </div>

            {/* Smart 1-Click Unstaged Changes Recovery */}
            {isUnstagedChangesError && (
              <div className="mt-1 pt-2 border-t border-rose-200 dark:border-rose-800/80 flex flex-wrap items-center justify-between gap-2 bg-rose-100/60 dark:bg-rose-900/30 p-2.5 rounded-lg">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 text-xs font-medium">
                  <Archive className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>
                    You have uncommitted changes in your working tree. Would you like Git Workbench to
                    automatically stash them now and start the rebase?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleStashAndRetry}
                  disabled={isStashing || submitting}
                  className="px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  {isStashing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Stashing &amp; Retrying...</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      <span>Stash Changes &amp; Start Rebase</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Invalid first item warning */}
        {hasInvalidFirstItem && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              The first commit in a rebase cannot be &quot;squash&quot; or &quot;fixup&quot;. Change it to &quot;pick&quot; or
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
              No commits found.
            </div>
          ) : (
            filteredItems.map((item) => {
              const originalIndex = items.findIndex((it) => it.id === item.id);
              const isFirst = originalIndex === 0;
              const isLast = originalIndex === items.length - 1;
              const isRootCommitItem = isRootRebase && originalIndex === 0;
              const config = ACTION_CONFIG[item.action];
              const isDropdownOpen = openDropdownId === item.id;
              const isEdit = item.action === 'edit';

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isEdit
                      ? 'border-purple-400/80 dark:border-purple-500/80 bg-purple-50/30 dark:bg-purple-950/20 shadow-sm ring-1 ring-purple-500/20'
                      : item.action === 'drop'
                        ? 'opacity-60 bg-zinc-50 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-800'
                        : isRootCommitItem
                          ? 'bg-indigo-500/5 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-700/60 shadow-xs'
                          : 'bg-white dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/80 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Index & Reorder Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-mono text-zinc-400 w-6 text-center">
                        #{originalIndex + 1}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(originalIndex)}
                          disabled={isFirst || submitting}
                          title="Move commit earlier in sequence"
                          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(originalIndex)}
                          disabled={isLast || submitting}
                          title="Move commit later in sequence"
                          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Action Selector: Custom prominent dropdown with visible chevron */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(isDropdownOpen ? null : item.id);
                        }}
                        disabled={submitting}
                        className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold rounded-md px-2.5 py-1.5 border transition-all cursor-pointer shadow-2xs ${
                          theme === 'dark' ? config.darkBadgeClass : config.badgeClass
                        }`}
                        title="Click to change rebase action (Pick, Edit, Reword, Squash, Fixup, Drop)"
                      >
                        {config.icon}
                        <span>{item.action.toUpperCase()}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            isDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {/* Dropdown Menu */}
                      {isDropdownOpen && (
                        <div
                          ref={dropdownRef}
                          className="absolute left-0 mt-1.5 w-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-2xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                        >
                          <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-700/60 mb-1">
                            Choose Rebase Action
                          </div>
                          {(Object.keys(ACTION_CONFIG) as RebaseAction[]).map((action) => {
                            const actConfig = ACTION_CONFIG[action];
                            const isCurrent = item.action === action;

                            return (
                              <button
                                key={action}
                                type="button"
                                onClick={() => handleActionChange(item.id, action)}
                                className={`w-full flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                  isCurrent
                                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold'
                                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-700/70 text-zinc-700 dark:text-zinc-200'
                                }`}
                              >
                                <span className="shrink-0 mt-0.5">{actConfig.icon}</span>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold uppercase">
                                      {actConfig.label}
                                    </span>
                                    {action === 'edit' && (
                                      <span className="px-1 py-0.2 rounded text-[9px] font-sans font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300">
                                        Pause &amp; Amend
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
                                    {actConfig.desc}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Commit SHA & Initial Commit indicator */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        {item.short_sha}
                      </span>
                      {isRootCommitItem && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 uppercase shrink-0">
                          Initial Commit
                        </span>
                      )}
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
                            className={`text-xs truncate font-medium ${
                              item.action === 'drop'
                                ? 'line-through text-zinc-400'
                                : isEdit
                                  ? 'text-purple-900 dark:text-purple-200'
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

                    {/* Quick Direct Edit Action Button */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {!isEdit ? (
                        <button
                          type="button"
                          onClick={() => handleActionChange(item.id, 'edit')}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 hover:border-purple-500/40 transition-colors cursor-pointer"
                          title="Stop here during rebase to edit files in this commit"
                        >
                          <Edit2 className="w-3 h-3 text-purple-500" />
                          <span>Edit Files</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleActionChange(item.id, 'pick')}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-200/70 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                          title="Cancel edit and keep commit as is"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Revert to Pick</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Edit Banner when EDIT is selected */}
                  {isEdit && (
                    <div className="mt-2.5 pt-2 border-t border-purple-200 dark:border-purple-800/60 flex items-center justify-between gap-2 text-xs text-purple-800 dark:text-purple-300">
                      <div className="flex items-center gap-2">
                        <Edit2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span>
                          <strong>Rebase will pause at commit {item.short_sha}.</strong> Your working
                          tree will match this commit so you can edit any files (like <code>README.md</code>), stage your changes,
                          and amend before continuing.
                        </span>
                      </div>
                    </div>
                  )}
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
              If you chose <strong>EDIT</strong> on {isRootRebase ? 'the Initial commit' : 'a commit'}, Git will pause there so you can edit files in your working tree.
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* Auto-Stash Checkbox */}
            <label
              className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer select-none"
              title="Automatically create a stash of uncommitted changes before rebasing and restore them after completion"
            >
              <input
                type="checkbox"
                checked={autoStash}
                onChange={(e) => setAutoStash(e.target.checked)}
                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Auto-stash changes</span>
              <code className="text-[10px] text-zinc-400 bg-zinc-200/50 dark:bg-zinc-800 px-1 rounded">
                --autostash
              </code>
            </label>

            <button
              onClick={onClose}
              disabled={submitting || isStashing}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="start-rebase-button"
              onClick={handleExecute}
              disabled={hasInvalidFirstItem || items.length === 0 || submitting || isStashing}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Starting Rebase...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    Start Rebase ({items.length} commit{items.length !== 1 ? 's' : ''})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
