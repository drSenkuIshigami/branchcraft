import React, { useState } from 'react';
import {
  GitCommit,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { Theme } from '../types';

export interface CommitAuthorOptions {
  authorName?: string;
  authorEmail?: string;
  authorDate?: string;
  committerDate?: string;
}

interface CommitBoxProps {
  stagedCount: number;
  lastCommitMessage?: string;
  onCommit: (
    message: string,
    isAmend: boolean,
    authorOptions?: CommitAuthorOptions
  ) => Promise<void>;
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

  // Author & Timestamp overrides
  const [showAuthorOptions, setShowAuthorOptions] = useState(false);
  const [customAuthorName, setCustomAuthorName] = useState('');
  const [customAuthorEmail, setCustomAuthorEmail] = useState('');
  const [customAuthorDateLocal, setCustomAuthorDateLocal] = useState('');
  const [syncCommitterDate, setSyncCommitterDate] = useState(true);

  // Helper to format date to YYYY-MM-DDTHH:mm
  const toDateTimeLocal = (dateInput: Date): string => {
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getDate()).padStart(2, '0');
    const hours = String(dateInput.getHours()).padStart(2, '0');
    const mins = String(dateInput.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

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

      let authorOptions: CommitAuthorOptions | undefined = undefined;
      if (showAuthorOptions) {
        let authorDateIso: string | undefined = undefined;
        if (customAuthorDateLocal) {
          const d = new Date(customAuthorDateLocal);
          if (!isNaN(d.getTime())) {
            authorDateIso = d.toISOString();
          }
        }
        authorOptions = {
          authorName: customAuthorName.trim() || undefined,
          authorEmail: customAuthorEmail.trim() || undefined,
          authorDate: authorDateIso,
          committerDate: syncCommitterDate ? authorDateIso : undefined,
        };
      }

      await onCommit(fullMessage, isAmend, authorOptions);
      setSubject('');
      setBody('');
      setIsAmend(false);
      setShowAuthorOptions(false);
      setCustomAuthorName('');
      setCustomAuthorEmail('');
      setCustomAuthorDateLocal('');
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

      {/* Author & Timestamp Options Toggle */}
      <div className="pt-0.5">
        <button
          type="button"
          onClick={() => setShowAuthorOptions((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium transition-colors cursor-pointer"
        >
          {showAuthorOptions ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          <Clock className="w-3 h-3 text-blue-500" />
          <span>Author & Timestamp Overrides</span>
          {(customAuthorName || customAuthorEmail || customAuthorDateLocal) && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          )}
        </button>

        {showAuthorOptions && (
          <div className="mt-2 p-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950/60 space-y-2.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-0.5">
                  Author Name
                </label>
                <input
                  type="text"
                  value={customAuthorName}
                  onChange={(e) => setCustomAuthorName(e.target.value)}
                  placeholder="Leave empty for git config default"
                  className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-0.5">
                  Author Email
                </label>
                <input
                  type="email"
                  value={customAuthorEmail}
                  onChange={(e) => setCustomAuthorEmail(e.target.value)}
                  placeholder="Leave empty for git config default"
                  className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[10px] uppercase font-bold text-zinc-500">
                  Author Date & Time
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCustomAuthorDateLocal(toDateTimeLocal(new Date()))}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setHours(d.getHours() - 1);
                      setCustomAuthorDateLocal(toDateTimeLocal(d));
                    }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    -1h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setCustomAuthorDateLocal(toDateTimeLocal(d));
                    }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    -1d
                  </button>
                  {customAuthorDateLocal && (
                    <button
                      type="button"
                      onClick={() => setCustomAuthorDateLocal('')}
                      className="text-[10px] text-rose-500 hover:underline ml-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <input
                type="datetime-local"
                step="1"
                value={customAuthorDateLocal}
                onChange={(e) => setCustomAuthorDateLocal(e.target.value)}
                className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <label className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncCommitterDate}
                onChange={(e) => setSyncCommitterDate(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600"
              />
              <span>Synchronize committer timestamp to match author timestamp</span>
            </label>
          </div>
        )}
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
