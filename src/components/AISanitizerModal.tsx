import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCw,
  Trash2,
  FileCode,
  History,
  ArrowRight,
  Shield,
  Layers,
  Wand2,
  Check,
} from 'lucide-react';
import type { AITraceFinding, CleanAITracesOptions, CleanAITracesResult, Theme } from '../types';
import { auditRepositoryHistory, cleanAITraces } from '../ipc';

interface AISanitizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  theme: Theme;
  onSuccess?: () => void;
}

export const AISanitizerModal: React.FC<AISanitizerModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  theme: _theme,
  onSuccess,
}) => {
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [traces, setTraces] = useState<AITraceFinding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleanAITracesResult | null>(null);

  // Cleaning options
  const [cleanBanners, setCleanBanners] = useState(true);
  const [cleanHistoryBanners, setCleanHistoryBanners] = useState(true);
  const [cleanTrailersInHistory, setCleanTrailersInHistory] = useState(true);
  const [cleanComments, setCleanComments] = useState(true);
  const [removeConfigFiles, setRemoveConfigFiles] = useState(true);
  const [createBackup, setCreateBackup] = useState(true);
  const [showDiffPreview, setShowDiffPreview] = useState(false);

  // Load / scan repository on open
  useEffect(() => {
    if (isOpen && repoPath) {
      handleScan();
    }
  }, [isOpen, repoPath]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const auditRes = await auditRepositoryHistory(repoPath, 150);
      setTraces(auditRes.ai_traces || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Scan failed: ${msg}`);
    } finally {
      setScanning(false);
    }
  };

  const handleExecuteClean = async (mode: 'all' | 'working_tree' | 'history') => {
    setCleaning(true);
    setError(null);
    setResult(null);

    const options: CleanAITracesOptions = {
      repoPath,
      cleanBanners: mode === 'history' ? false : cleanBanners,
      cleanCommentWatermarks: mode === 'history' ? false : cleanComments,
      removeConfigFiles: mode === 'history' ? false : removeConfigFiles,
      cleanTrailersInHistory: mode === 'working_tree' ? false : cleanTrailersInHistory,
      cleanHistoryBanners: mode === 'working_tree' ? false : cleanHistoryBanners,
      createSafetyBackup: createBackup,
    };

    try {
      const res = await cleanAITraces(repoPath, options);
      setResult(res);
      if (res.success) {
        // Re-scan to show updated clean state
        const updatedAudit = await auditRepositoryHistory(repoPath, 100);
        setTraces(updatedAudit.ai_traces || []);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(res.error || 'Sanitization failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Clean operation failed: ${msg}`);
    } finally {
      setCleaning(false);
    }
  };

  if (!isOpen) return null;

  const banners = traces.filter((t) => t.type === 'banner');
  const trailers = traces.filter((t) => t.type === 'trailer');
  const files = traces.filter((t) => t.type === 'file_marker');
  const comments = traces.filter((t) => t.type === 'comment');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-hidden">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">AI Signs &amp; Signature Sanitizer</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-medium">
                  1-Click Cleaner
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Automatically detect and strip Built with AI Studio banners, Cursor / Copilot co-author commit trailers, and generator watermarks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning || cleaning}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Re-scan repository"
            >
              <RotateCw className={`w-4 h-4 ${scanning ? 'animate-spin text-purple-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Sanitization Completed Successfully!</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-300">
                Removed <strong>{result.total_traces_removed}</strong> AI signatures/artifacts in {result.duration_ms}ms.
              </p>
              {result.cleaned_files.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-zinc-500">Modified Files:</span>
                  <div className="flex flex-wrap gap-1">
                    {result.cleaned_files.map((f, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded font-mono text-[10px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.backup_ref && (
                <p className="text-[11px] text-zinc-400 font-mono">
                  Safety backup reference created at: <span className="text-purple-600 dark:text-purple-400">{result.backup_ref}</span>
                </p>
              )}
            </div>
          )}

          {/* Detected Traces Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                Detected AI Signs &amp; Watermarks ({traces.length})
              </h3>
              {scanning && (
                <span className="text-[11px] text-purple-600 dark:text-purple-400 animate-pulse font-mono">
                  Scanning repository...
                </span>
              )}
            </div>

            {traces.length === 0 && !scanning ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Clean Repository! No AI Signs Detected
                </h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  No Built with AI Studio banners, Cursor / Copilot co-author commit trailers, or generator watermarks were found.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Category 1: Banners & Badges */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-purple-500" />
                      HTML &amp; Markdown Banners ({banners.length})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono">
                      Working Tree / README
                    </span>
                  </div>
                  {banners.length === 0 ? (
                    <p className="text-[11px] text-zinc-400">No promotional banners found in files.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {banners.map((b, i) => (
                        <div key={i} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-750 text-[11px] space-y-1">
                          <div className="font-mono text-zinc-800 dark:text-zinc-200 font-medium">
                            {b.file_path}
                          </div>
                          <div className="text-[10px] text-zinc-500 line-clamp-2 font-mono bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded">
                            {b.snippet || b.details}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category 2: Commit Trailers */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-blue-500" />
                      Commit Co-Author Trailers ({trailers.length})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                      Commit Messages
                    </span>
                  </div>
                  {trailers.length === 0 ? (
                    <p className="text-[11px] text-zinc-400">No AI trailers in commit history.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {trailers.map((t, i) => (
                        <div key={i} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-750 text-[11px] space-y-0.5">
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="text-purple-600 dark:text-purple-400 font-bold">
                              {t.commit_sha?.slice(0, 7)}
                            </span>
                            <span className="text-zinc-400 truncate max-w-xs">{t.commit_subject}</span>
                          </div>
                          <div className="text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">
                            {t.marker}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category 3: Config Files */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-500" />
                      AI Config / Rules Files ({files.length})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
                      Filesystem
                    </span>
                  </div>
                  {files.length === 0 ? (
                    <p className="text-[11px] text-zinc-400">No .cursorrules or AI config files found.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[11px]">
                      {files.map((f, i) => (
                        <div key={i} className="p-1.5 rounded bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-750">
                          {f.file_path}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category 4: In-Code Watermarks */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-emerald-500" />
                      Code Comments &amp; Watermarks ({comments.length})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                      Source Code
                    </span>
                  </div>
                  {comments.length === 0 ? (
                    <p className="text-[11px] text-zinc-400">No comment watermarks found.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {comments.map((c, i) => (
                        <div key={i} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-750 text-[11px]">
                          <div className="font-mono text-zinc-800 dark:text-zinc-200 truncate">
                            {c.file_path}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">
                            {c.marker}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview of AI Banner Clean Target */}
          <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" />
                Target AI Artifacts to Auto-Remove (e.g. Initial Commit AI Banner)
              </span>
              <button
                type="button"
                onClick={() => setShowDiffPreview(!showDiffPreview)}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer font-medium"
              >
                {showDiffPreview ? 'Hide banner diff snippet' : 'View banner snippet to remove'}
              </button>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              When projects are generated, tools like AI Studio place hero promotional banners and Cursor adds co-author trailers into the initial project commit. Git Workbench rewrites history to cleanly purge these traces in 1-click without manual effort.
            </p>
            {showDiffPreview && (
              <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-3 font-mono text-[10px] space-y-1 overflow-x-auto text-zinc-200">
                <div className="text-zinc-500 pb-1 border-b border-zinc-800">
                  README.md (Lines automatically stripped from Initial Commit &amp; working files):
                </div>
                <div className="bg-rose-500/20 text-rose-300 p-1.5 rounded space-y-0.5 line-through decoration-rose-500/60">
                  <div>- &lt;div align=&quot;center&quot;&gt;</div>
                  <div>-   &lt;img width=&quot;1200&quot; height=&quot;475&quot; alt=&quot;GHBanner&quot; src=&quot;https://github.com/.../0aa67016-6eaf...&quot; /&gt;</div>
                  <div>-   &lt;h1&gt;Built with AI Studio&lt;/h2&gt;</div>
                  <div>-   &lt;p&gt;The fastest path from prompt to production with Gemini.&lt;/p&gt;</div>
                  <div>-   &lt;a href=&quot;https://aistudio.google.com/apps&quot;&gt;Start building&lt;/a&gt;</div>
                  <div>- &lt;/div&gt;</div>
                </div>
                <div className="bg-rose-500/20 text-rose-300 p-1.5 rounded space-y-0.5 line-through decoration-rose-500/60">
                  <div>- Co-authored-by: Cursor &lt;cursor@cursor.sh&gt;</div>
                  <div>- Generated-by: Cursor</div>
                </div>
              </div>
            )}
          </div>

          {/* Cleaning Options Checklist */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 space-y-2.5">
            <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Select What to Automatically Sanitize:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <input
                  type="checkbox"
                  checked={cleanBanners}
                  onChange={(e) => setCleanBanners(e.target.checked)}
                  className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                    Strip Banners from Working Tree
                  </span>
                  <span className="text-[11px] text-zinc-500 leading-tight">
                    Removes Built with AI Studio block, GHBanner image, and v0 badges from README files on disk.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <input
                  type="checkbox"
                  checked={cleanHistoryBanners}
                  onChange={(e) => setCleanHistoryBanners(e.target.checked)}
                  className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                    Rewrite History to Purge Initial Commit Banner
                  </span>
                  <span className="text-[11px] text-zinc-500 leading-tight">
                    Rewrites all commits so the initial commit itself is 100% clean of AI Studio banner blocks.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <input
                  type="checkbox"
                  checked={cleanTrailersInHistory}
                  onChange={(e) => setCleanTrailersInHistory(e.target.checked)}
                  className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                    Scrub Co-Author Trailers from History
                  </span>
                  <span className="text-[11px] text-zinc-500 leading-tight">
                    Purges Co-authored-by: Cursor / Copilot and AI-Assisted lines from all commit messages.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <input
                  type="checkbox"
                  checked={cleanComments}
                  onChange={(e) => setCleanComments(e.target.checked)}
                  className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                    Remove In-Code Watermarks
                  </span>
                  <span className="text-[11px] text-zinc-500 leading-tight">
                    Removes &quot;// Generated by Cursor&quot; or &quot;&lt;!-- Built with... --&gt;&quot; comments.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <input
                  type="checkbox"
                  checked={removeConfigFiles}
                  onChange={(e) => setRemoveConfigFiles(e.target.checked)}
                  className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                    Delete AI Config Files
                  </span>
                  <span className="text-[11px] text-zinc-500 leading-tight">
                    Removes .cursorrules, .cursor/rules, and copilot instruction files from disk and history.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/80 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={createBackup}
                  onChange={(e) => setCreateBackup(e.target.checked)}
                  className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                />
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span>Create automatic safety backup ref before sanitizing</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExecuteClean('working_tree')}
              disabled={cleaning || scanning}
              className="px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              Clean Working Tree Only
            </button>

            <button
              type="button"
              onClick={() => handleExecuteClean('history')}
              disabled={cleaning || scanning}
              className="px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              Scrub History Commits Only
            </button>

            <button
              type="button"
              onClick={() => handleExecuteClean('all')}
              disabled={cleaning || scanning}
              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {cleaning ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Sanitizing Repository...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>⚡ Deep Clean All AI Signs (1-Click)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
