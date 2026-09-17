import React, { useState } from 'react';
import { GitCommit, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import type { Theme } from '../types';

interface CommitBoxProps {
  stagedCount: number;
  lastCommitMessage?: string;
  onCommit: (message: string, isAmend: boolean) => Promise<void>;
  loading: boolean;
  theme: Theme;
}

export const CommitBox: React.FC<CommitBoxProps> = ({
  stagedCount,
  lastCommitMessage,
  onCommit,
  loading: externalLoading,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isAmend, setIsAmend] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When amend checkbox is toggled, populate with previous commit message if empty
  const handleToggleAmend = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsAmend(checked);
    if (checked && lastCommitMessage && !subject) {
      const parts = lastCommitMessage.split('\n\n');
      setSubject(parts[0] || '');
      setBody(parts.slice(1).join('\n\n') || '');
    }
  };

  const subjectLength = subject.length;
  const isSubjectTooLong = subjectLength > 72;
  const isSubjectWarning = subjectLength > 50 && subjectLength <= 72;
  const isSubjectEmpty = subject.trim().length === 0;

  const canSubmit =
    !isSubjectEmpty && (stagedCount > 0 || isAmend) && !submitting && !externalLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setSubmitting(true);
    try {
      const fullMessage = body.trim() ? `${subject.trim()}\n\n${body.trim()}` : subject.trim();
      await onCommit(fullMessage, isAmend);
      setSubject('');
      setBody('');
      setIsAmend(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-emerald-500" />
          <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
            {isAmend ? 'Amend Commit' : 'Commit Changes'}
          </span>
        </div>

        {/* Amend checkbox */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
          <input
            type="checkbox"
            checked={isAmend}
            onChange={handleToggleAmend}
            disabled={submitting || externalLoading}
            className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0 focus:ring-offset-0"
          />
          <span>Amend HEAD</span>
        </label>
      </div>

      {/* Subject Line Input */}
      <div className="space-y-1">
        <div className="relative">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={submitting || externalLoading}
            placeholder="Commit subject (e.g., feat: add commit authoring panel)"
            className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-hidden focus:border-blue-500 font-mono pr-14"
          />
          {/* Character counter (50/72 rule indicator) */}
          <span
            className={`absolute right-2 top-1.5 text-[10px] font-mono px-1 rounded ${
              isSubjectTooLong
                ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 font-bold'
                : isSubjectWarning
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                  : 'text-zinc-400'
            }`}
            title="50 chars recommended, 72 chars max recommended for subject"
          >
            {subjectLength}/50
          </span>
        </div>
      </div>

      {/* Description / Extended Body */}
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={submitting || externalLoading}
          rows={2}
          placeholder="Optional extended description..."
          className="w-full px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-hidden focus:border-blue-500 font-mono resize-y"
        />
      </div>

      {error && (
        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Bottom Bar: Status info and Submit Button */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
          {stagedCount > 0 ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle className="w-3 h-3" />
              {stagedCount} {stagedCount === 1 ? 'file' : 'files'} staged
            </span>
          ) : isAmend ? (
            <span className="text-amber-600 dark:text-amber-400">Amending last commit</span>
          ) : (
            <span className="text-zinc-400 italic">Stage files to commit</span>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors shadow-xs ${
            canSubmit
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
          }`}
        >
          {submitting || externalLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{isAmend ? 'Amending...' : 'Committing...'}</span>
            </>
          ) : (
            <>
              <GitCommit className="w-3.5 h-3.5" />
              <span>{isAmend ? 'Amend Commit' : 'Commit'}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
