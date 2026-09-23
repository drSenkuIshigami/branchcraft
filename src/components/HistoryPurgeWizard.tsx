import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  FolderLock,
  Copy,
  Check,
  CheckCircle2,
  Trash2,
  Sparkles,
  ArrowRight,
  Send,
  Loader2,
  Terminal,
} from 'lucide-react';
import type {
  MirrorCloneSetupResult,
  PurgePlanOptions,
  OperationResult,
  Theme,
} from '../types';
import {
  setupIsolatedMirrorClone,
  executeHistoryPurge,
  pushMirrorToRemote,
} from '../ipc';

interface HistoryPurgeWizardProps {
  isOpen: boolean;
  repoPath: string;
  onClose: () => void;
  onSuccess: (result: OperationResult) => void;
  theme: Theme;
}

export const HistoryPurgeWizard: React.FC<HistoryPurgeWizardProps> = ({
  isOpen,
  repoPath,
  onClose,
  onSuccess,
  theme: _theme,
}) => {
  // Wizard steps: 1 = Scope & Options, 2 = Mirror Clone Setup, 3 = Review & Type Confirmation, 4 = Executing, 5 = Verify & Push
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Options
  const [pathsToPurge, setPathsToPurge] = useState<string>('');
  const [removeAITrailers, setRemoveAITrailers] = useState(true);
  const [enableAuthorRewrite, setEnableAuthorRewrite] = useState(false);
  const [authorOldEmail, setAuthorOldEmail] = useState('');
  const [authorNewName, setAuthorNewName] = useState('');
  const [authorNewEmail, setAuthorNewEmail] = useState('');

  // Setup state
  const [mirrorResult, setMirrorResult] = useState<MirrorCloneSetupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 3 Confirmation input
  const [confirmInput, setConfirmInput] = useState('');
  const REQUIRED_CONFIRM_STRING = 'PERMANENTLY PURGE HISTORY';

  // Execution result
  const [purgeResult, setPurgeResult] = useState<OperationResult | null>(null);
  const [pushingToRemote, setPushingToRemote] = useState(false);
  const [pushedSuccess, setPushedSuccess] = useState(false);

  if (!isOpen) return null;

  // Step 1 -> 2: Setup isolated mirror clone & offline bundle backup
  const handleProceedToMirror = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await setupIsolatedMirrorClone(repoPath);
      setMirrorResult(res);
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to create isolated mirror clone: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 3 -> 4: Execute purge in isolated mirror
  const handleExecutePurge = async () => {
    if (!mirrorResult) return;
    if (confirmInput.trim() !== REQUIRED_CONFIRM_STRING) {
      setError(`You must enter "${REQUIRED_CONFIRM_STRING}" exactly to continue.`);
      return;
    }

    setLoading(true);
    setError(null);
    setStep(4);

    try {
      const parsedPaths = pathsToPurge
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      const options: PurgePlanOptions = {
        paths_to_remove: parsedPaths.length > 0 ? parsedPaths : undefined,
        remove_ai_trailers: removeAITrailers,
        rewrite_authors:
          enableAuthorRewrite && authorNewName && authorNewEmail
            ? [
                {
                  from_email: authorOldEmail.trim() || undefined,
                  to_name: authorNewName.trim(),
                  to_email: authorNewEmail.trim(),
                },
              ]
            : undefined,
      };

      const result = await executeHistoryPurge(mirrorResult.mirror_path, options);
      setPurgeResult(result);
      if (result.success) {
        setStep(5);
        onSuccess(result);
      } else {
        setError(result.stderr || 'History rewrite failed during filter-branch.');
        setStep(3);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed during history purge: ${msg}`);
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Optional controlled push to remote
  const handlePushRemote = async () => {
    if (!mirrorResult || !mirrorResult.remote_url) return;
    setPushingToRemote(true);
    setError(null);
    try {
      const res = await pushMirrorToRemote(mirrorResult.mirror_path, mirrorResult.remote_url);
      if (res.success) {
        setPushedSuccess(true);
      } else {
        setError(`Failed to push to remote: ${res.stderr || res.stdout}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Push error: ${msg}`);
    } finally {
      setPushingToRemote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Wizard Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Level 4 History Purge Wizard
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white uppercase tracking-wider">
                  Risk Level 4
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Safe 7-step runbook execution with mandatory offline bundle backup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="px-6 py-2.5 bg-zinc-100/70 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-rose-600 font-semibold' : 'text-zinc-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">1</span>
            <span>Configure Plan</span>
          </div>
          <div className="w-4 h-[1px] bg-zinc-300 dark:bg-zinc-700" />
          <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-rose-600 font-semibold' : 'text-zinc-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">2</span>
            <span>Mirror Clone</span>
          </div>
          <div className="w-4 h-[1px] bg-zinc-300 dark:bg-zinc-700" />
          <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-rose-600 font-semibold' : 'text-zinc-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">3</span>
            <span>Verify & Confirm</span>
          </div>
          <div className="w-4 h-[1px] bg-zinc-300 dark:bg-zinc-700" />
          <div className={`flex items-center gap-1.5 ${step >= 5 ? 'text-emerald-600 font-semibold' : 'text-zinc-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">4</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 mx-6 mt-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* STEP 1: CONFIGURE SCOPE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Permanent History Rewriting Warning</span>
                </div>
                <p>
                  This wizard removes files or trailers across <strong>all commits and tags in repository history</strong>.
                  Before doing anything, Git Workbench will create a full offline <code>.bundle</code> backup and execute inside a temporary clone.
                </p>
              </div>

              {/* Paths to remove */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Files or Directories to Eradicate from History</span>
                </label>
                <textarea
                  value={pathsToPurge}
                  onChange={(e) => setPathsToPurge(e.target.value)}
                  placeholder="secrets.env&#10;private_key.pem&#10;videos/demo.mp4&#10;node_modules/"
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="text-[11px] text-zinc-500">
                  Enter one file path per line (relative to repository root).
                </p>
              </div>

              {/* AI trailers scrub */}
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeAITrailers}
                    onChange={(e) => setRemoveAITrailers(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>Scrub AI Commit Trailers</span>
                  </span>
                </label>
                <p className="text-[11px] text-zinc-500 pl-5">
                  Strips identifiable trailers like <code>Co-authored-by: Claude/ChatGPT/Copilot</code> from commit messages.
                </p>
              </div>

              {/* Author rewrite option */}
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableAuthorRewrite}
                    onChange={(e) => setEnableAuthorRewrite(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Rewrite Commit Author / Committer Identity
                  </span>
                </label>

                {enableAuthorRewrite && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Match Old Email (Optional)</label>
                      <input
                        type="email"
                        value={authorOldEmail}
                        onChange={(e) => setAuthorOldEmail(e.target.value)}
                        placeholder="old@work.com"
                        className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">New Author Name</label>
                      <input
                        type="text"
                        value={authorNewName}
                        onChange={(e) => setAuthorNewName(e.target.value)}
                        placeholder="New Name"
                        className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">New Author Email</label>
                      <input
                        type="email"
                        value={authorNewEmail}
                        onChange={(e) => setAuthorNewEmail(e.target.value)}
                        placeholder="new@work.com"
                        className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: MIRROR CLONE CREATED */}
          {step === 2 && mirrorResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Isolation Environment Initialized Successfully</span>
                </div>
                <p>
                  Per the safety policy, history filtering will take place in an isolated mirror clone, completely protecting your active working tree and untracked files.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                  <div className="text-[11px] text-zinc-400">Offline Bundle Restore Point</div>
                  <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate">
                    {mirrorResult.bundle_backup_path}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                  <div className="text-[11px] text-zinc-400">Isolated Mirror Workspace</div>
                  <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate">
                    {mirrorResult.mirror_path}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & TYPED CONFIRMATION */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Confirmation Required</span>
                </div>
                <p>
                  Rewriting commit history alters all commit SHAs. Anyone who has pulled the current repository will encounter divergence if updated to the rewritten history.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Type <span className="font-mono text-rose-600 dark:text-rose-400 select-all">{REQUIRED_CONFIRM_STRING}</span> to confirm execution:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={REQUIRED_CONFIRM_STRING}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          )}

          {/* STEP 4: EXECUTING SPINNER */}
          {step === 4 && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Rewriting Commit History in Mirror Clone...
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Running index filters, squelching empty commits, and verifying structural integrity with git fsck.
              </p>
            </div>
          )}

          {/* STEP 5: COMPLETED & OPTIONAL PUSH */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>History Rewritten and Verified with Git Fsck</span>
                </div>
                <p>
                  The mirror clone history has been successfully purged. All commits have been rewritten, and object store integrity is verified.
                </p>
              </div>

              {purgeResult && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-3 text-zinc-300 font-mono text-xs space-y-1">
                  <div className="text-zinc-500 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Purge Output:</span>
                  </div>
                  <pre className="overflow-x-auto max-h-32 text-[11px] leading-relaxed">
                    {purgeResult.stdout || purgeResult.stderr}
                  </pre>
                </div>
              )}

              {/* Push Section */}
              {mirrorResult?.remote_url && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Step 6: Push Purged History to Remote Origin
                      </h4>
                      <p className="text-[11px] text-zinc-500">
                        Target: <span className="font-mono">{mirrorResult.remote_url}</span>
                      </p>
                    </div>
                    {pushedSuccess && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Remote Updated
                      </span>
                    )}
                  </div>

                  {!pushedSuccess && (
                    <button
                      type="button"
                      onClick={handlePushRemote}
                      disabled={pushingToRemote}
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{pushingToRemote ? 'Pushing Mirror...' : 'Push Purged History to Remote'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Teammate Coordination Checklist */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs space-y-2">
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Step 7: Post-Rewrite Team Checklist
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600 dark:text-zinc-400 text-[11px]">
                  <li>Notify teammates to re-clone the repository fresh rather than pulling into their stale branches.</li>
                  <li>Rotate any secret credentials or API tokens that were committed, even after purging.</li>
                  <li>Close or rebase existing pull requests opened against the old commits.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {step === 5 ? 'Close' : 'Cancel'}
          </button>

          {step === 1 && (
            <button
              type="button"
              onClick={handleProceedToMirror}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>{loading ? 'Initializing Mirror...' : 'Create Backup & Mirror'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Proceed to Confirmation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={handleExecutePurge}
              disabled={loading || confirmInput.trim() !== REQUIRED_CONFIRM_STRING}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>{loading ? 'Executing Purge...' : 'Execute History Purge'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 5 && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Done</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
