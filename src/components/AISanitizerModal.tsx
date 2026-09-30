import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCw,
  FileCode,
  History,
  Shield,
  Layers,
  Wand2,
  Check,
  ArrowRight,
  Undo2,
  Lock,
  GitCommit,
  UploadCloud,
  FileText,
  Copy,
  Download,
  AlertCircle,
} from 'lucide-react';
import type {
  AITraceFinding,
  CleanAITracesOptions,
  CleanAITracesResult,
  Theme,
  ClassifiedFinding,
  WorkingTreeEditPreview,
  WorkingTreeCleanupResult,
  HeadCommitAmendPreview,
  HeadCommitAmendResult,
  HistoryRewriteScope,
  HistoryRewriteResult,
  RemotePublishScope,
  RemotePublishResult,
  PostPublishChecklist,
} from '../types';
import {
  auditRepositoryHistory,
  cleanAITraces,
  getCleanupEligibility,
  buildWorkingTreeCleanupPreview,
  applyWorkingTreeCleanup,
  undoWorkingTreeCleanup,
  buildHeadCommitCleanupPreview,
  amendHeadCommitCleanup,
  buildHistoryRewriteScope,
  acknowledgeHistoryRewrite,
  createIsolatedRewriteWorkspace,
  createRewriteBackup,
  verifyRewriteBackup,
  applyHistoryRewrite,
  validateHistoryRewrite,
  buildRemotePublishScope,
  acknowledgeRemotePublish,
  publishRewrittenHistory,
  getPostPublishChecklist,
  exportPostPublishChecklist,
} from '../ipc';

interface AISanitizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  theme: Theme;
  onSuccess?: () => void;
}

type TabMode = 'quick' | 'review' | 'working_tree' | 'head_amend' | 'history_rewrite' | 'remote_publish' | 'checklist';

export const AISanitizerModal: React.FC<AISanitizerModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  theme: _theme,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('quick');
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [traces, setTraces] = useState<AITraceFinding[]>([]);
  const [classifiedFindings, setClassifiedFindings] = useState<ClassifiedFinding[]>([]);
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleanAITracesResult | null>(null);

  // Quick Cleaning options
  const [cleanBanners, setCleanBanners] = useState(true);
  const [cleanHistoryBanners, setCleanHistoryBanners] = useState(true);
  const [cleanTrailersInHistory, setCleanTrailersInHistory] = useState(true);
  const [cleanComments, setCleanComments] = useState(true);
  const [removeConfigFiles, setRemoveConfigFiles] = useState(true);
  const [createBackup, setCreateBackup] = useState(true);
  const [showDiffPreview, setShowDiffPreview] = useState(false);

  // Working Tree Cleanup State
  const [wtPreviews, setWtPreviews] = useState<WorkingTreeEditPreview[]>([]);
  const [wtUndoOperationId, setWtUndoOperationId] = useState<string | null>(null);
  const [wtCleanupResult, setWtCleanupResult] = useState<WorkingTreeCleanupResult | null>(null);

  // HEAD Amend State
  const [headPreview, setHeadPreview] = useState<HeadCommitAmendPreview | null>(null);
  const [headAmendResult, setHeadAmendResult] = useState<HeadCommitAmendResult | null>(null);

  // History Rewrite State (Risk 4)
  const [rewriteScope, setRewriteScope] = useState<HistoryRewriteScope | null>(null);
  const [rewriteResult, setRewriteResult] = useState<HistoryRewriteResult | null>(null);
  const [firstConfirmCheckboxes, setFirstConfirmCheckboxes] = useState({
    understand_new_shas: false,
    understand_signature_loss: false,
    understand_collaborator_impact: false,
    understand_external_copies: false,
    reviewed_scope: false,
  });
  const [firstConfirmTypedPhrase, setFirstConfirmTypedPhrase] = useState('');
  const [isFirstConfirmOpen, setIsFirstConfirmOpen] = useState(false);
  const [rewriteStepStatus, setRewriteStepStatus] = useState<string>('');

  // Remote Publish State (Risk 4)
  const [publishScope, setPublishScope] = useState<RemotePublishScope | null>(null);
  const [publishResult, setPublishResult] = useState<RemotePublishResult | null>(null);
  const [secondConfirmCheckboxes, setSecondConfirmCheckboxes] = useState({
    verified_remote_url: false,
    reviewed_refs: false,
    notify_collaborators: false,
    understand_old_clones: false,
    secret_rotation_acknowledged: false,
    cannot_remove_external: false,
  });
  const [secondConfirmTypedPhrase, setSecondConfirmTypedPhrase] = useState('');
  const [isSecondConfirmOpen, setIsSecondConfirmOpen] = useState(false);

  // Checklist State
  const [checklist, setChecklist] = useState<PostPublishChecklist | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

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
      const rawTraces = auditRes.ai_traces || [];
      setTraces(rawTraces);

      // Revalidate and classify findings
      const classified = await getCleanupEligibility(repoPath, rawTraces);
      setClassifiedFindings(classified);

      // Auto-select findings marked selectable and selected_by_default
      const defaultSelected = classified.filter((f) => f.selectable && f.selected_by_default).map((f) => f.id);
      setSelectedFindingIds(defaultSelected);
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

  // Area A: Working Tree Handlers
  const handleLoadWorkingTreePreview = async () => {
    setCleaning(true);
    setError(null);
    try {
      const previews = await buildWorkingTreeCleanupPreview(repoPath, selectedFindingIds);
      setWtPreviews(previews);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaning(false);
    }
  };

  const handleApplyWorkingTreeCleanup = async () => {
    setCleaning(true);
    setError(null);
    try {
      const res = await applyWorkingTreeCleanup(repoPath, selectedFindingIds, 'user-approved-wt');
      setWtCleanupResult(res);
      if (res.success) {
        setWtUndoOperationId(res.operation_id);
        handleScan();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaning(false);
    }
  };

  const handleUndoWorkingTreeCleanup = async () => {
    if (!wtUndoOperationId) return;
    setCleaning(true);
    setError(null);
    try {
      const res = await undoWorkingTreeCleanup(repoPath, wtUndoOperationId);
      setWtUndoOperationId(null);
      setWtCleanupResult(res);
      handleScan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaning(false);
    }
  };

  // Area B: HEAD Commit Handlers
  const handleLoadHeadPreview = async () => {
    setCleaning(true);
    setError(null);
    try {
      const preview = await buildHeadCommitCleanupPreview(repoPath, selectedFindingIds);
      setHeadPreview(preview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaning(false);
    }
  };

  const handleAmendHeadCommit = async () => {
    setCleaning(true);
    setError(null);
    try {
      const res = await amendHeadCommitCleanup(repoPath, selectedFindingIds, 'user-approved-head');
      setHeadAmendResult(res);
      handleScan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaning(false);
    }
  };

  // Area D: History Rewrite Handlers
  const handleBuildRewriteScope = async () => {
    setCleaning(true);
    setError(null);
    try {
      const scope = await buildHistoryRewriteScope(repoPath, selectedFindingIds, ['refs/heads/*']);
      setRewriteScope(scope);
      setIsFirstConfirmOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaning(false);
    }
  };

  const handleExecuteHistoryRewrite = async () => {
    if (!rewriteScope) return;
    setCleaning(true);
    setError(null);
    setIsFirstConfirmOpen(false);

    try {
      setRewriteStepStatus('Validating authorization & confirmation phrase...');
      await acknowledgeHistoryRewrite(
        repoPath,
        rewriteScope.operation_id,
        firstConfirmCheckboxes,
        firstConfirmTypedPhrase
      );

      setRewriteStepStatus('Creating isolated mirror workspace (disposable clone)...');
      await createIsolatedRewriteWorkspace(repoPath, rewriteScope.operation_id);

      setRewriteStepStatus('Creating Git bundle backup (pre-rewrite.bundle)...');
      await createRewriteBackup(repoPath, rewriteScope.operation_id);

      setRewriteStepStatus('Verifying Git bundle backup integrity...');
      await verifyRewriteBackup(repoPath, rewriteScope.operation_id);

      setRewriteStepStatus('Executing narrow historical filter in mirror clone...');
      const res = await applyHistoryRewrite(repoPath, rewriteScope.operation_id);
      setRewriteResult(res);

      setRewriteStepStatus('Validating rewritten mirror clone (git fsck --full)...');
      const valRes = await validateHistoryRewrite(repoPath, rewriteScope.operation_id);
      setRewriteResult(valRes);

      // Load post-publish checklist
      const chk = await getPostPublishChecklist(repoPath, rewriteScope.operation_id);
      setChecklist(chk);

      handleScan();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaning(false);
      setRewriteStepStatus('');
    }
  };

  // Area E: Remote Publication Handlers
  const handleLoadPublishScope = async () => {
    if (!rewriteScope) return;
    setCleaning(true);
    setError(null);
    try {
      const pScope = await buildRemotePublishScope(
        repoPath,
        rewriteScope.operation_id,
        'origin',
        'selected_branch_force_with_lease'
      );
      setPublishScope(pScope);
      setIsSecondConfirmOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaning(false);
    }
  };

  const handleExecuteRemotePublish = async () => {
    if (!rewriteScope) return;
    setCleaning(true);
    setError(null);
    setIsSecondConfirmOpen(false);

    try {
      await acknowledgeRemotePublish(
        repoPath,
        rewriteScope.operation_id,
        secondConfirmCheckboxes,
        secondConfirmTypedPhrase
      );
      const res = await publishRewrittenHistory(repoPath, rewriteScope.operation_id);
      setPublishResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaning(false);
    }
  };

  const handleExportChecklist = async () => {
    if (!rewriteScope) return;
    try {
      const exp = await exportPostPublishChecklist(repoPath, rewriteScope.operation_id);
      setExportNotice(`Exported checklist to ${exp.export_path}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!isOpen) return null;

  const banners = traces.filter((t) => t.type === 'banner');
  const trailers = traces.filter((t) => t.type === 'trailer');
  const files = traces.filter((t) => t.type === 'file_marker');
  const comments = traces.filter((t) => t.type === 'comment');

  const allFirstCheckboxesChecked =
    firstConfirmCheckboxes.understand_new_shas &&
    firstConfirmCheckboxes.understand_signature_loss &&
    firstConfirmCheckboxes.understand_collaborator_impact &&
    firstConfirmCheckboxes.understand_external_copies &&
    firstConfirmCheckboxes.reviewed_scope;

  const firstConfirmPhraseMatches = firstConfirmTypedPhrase.trim() === 'REWRITE SELECTED HISTORY';

  const allSecondCheckboxesChecked =
    secondConfirmCheckboxes.verified_remote_url &&
    secondConfirmCheckboxes.reviewed_refs &&
    secondConfirmCheckboxes.notify_collaborators &&
    secondConfirmCheckboxes.understand_old_clones &&
    secondConfirmCheckboxes.secret_rotation_acknowledged &&
    secondConfirmCheckboxes.cannot_remove_external;

  const secondConfirmPhraseMatches =
    secondConfirmTypedPhrase.trim() === `PUBLISH REWRITTEN HISTORY TO ${publishScope?.remote_name || 'origin'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-hidden">
      <div className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">
        
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
                  Controlled Artefact Cleanup
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Safely inspect, review, and remove repository-visible AI artefacts from working files, HEAD commits, and historical refs.
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

        {/* Tab Navigation */}
        <div className="px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 flex items-center gap-2 overflow-x-auto text-xs shrink-0 font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('quick')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'quick'
                ? 'bg-purple-600 text-white font-semibold shadow-sm ring-1 ring-purple-400/50'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 font-medium'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>1-Click Cleaner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'review'
                ? 'bg-purple-600 text-white font-semibold shadow-sm ring-1 ring-purple-400/50'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 font-medium'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Scope &amp; Eligibility</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'review'
                  ? 'bg-purple-700 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              {classifiedFindings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('working_tree');
              handleLoadWorkingTreePreview();
            }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'working_tree'
                ? 'bg-purple-600 text-white font-semibold shadow-sm ring-1 ring-purple-400/50'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 font-medium'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Working Tree</span>
            <span className="text-[10px] opacity-75 font-mono">(Warning 1)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('head_amend');
              handleLoadHeadPreview();
            }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'head_amend'
                ? 'bg-purple-600 text-white font-semibold shadow-sm ring-1 ring-purple-400/50'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 font-medium'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 text-amber-400" />
            <span>HEAD Commit</span>
            <span className="text-[10px] opacity-75 font-mono">(Warning 2)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history_rewrite')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'history_rewrite'
                ? 'bg-purple-600 text-white font-semibold shadow-sm ring-1 ring-purple-400/50'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 font-medium'
            }`}
          >
            <History className="w-3.5 h-3.5 text-rose-400" />
            <span>History Rewrite</span>
            <span className="text-[10px] opacity-75 font-mono">(Warning 4)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('remote_publish')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'remote_publish'
                ? 'bg-purple-600 text-white font-semibold shadow-sm ring-1 ring-purple-400/50'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 font-medium'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
            <span>Remote Publish</span>
            <span className="text-[10px] opacity-75 font-mono">(Warning 4)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-xs ${
              activeTab === 'checklist'
                ? 'bg-purple-600 text-white font-semibold shadow-sm ring-1 ring-purple-400/50'
                : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 font-medium'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>Post-Publish Checklist</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {rewriteStepStatus && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs flex items-center gap-2 animate-pulse">
              <RotateCw className="w-4 h-4 animate-spin shrink-0" />
              <span className="font-mono">{rewriteStepStatus}</span>
            </div>
          )}

          {/* TAB 1: QUICK 1-CLICK CLEANER */}
          {activeTab === 'quick' && (
            <div className="space-y-4">
              {result && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sanitization Completed Successfully!</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300">
                    Removed <strong>{result.total_traces_removed}</strong> AI signatures/artifacts in {result.duration_ms}ms.
                  </p>
                  {result.backup_ref && (
                    <p className="text-[11px] text-zinc-400 font-mono">
                      Safety backup reference created at: <span className="text-purple-600 dark:text-purple-400">{result.backup_ref}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Detected Traces Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/90 space-y-2">
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
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {banners.map((b, i) => (
                        <div key={i} className="p-2 rounded-lg bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 text-[11px]">
                          <div className="font-mono text-zinc-800 dark:text-zinc-200 font-medium">{b.file_path}</div>
                          <div className="text-[10px] text-zinc-500 line-clamp-2 font-mono bg-zinc-100 dark:bg-zinc-800 p-1 rounded mt-1">
                            {b.snippet || b.details}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/90 space-y-2">
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
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {trailers.map((t, i) => (
                        <div key={i} className="p-2 rounded-lg bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 text-[11px]">
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="text-purple-600 dark:text-purple-400 font-bold">{t.commit_sha?.slice(0, 7)}</span>
                            <span className="text-zinc-400 truncate max-w-xs">{t.commit_subject}</span>
                          </div>
                          <div className="text-zinc-700 dark:text-zinc-300 font-mono text-[10px] mt-1">{t.marker}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/90 space-y-2">
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
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {files.map((f, i) => (
                        <div key={i} className="p-2 rounded-lg bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 text-[11px] font-mono">
                          {f.file_path}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-emerald-500" />
                      In-Code Watermarks ({comments.length})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                      Source Code
                    </span>
                  </div>
                  {comments.length === 0 ? (
                    <p className="text-[11px] text-zinc-400">No in-code comments or watermarks found.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {comments.map((c, i) => (
                        <div key={i} className="p-2 rounded-lg bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 text-[11px]">
                          <div className="font-mono text-zinc-800 dark:text-zinc-200 truncate">{c.file_path}</div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">{c.marker}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                {showDiffPreview && (
                  <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-3 font-mono text-[10px] space-y-1 overflow-x-auto text-zinc-200">
                    <div className="text-zinc-500 pb-1 border-b border-zinc-800">
                      README.md (Lines automatically stripped from Initial Commit &amp; working files):
                    </div>
                    <div className="bg-rose-500/20 text-rose-300 p-1.5 rounded space-y-0.5 line-through decoration-rose-500/60">
                      <div>- &lt;div align=&quot;center&quot;&gt;</div>
                      <div>-   &lt;h1&gt;Built with AI Studio&lt;/h2&gt;</div>
                      <div>- &lt;/div&gt;</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cleaning Options Checklist */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 space-y-2.5">
                <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">1-Click Sanitization Targets:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={cleanBanners}
                      onChange={(e) => setCleanBanners(e.target.checked)}
                      className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 block">Strip Banners from Working Tree</span>
                      <span className="text-[11px] text-zinc-500 leading-tight">Removes Built with AI Studio and GHBanner blocks from README files.</span>
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
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 block">Purge Initial Commit AI Banner</span>
                      <span className="text-[11px] text-zinc-500 leading-tight">Rewrites history so the initial project commit is 100% clean.</span>
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
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 block">Scrub Co-Author Trailers</span>
                      <span className="text-[11px] text-zinc-500 leading-tight">Purges Co-authored-by: Cursor / Copilot from commit messages.</span>
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
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 block">Remove In-Code Watermarks</span>
                      <span className="text-[11px] text-zinc-500 leading-tight">Removes AI code comments and generation watermarks.</span>
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
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 block">Remove .cursorrules</span>
                      <span className="text-[11px] text-zinc-500 leading-tight">Deletes .cursorrules and AI tool configuration files.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={createBackup}
                      onChange={(e) => setCreateBackup(e.target.checked)}
                      className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 block">Automatic Safety Backup Ref</span>
                      <span className="text-[11px] text-zinc-500 leading-tight">Creates a reversible backup reference before modifying commits.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCOPE & ELIGIBILITY */}
          {activeTab === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    Finding Scope &amp; Eligibility Classification
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Safety guardrails automatically protect human co-authors and compliance records.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const selectable = classifiedFindings.filter((f) => f.selectable).map((f) => f.id);
                      setSelectedFindingIds(selectable);
                    }}
                    className="text-[11px] text-purple-600 hover:underline cursor-pointer"
                  >
                    Select All Eligible
                  </button>
                  <span className="text-zinc-400">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFindingIds([])}
                    className="text-[11px] text-zinc-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500">
                    <tr>
                      <th className="p-2.5 w-10 text-center">Select</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Target / Location</th>
                      <th className="p-2.5">Warning Level</th>
                      <th className="p-2.5">Status &amp; Safety Boundary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {classifiedFindings.map((cf) => {
                      const isSelected = selectedFindingIds.includes(cf.id);
                      return (
                        <tr
                          key={cf.id}
                          className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 ${
                            !cf.selectable ? 'opacity-60 bg-zinc-50/30 dark:bg-zinc-900/30' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            {cf.selectable ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedFindingIds([...selectedFindingIds, cf.id]);
                                  } else {
                                    setSelectedFindingIds(selectedFindingIds.filter((id) => id !== cf.id));
                                  }
                                }}
                                className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                              />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-zinc-400 mx-auto" />
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                              {cf.classification}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-xs">
                              {cf.file_path || (cf.commit_sha ? `Commit ${cf.commit_sha.slice(0, 7)}` : 'Repository')}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono truncate max-w-sm">
                              {cf.matched_text}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                cf.risk_level === 'Risk4HistoryRewrite'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                                  : cf.risk_level.startsWith('Risk2')
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {cf.risk_level}
                            </span>
                          </td>
                          <td className="p-2.5 text-[11px] text-zinc-500">
                            {cf.explanation}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: WORKING TREE CLEANER */}
          {activeTab === 'working_tree' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    Working Tree File Cleanup (Risk 1)
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Modifies working copy files directly with exact line-level replacements.
                  </p>
                </div>
                {wtUndoOperationId && (
                  <button
                    type="button"
                    onClick={handleUndoWorkingTreeCleanup}
                    disabled={cleaning}
                    className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Undo Cleanup Session
                  </button>
                )}
              </div>

              {wtPreviews.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                  Click below to inspect proposed unified diff for current working tree files.
                </div>
              ) : (
                <div className="space-y-3">
                  {wtPreviews.map((p, i) => (
                    <div key={i} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-100 font-mono text-[11px] space-y-2 overflow-x-auto">
                      <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800 pb-1">
                        <span>{p.file_path} (Lines {p.line_range[0]}-{p.line_range[1]})</span>
                        <span className="text-[10px] text-purple-400">{p.proposed_edit}</span>
                      </div>
                      <pre className="text-zinc-300 whitespace-pre-wrap">{p.proposed_diff}</pre>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleLoadWorkingTreePreview}
                  disabled={cleaning}
                  className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Refresh Preview
                </button>
                <button
                  type="button"
                  onClick={handleApplyWorkingTreeCleanup}
                  disabled={cleaning}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium cursor-pointer"
                >
                  Apply Working Tree Edits
                </button>
              </div>

              {wtCleanupResult && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs space-y-1 font-mono">
                  <div className="text-emerald-600 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Working Tree Cleaned</span>
                  </div>
                  <div>Changed: {wtCleanupResult.changed_files.join(', ') || 'None'}</div>
                  <div className="text-[11px] text-zinc-500">git diff --check: {wtCleanupResult.diff_check_stdout}</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: HEAD COMMIT AMEND */}
          {activeTab === 'head_amend' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                  Current HEAD Commit Metadata Cleanup (Warning 2 / Warning 3)
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Amends the latest local commit to remove explicit AI trailers. Automatically creates a backup reference.
                </p>
              </div>

              {headPreview && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-zinc-400">Target Commit:</span>{' '}
                      <span className="font-bold text-purple-600">{headPreview.commit_sha.slice(0, 8)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Warning Level:</span>{' '}
                      <span className="text-blue-500 font-bold">{headPreview.risk_level}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Signed Commit:</span>{' '}
                      <span>{headPreview.is_signed ? 'Yes (Signature will invalidate)' : 'No'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Backup Ref:</span>{' '}
                      <span className="text-emerald-600 font-bold">{headPreview.backup_ref}</span>
                    </div>
                  </div>

                  {headPreview.removed_lines.length > 0 && (
                    <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 font-mono text-[11px] space-y-0.5">
                      <div className="font-semibold">Trailers to be stripped:</div>
                      {headPreview.removed_lines.map((l, i) => (
                        <div key={i} className="line-through">- {l}</div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-zinc-500 font-semibold text-[11px]">Proposed New Commit Message:</span>
                    <pre className="p-2.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] whitespace-pre-wrap">
                      {headPreview.proposed_message}
                    </pre>
                  </div>

                  <button
                    type="button"
                    onClick={handleAmendHeadCommit}
                    disabled={cleaning}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    Amend HEAD Commit Safely
                  </button>
                </div>
              )}

              {headAmendResult && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <div className="font-semibold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>HEAD Commit Amended Successfully</span>
                  </div>
                  <div className="font-mono text-[11px]">Old SHA: {headAmendResult.old_commit_sha} → New SHA: {headAmendResult.new_commit_sha}</div>
                  <div className="text-[11px] text-zinc-500">{headAmendResult.recovery_instructions}</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CONTROLLED HISTORY REWRITE */}
          {activeTab === 'history_rewrite' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-purple-600" />
                  Isolated History Rewrite (Warning 4)
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Executes inside a disposable mirror clone. Your active working copy is never touched during filtering.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs space-y-3">
                <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Controlled Safety Workflow:</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-zinc-600 dark:text-zinc-400 text-[11px]">
                  <li>Scope review &amp; finding revalidation.</li>
                  <li>First Confirmation modal requiring 5 mandatory checkboxes + exact typed authorization phrase.</li>
                  <li>Spin up isolated disposable mirror clone in segregated temporary directory.</li>
                  <li>Generate and verify complete standard Git bundle backup (<code className="text-purple-600">pre-rewrite.bundle</code>).</li>
                  <li>Apply narrow targeted filter strictly in mirror clone.</li>
                  <li>Run full integrity check (<code className="text-purple-600">git fsck --full</code>).</li>
                </ol>

                <button
                  type="button"
                  onClick={handleBuildRewriteScope}
                  disabled={cleaning}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <History className="w-3.5 h-3.5" />
                  Start Controlled History Rewrite
                </button>
              </div>

              {rewriteResult && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                  <div className="font-semibold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{rewriteResult.clear_status_message}</span>
                  </div>
                  <div className="font-mono text-[11px] space-y-0.5 text-zinc-600 dark:text-zinc-300">
                    <div>Operation ID: {rewriteResult.operation_id}</div>
                    <div>Rewritten Commits: {rewriteResult.rewritten_commits_count}</div>
                    <div>Backup Bundle: {rewriteResult.backup_bundle_path} (Verified: {String(rewriteResult.bundle_verified)})</div>
                    <div>Integrity Check (git fsck): {rewriteResult.fsck_valid ? 'PASSED' : 'FAILED'}</div>
                  </div>
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[11px]">
                    {rewriteResult.signature_warning}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: REMOTE PUBLISH */}
          {activeTab === 'remote_publish' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-blue-600" />
                  Controlled Remote Publication (Warning 4)
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Separated workflow. Requires validated local rewrite result and mandatory Second Confirmation modal.
                </p>
              </div>

              {!rewriteResult ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                  Remote publication is unavailable until an isolated history rewrite has completed and verified locally.
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs space-y-3">
                  <div className="text-zinc-800 dark:text-zinc-200 font-medium">
                    Validated Rewrite Ready for Controlled Publication
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Uses <code className="text-purple-600 font-mono">git push --force-with-lease</code> to prevent overwriting unseen remote changes.
                  </p>
                  <button
                    type="button"
                    onClick={handleLoadPublishScope}
                    disabled={cleaning}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Initiate Remote Publication Review
                  </button>
                </div>
              )}

              {publishResult && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <div className="font-semibold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Remote Publication Completed</span>
                  </div>
                  <div className="font-mono text-[11px]">Updated remote refs: {publishResult.updated_refs.join(', ')}</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: POST-PUBLISH CHECKLIST */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    Post-Rewrite Team Coordination Checklist
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Guidelines for team communication and collaborator cleanup following history rewrite.
                  </p>
                </div>
                {checklist && (
                  <button
                    type="button"
                    onClick={handleExportChecklist}
                    className="px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Checklist (.md)
                  </button>
                )}
              </div>

              {exportNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs">
                  {exportNotice}
                </div>
              )}

              {checklist ? (
                <div className="space-y-2">
                  {checklist.items.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs space-y-1">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>{item.task}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 pl-5.5">{item.recommendation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                  Run an isolated history rewrite to generate custom coordination items.
                </div>
              )}
            </div>
          )}
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

          {activeTab === 'quick' && (
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
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FIRST CONFIRMATION MODAL: HISTORY REWRITE AUTHORIZATION                   */}
      {/* ========================================================================= */}
      {isFirstConfirmOpen && rewriteScope && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-rose-500/30 rounded-2xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm">
                History rewrite will permanently change Git commit identities
              </h3>
            </div>

            <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              This action creates a rewritten copy of selected repository history. Affected commits and their descendants will receive new SHA identifiers. Existing commit/tag signatures may no longer be valid. Open pull requests, existing links to commits, local clones, forks, CI references, release artefacts, and collaborators&apos; branches may be disrupted. This operation cannot remove copies already held in other clones, forks, caches, hosting-provider pull request references, AI-provider records, or organization logs.
            </p>

            <div className="space-y-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={firstConfirmCheckboxes.understand_new_shas}
                  onChange={(e) =>
                    setFirstConfirmCheckboxes({
                      ...firstConfirmCheckboxes,
                      understand_new_shas: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I understand that rewritten commits receive new SHA identifiers.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={firstConfirmCheckboxes.understand_signature_loss}
                  onChange={(e) =>
                    setFirstConfirmCheckboxes({
                      ...firstConfirmCheckboxes,
                      understand_signature_loss: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I understand that signatures and verified status may be lost.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={firstConfirmCheckboxes.understand_collaborator_impact}
                  onChange={(e) =>
                    setFirstConfirmCheckboxes({
                      ...firstConfirmCheckboxes,
                      understand_collaborator_impact: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I understand that collaborators and pull requests may be affected.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={firstConfirmCheckboxes.understand_external_copies}
                  onChange={(e) =>
                    setFirstConfirmCheckboxes({
                      ...firstConfirmCheckboxes,
                      understand_external_copies: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I understand that this cannot erase external copies or provider-side records.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={firstConfirmCheckboxes.reviewed_scope}
                  onChange={(e) =>
                    setFirstConfirmCheckboxes({
                      ...firstConfirmCheckboxes,
                      reviewed_scope: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I reviewed the selected findings and rewrite scope.</span>
              </label>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 font-medium text-[11px]">
                Type exactly: <strong className="text-rose-600 dark:text-rose-400 font-mono">REWRITE SELECTED HISTORY</strong>
              </span>
              <input
                type="text"
                value={firstConfirmTypedPhrase}
                onChange={(e) => setFirstConfirmTypedPhrase(e.target.value)}
                placeholder="REWRITE SELECTED HISTORY"
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-xs focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFirstConfirmOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteHistoryRewrite}
                disabled={!allFirstCheckboxesChecked || !firstConfirmPhraseMatches}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs disabled:opacity-40 cursor-pointer shadow-xs"
              >
                Authorize &amp; Execute Rewrite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECOND CONFIRMATION MODAL: REMOTE PUBLICATION AUTHORIZATION               */}
      {/* ========================================================================= */}
      {isSecondConfirmOpen && publishScope && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-rose-500/30 rounded-2xl shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <UploadCloud className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm">
                Publish rewritten history to remote repository ({publishScope.remote_name})
              </h3>
            </div>

            <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              This action will replace remote Git history with rewritten commits. Other users may lose work if they push from old clones after this operation. Collaborators may need to stop work, discard old clones, re-clone, or follow controlled recovery instructions. Existing pull requests, commit links, forks, CI cache entries, release artefacts, and references to old commit IDs may break or remain accessible. This push cannot remove copies held by forks, old clones, external caches, hosting-provider records, or AI-provider records.
            </p>

            <div className="space-y-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={secondConfirmCheckboxes.verified_remote_url}
                  onChange={(e) =>
                    setSecondConfirmCheckboxes({
                      ...secondConfirmCheckboxes,
                      verified_remote_url: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I verified the remote name and sanitized remote URL ({publishScope.sanitized_remote_url}).</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={secondConfirmCheckboxes.reviewed_refs}
                  onChange={(e) =>
                    setSecondConfirmCheckboxes({
                      ...secondConfirmCheckboxes,
                      reviewed_refs: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I reviewed every remote ref that will be updated or deleted.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={secondConfirmCheckboxes.notify_collaborators}
                  onChange={(e) =>
                    setSecondConfirmCheckboxes({
                      ...secondConfirmCheckboxes,
                      notify_collaborators: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I understand collaborators must be notified before or immediately after publication.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={secondConfirmCheckboxes.understand_old_clones}
                  onChange={(e) =>
                    setSecondConfirmCheckboxes({
                      ...secondConfirmCheckboxes,
                      understand_old_clones: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I understand old clones can reintroduce rewritten history.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={secondConfirmCheckboxes.secret_rotation_acknowledged}
                  onChange={(e) =>
                    setSecondConfirmCheckboxes({
                      ...secondConfirmCheckboxes,
                      secret_rotation_acknowledged: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I understand secret rotation is required if sensitive data was exposed.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={secondConfirmCheckboxes.cannot_remove_external}
                  onChange={(e) =>
                    setSecondConfirmCheckboxes({
                      ...secondConfirmCheckboxes,
                      cannot_remove_external: e.target.checked,
                    })
                  }
                  className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                />
                <span>I understand this does not remove forks, provider records, or external copies.</span>
              </label>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 font-medium text-[11px]">
                Type exactly: <strong className="text-rose-600 dark:text-rose-400 font-mono">PUBLISH REWRITTEN HISTORY TO {publishScope.remote_name}</strong>
              </span>
              <input
                type="text"
                value={secondConfirmTypedPhrase}
                onChange={(e) => setSecondConfirmTypedPhrase(e.target.value)}
                placeholder={`PUBLISH REWRITTEN HISTORY TO ${publishScope.remote_name}`}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-xs focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSecondConfirmOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRemotePublish}
                disabled={!allSecondCheckboxesChecked || !secondConfirmPhraseMatches}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs disabled:opacity-40 cursor-pointer shadow-xs"
              >
                Publish Rewritten History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
