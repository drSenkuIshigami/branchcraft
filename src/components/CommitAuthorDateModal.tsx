import React, { useEffect, useState, useId } from 'react';
import {
  Clock,
  Calendar,
  User,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Terminal,
  History,
  GitCommit,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { CommitInfo, OperationResult } from '../types';
import { getGitUserConfig, modifyCommitAuthorDate } from '../ipc';

interface CommitAuthorDateModalProps {
  isOpen: boolean;
  repoPath: string;
  commit: CommitInfo | null;
  isHead: boolean;
  onClose: () => void;
  onSuccess: (result: OperationResult) => void;
  onStartInteractiveRebase?: (baseSha: string, subject: string) => void;
}

type CommitterDateMode = 'now' | 'sync' | 'original' | 'custom';

export const CommitAuthorDateModal: React.FC<CommitAuthorDateModalProps> = ({
  isOpen,
  repoPath,
  commit,
  isHead,
  onClose,
  onSuccess,
  onStartInteractiveRebase,
}) => {
  const authorNameInputId = useId();
  const authorEmailInputId = useId();
  const resetAuthorCheckboxId = useId();
  const authorDateTimeInputId = useId();
  const committerDateTimeInputId = useId();
  const editMessageCheckboxId = useId();
  const commitMessageTextareaId = useId();

  // Form State
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [resetAuthor, setResetAuthor] = useState(false);

  // Author Date: ISO datetime local string (YYYY-MM-DDTHH:mm)
  const [authorDateLocal, setAuthorDateLocal] = useState('');

  // Committer Date mode
  const [committerDateMode, setCommitterDateMode] = useState<CommitterDateMode>('sync');
  const [customCommitterDateLocal, setCustomCommitterDateLocal] = useState('');

  // Message modification
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [message, setMessage] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitConfigUser, setGitConfigUser] = useState<{ name: string; email: string } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Helper to convert date to datetime-local input string YYYY-MM-DDTHH:mm
  const toDateTimeLocal = (dateInput: string | Date): string => {
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  // Populate form on commit change
  useEffect(() => {
    if (commit && isOpen) {
      setAuthorName(commit.author_name);
      setAuthorEmail(commit.author_email);
      setResetAuthor(false);
      setAuthorDateLocal(toDateTimeLocal(commit.author_date));
      setCommitterDateMode('sync');
      setCustomCommitterDateLocal(toDateTimeLocal(commit.committer_date));
      setIsEditingMessage(false);
      setMessage(commit.body ? `${commit.subject}\n\n${commit.body}` : commit.subject);
      setError(null);
    }
  }, [commit, isOpen]);

  // Load repo default git config
  useEffect(() => {
    if (isOpen && repoPath) {
      setLoadingConfig(true);
      getGitUserConfig(repoPath)
        .then((cfg) => setGitConfigUser(cfg))
        .catch(() => setGitConfigUser(null))
        .finally(() => setLoadingConfig(false));
    }
  }, [isOpen, repoPath]);

  if (!isOpen || !commit) return null;

  // Presets handlers
  const handlePresetNow = () => {
    setAuthorDateLocal(toDateTimeLocal(new Date()));
  };

  const handlePresetOriginal = () => {
    setAuthorDateLocal(toDateTimeLocal(commit.author_date));
  };

  const handlePresetCommitterDate = () => {
    setAuthorDateLocal(toDateTimeLocal(commit.committer_date));
  };

  const handlePresetOffset = (offsetHours: number) => {
    try {
      const current = authorDateLocal ? new Date(authorDateLocal) : new Date();
      current.setHours(current.getHours() + offsetHours);
      setAuthorDateLocal(toDateTimeLocal(current));
    } catch {
      // ignore
    }
  };

  const handleApplyGitConfigUser = () => {
    if (gitConfigUser) {
      setAuthorName(gitConfigUser.name);
      setAuthorEmail(gitConfigUser.email);
      setResetAuthor(false);
    }
  };

  // Determine computed dates for submission and preview
  const getComputedAuthorDateIso = (): string | undefined => {
    if (!authorDateLocal) return undefined;
    try {
      const d = new Date(authorDateLocal);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch {
      return undefined;
    }
  };

  const getComputedCommitterDateIso = (): string | undefined => {
    if (committerDateMode === 'sync') {
      return getComputedAuthorDateIso();
    }
    if (committerDateMode === 'now') {
      return new Date().toISOString();
    }
    if (committerDateMode === 'original') {
      return commit.committer_date;
    }
    if (committerDateMode === 'custom' && customCommitterDateLocal) {
      try {
        const d = new Date(customCommitterDateLocal);
        return isNaN(d.getTime()) ? undefined : d.toISOString();
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  // Build command preview string
  const authorDateIso = getComputedAuthorDateIso();
  const committerDateIso = getComputedCommitterDateIso();
  const isPushedToRemote = commit.refs.some(
    (r) => r.includes('origin/') || r.includes('upstream/')
  );

  const commandPreview = React.useMemo(() => {
    const parts: string[] = [];
    if (committerDateIso && committerDateMode !== 'now') {
      parts.push(`GIT_COMMITTER_DATE="${committerDateIso}"`);
    }
    if (isHead) {
      parts.push('git commit --amend');
      if (resetAuthor) {
        parts.push('--reset-author');
      } else if (
        (authorName && authorName !== commit.author_name) ||
        (authorEmail && authorEmail !== commit.author_email)
      ) {
        parts.push(`--author="${authorName} <${authorEmail}>"`);
      }
      if (authorDateIso && authorDateIso !== commit.author_date) {
        parts.push(`--date="${authorDateIso}"`);
      }
      if (isEditingMessage) {
        parts.push(`-m "..."`);
      } else {
        parts.push('--no-edit');
      }
    } else {
      parts.push(`git rebase -i ${commit.sha.slice(0, 7)}^`);
      parts.push(`(auto-edits ${commit.sha.slice(0, 7)} & replays)`);
    }
    return parts.join(' ');
  }, [
    isHead,
    resetAuthor,
    authorName,
    authorEmail,
    authorDateIso,
    committerDateIso,
    committerDateMode,
    isEditingMessage,
    commit,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await modifyCommitAuthorDate(repoPath, {
        target_sha: commit.sha,
        author_name: resetAuthor ? undefined : authorName.trim(),
        author_email: resetAuthor ? undefined : authorEmail.trim(),
        reset_author: resetAuthor,
        author_date: authorDateIso,
        committer_date: committerDateIso,
        sync_committer_date_to_author: committerDateMode === 'sync',
        new_message: isEditingMessage ? message : undefined,
      });

      if (!res.success) {
        throw new Error(res.stderr || res.stdout || 'Operation failed');
      }

      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="commit-author-date-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="commit-author-date-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"
              >
                <span>Modify Commit Author & Timestamp</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {commit.sha.substring(0, 8)}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-md">
                {commit.subject}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isHead ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                HEAD (Direct Amend)
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Historical Commit (Rebase)
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Warning banner if pushed to remote or historical */}
          {isPushedToRemote && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold">Remote Tracking Warning:</span> This commit has
                already been pushed to an upstream branch. Rewriting its author or timestamp
                modifies its SHA and will require a force push (
                <code className="font-mono text-[11px]">git push --force-with-lease</code>).
              </div>
            </div>
          )}

          {!isHead && (
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-900 dark:text-indigo-300 text-xs flex items-start gap-2">
              <History className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <div>
                <span className="font-semibold">Automated History Rewrite:</span> This commit is not
                HEAD. Applying changes will execute an automated rebase that pauses at this commit,
                amends the author and timestamp metadata, and automatically replays subsequent
                commits onto the new SHA.
              </div>
            </div>
          )}

          {/* SECTION 1: Author Identity */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                <User className="w-4 h-4 text-blue-500" />
                <span>Author Identity</span>
              </div>

              {gitConfigUser && !resetAuthor && (
                <button
                  type="button"
                  onClick={handleApplyGitConfigUser}
                  disabled={submitting}
                  className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  title={`Use repository config: ${gitConfigUser.name} <${gitConfigUser.email}>`}
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Use Git Config ({gitConfigUser.name})</span>
                </button>
              )}
              {loadingConfig && (
                <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  <span>Checking config...</span>
                </span>
              )}
            </div>

            {/* Reset author toggle */}
            <label
              htmlFor={resetAuthorCheckboxId}
              className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none"
            >
              <input
                id={resetAuthorCheckboxId}
                type="checkbox"
                checked={resetAuthor}
                onChange={(e) => setResetAuthor(e.target.checked)}
                disabled={submitting}
                className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
              />
              <span className="font-medium">
                Reset Author to current Git configuration (
                <code className="font-mono text-[11px]">--reset-author</code>)
              </span>
            </label>

            {!resetAuthor && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label
                    htmlFor={authorNameInputId}
                    className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1"
                  >
                    Author Name
                  </label>
                  <input
                    id={authorNameInputId}
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Linus Torvalds"
                    className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor={authorEmailInputId}
                    className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1"
                  >
                    Author Email
                  </label>
                  <input
                    id={authorEmailInputId}
                    type="email"
                    value={authorEmail}
                    onChange={(e) => setAuthorEmail(e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. linus@kernel.org"
                    className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Author Date & Timestamp */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span>Author Date & Timestamp</span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">
                Original: {new Date(commit.author_date).toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label
                  htmlFor={authorDateTimeInputId}
                  className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1"
                >
                  Date and Time (Local)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={authorDateTimeInputId}
                    type="datetime-local"
                    step="1"
                    value={authorDateLocal}
                    onChange={(e) => setAuthorDateLocal(e.target.value)}
                    disabled={submitting}
                    className="flex-1 px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:border-blue-500"
                  />
                  {authorDateIso && (
                    <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[180px]">
                      {authorDateIso}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mr-1">
                  Presets:
                </span>
                <button
                  type="button"
                  onClick={handlePresetNow}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                  <span>Now</span>
                </button>
                <button
                  type="button"
                  onClick={handlePresetOriginal}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Original Author Date</span>
                </button>
                <button
                  type="button"
                  onClick={handlePresetCommitterDate}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1"
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>Match Committer Date</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetOffset(-1)}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  -1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetOffset(-24)}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  -1 Day
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: Committer Date Handling */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                <Clock className="w-4 h-4 text-purple-500" />
                <span>Committer Date Handling</span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">
                Original: {new Date(commit.committer_date).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                className={`flex items-start gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  committerDateMode === 'sync'
                    ? 'border-blue-500/40 bg-blue-500/5 text-zinc-900 dark:text-zinc-100'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="committerDateMode"
                  value="sync"
                  checked={committerDateMode === 'sync'}
                  onChange={() => setCommitterDateMode('sync')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="font-medium block text-[11px]">Sync with Author Date</span>
                  <span className="text-[10px] text-zinc-500">
                    Sets Committer Date to exactly match Author Date
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  committerDateMode === 'now'
                    ? 'border-blue-500/40 bg-blue-500/5 text-zinc-900 dark:text-zinc-100'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="committerDateMode"
                  value="now"
                  checked={committerDateMode === 'now'}
                  onChange={() => setCommitterDateMode('now')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="font-medium block text-[11px]">Current Time (Now)</span>
                  <span className="text-[10px] text-zinc-500">
                    Git standard default behavior on amend/rewrite
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  committerDateMode === 'original'
                    ? 'border-blue-500/40 bg-blue-500/5 text-zinc-900 dark:text-zinc-100'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="committerDateMode"
                  value="original"
                  checked={committerDateMode === 'original'}
                  onChange={() => setCommitterDateMode('original')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="font-medium block text-[11px]">Preserve Original</span>
                  <span className="text-[10px] text-zinc-500">
                    Retains current committer timestamp
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  committerDateMode === 'custom'
                    ? 'border-blue-500/40 bg-blue-500/5 text-zinc-900 dark:text-zinc-100'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="committerDateMode"
                  value="custom"
                  checked={committerDateMode === 'custom'}
                  onChange={() => setCommitterDateMode('custom')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="font-medium block text-[11px]">Custom Committer Date</span>
                  <span className="text-[10px] text-zinc-500">Specify explicit datetime</span>
                </div>
              </label>
            </div>

            {committerDateMode === 'custom' && (
              <div className="pt-1">
                <label
                  htmlFor={committerDateTimeInputId}
                  className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1"
                >
                  Custom Committer Date and Time
                </label>
                <input
                  id={committerDateTimeInputId}
                  type="datetime-local"
                  step="1"
                  value={customCommitterDateLocal}
                  onChange={(e) => setCustomCommitterDateLocal(e.target.value)}
                  disabled={submitting}
                  className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* SECTION 4: Optional Commit Message Edit */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor={editMessageCheckboxId}
                className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer select-none"
              >
                <input
                  id={editMessageCheckboxId}
                  type="checkbox"
                  checked={isEditingMessage}
                  onChange={(e) => setIsEditingMessage(e.target.checked)}
                  disabled={submitting}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                />
                <GitCommit className="w-4 h-4 text-zinc-500" />
                <span>Also Modify Commit Message</span>
              </label>
              {!isEditingMessage && (
                <span className="text-[10px] font-mono text-zinc-500">
                  Preserved via <code className="text-zinc-700 dark:text-zinc-300">--no-edit</code>
                </span>
              )}
            </div>

            {isEditingMessage && (
              <div>
                <label htmlFor={commitMessageTextareaId} className="sr-only">
                  Commit message
                </label>
                <textarea
                  id={commitMessageTextareaId}
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                  placeholder="Commit message..."
                  className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* SECTION 5: Real-time Command Preview */}
          <div className="p-3 rounded-lg bg-zinc-900 text-zinc-200 font-mono text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>Git Command Preview</span>
              </div>
              <span>Level 1 / 2 Power Tool</span>
            </div>
            <div className="text-emerald-400 break-all select-all font-mono leading-relaxed">
              $ {commandPreview}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div>
              {!isHead && onStartInteractiveRebase && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartInteractiveRebase(commit.sha, commit.subject);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Open in Interactive Rebase Wizard</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isHead ? 'Amend HEAD Commit' : 'Rewrite Commit via Rebase'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
