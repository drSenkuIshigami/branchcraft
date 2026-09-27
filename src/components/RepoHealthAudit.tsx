import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Key,
  FileCode,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FolderLock,
  Layers,
  Zap,
  ArrowRight,
  HardDrive,
  Copy,
  Check,
  Filter,
  Wrench,
  Trash2,
  GitBranch,
} from 'lucide-react';
import type {
  RepoAuditReport,
  SecretFinding,
  LargeFileFinding,
  AITraceFinding,
  BackupRef,
  FsckResult,
  GitHooksStatus,
  Theme,
} from '../types';
import {
  auditRepositoryHistory,
  runGitFsck,
  getBackups,
  createBackup,
  runManualAggressiveGC,
  getGitHooksStatus,
  installCommitMsgHook,
  installPreCommitHook,
  updateGitignoreAIDirectories,
} from '../ipc';
import { AISanitizerModal } from './AISanitizerModal';

interface RepoHealthAuditProps {
  repoPath: string;
  onOpenPurgeWizard: () => void;
  theme: Theme;
}

export const RepoHealthAudit: React.FC<RepoHealthAuditProps> = ({
  repoPath,
  onOpenPurgeWizard,
  theme: _theme,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'secrets' | 'large_files' | 'ai_traces' | 'backups' | 'maintenance'
  >('overview');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<RepoAuditReport | null>(null);
  const [fsck, setFsck] = useState<FsckResult | null>(null);
  const [backups, setBackups] = useState<BackupRef[]>([]);
  const [hooksStatus, setHooksStatus] = useState<GitHooksStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Backup creation in panel
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupReason, setBackupReason] = useState('');
  const [backupKind, setBackupKind] = useState<'branch' | 'bundle'>('branch');
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);

  // Manual GC state (Isolated, explicit trigger)
  const [isGcRunning, setIsGcRunning] = useState(false);
  const [gcConfirmationInput, setGcConfirmationInput] = useState('');
  const [gcResultMsg, setGcResultMsg] = useState<string | null>(null);

  // Hooks & Gitignore installation state
  const [hookSuccessMsg, setHookSuccessMsg] = useState<string | null>(null);
  const [installingAction, setInstallingAction] = useState<string | null>(null);

  // Search filter inside findings
  const [filterQuery, setFilterQuery] = useState('');
  const [isAISanitizerOpen, setIsAISanitizerOpen] = useState(false);

  const loadHealthData = async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const [auditRes, fsckRes, backupsRes, hooksRes] = await Promise.all([
        auditRepositoryHistory(repoPath, 100),
        runGitFsck(repoPath),
        getBackups(repoPath),
        getGitHooksStatus(repoPath),
      ]);
      setReport(auditRes);
      setFsck(fsckRes);
      setBackups(backupsRes);
      setHooksStatus(hooksRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to perform repository health audit: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallCommitMsgHook = async (mode: 'strip' | 'reject') => {
    if (!repoPath) return;
    setInstallingAction(`commit-msg-${mode}`);
    setHookSuccessMsg(null);
    try {
      const res = await installCommitMsgHook(repoPath, mode);
      setHookSuccessMsg(res.stdout || `Installed commit-msg hook (${mode} mode).`);
      const updated = await getGitHooksStatus(repoPath);
      setHooksStatus(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to install commit-msg hook: ${msg}`);
    } finally {
      setInstallingAction(null);
    }
  };

  const handleInstallPreCommitHook = async () => {
    if (!repoPath) return;
    setInstallingAction('pre-commit');
    setHookSuccessMsg(null);
    try {
      const res = await installPreCommitHook(repoPath);
      setHookSuccessMsg(
        res.stdout || 'Installed pre-commit hook with secret scanner and large file guard.'
      );
      const updated = await getGitHooksStatus(repoPath);
      setHooksStatus(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to install pre-commit hook: ${msg}`);
    } finally {
      setInstallingAction(null);
    }
  };

  const handleAddAIDirectoriesToGitignore = async () => {
    if (!repoPath) return;
    setInstallingAction('gitignore');
    setHookSuccessMsg(null);
    try {
      const res = await updateGitignoreAIDirectories(repoPath);
      setHookSuccessMsg(res.stdout || 'Added AI tool workspace directories to .gitignore.');
      const updated = await getGitHooksStatus(repoPath);
      setHooksStatus(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to update .gitignore: ${msg}`);
    } finally {
      setInstallingAction(null);
    }
  };

  const handleRunAggressiveGC = async () => {
    if (!repoPath || gcConfirmationInput.trim() !== 'PRUNE NOW') return;
    setIsGcRunning(true);
    setGcResultMsg(null);
    try {
      const res = await runManualAggressiveGC(repoPath);
      setGcResultMsg(res.stdout);
      setGcConfirmationInput('');
      // Refresh fsck and report
      await loadHealthData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to execute aggressive GC: ${msg}`);
    } finally {
      setIsGcRunning(false);
    }
  };

  useEffect(() => {
    loadHealthData();
  }, [repoPath]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleManualBackup = async () => {
    if (!repoPath) return;
    setCreatingBackup(true);
    setBackupSuccessMsg(null);
    try {
      const reason = backupReason.trim() || 'Manual user safety backup';
      const res = await createBackup(repoPath, reason, backupKind);
      setBackupSuccessMsg(`Created ${res.kind} backup: ${res.identifier}`);
      setBackupReason('');
      const updatedBackups = await getBackups(repoPath);
      setBackups(updatedBackups);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to create backup: ${msg}`);
    } finally {
      setCreatingBackup(false);
    }
  };

  const totalSecrets = report?.secrets.length || 0;
  const totalLargeFiles = report?.large_files.length || 0;
  const totalAITraces = report?.ai_traces.length || 0;
  const isHealthy = (fsck?.is_healthy ?? true) && totalSecrets === 0;

  // Filtered lists
  const filteredSecrets = (report?.secrets || []).filter(
    (s) =>
      s.file_path.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.rule_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.commit_sha.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredLargeFiles = (report?.large_files || []).filter(
    (f) =>
      f.path.toLowerCase().includes(filterQuery.toLowerCase()) ||
      f.oid.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredAITraces = (report?.ai_traces || []).filter(
    (t) =>
      t.marker.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (t.file_path && t.file_path.toLowerCase().includes(filterQuery.toLowerCase())) ||
      (t.commit_subject && t.commit_subject.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/30">
      {/* Top Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Safety Engine & Repository Health
              </h1>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-medium border ${
                  isHealthy
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                }`}
              >
                {isHealthy ? 'Healthy Object Store' : 'Issues Detected'}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Audit committed secrets, history-bloating blobs, AI trace metadata, and offline safety
              backups
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadHealthData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            title="Refresh repository health check"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenPurgeWizard}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>History Purge Wizard</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 mx-4 mt-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-4 bg-white dark:bg-zinc-900 shrink-0 gap-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Audit Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('secrets')}
          className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'secrets'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Secret Leaks</span>
          {totalSecrets > 0 && (
            <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold">
              {totalSecrets}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('large_files')}
          className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'large_files'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Large Blobs</span>
          {totalLargeFiles > 0 && (
            <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {totalLargeFiles}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai_traces')}
          className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ai_traces'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Traces & Metadata</span>
          {totalAITraces > 0 && (
            <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {totalAITraces}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backups')}
          className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'backups'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <FolderLock className="w-3.5 h-3.5" />
          <span>Restore Points & Bundles</span>
          <span className="px-1.5 py-0.2 rounded-full font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            {backups.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'maintenance'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Hooks & Guard Rails</span>
          {hooksStatus &&
            (!hooksStatus.commit_msg_installed ||
              !hooksStatus.pre_commit_installed ||
              !hooksStatus.gitignore_has_ai_dirs) && (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Health KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Object store integrity */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span>Git fsck Integrity</span>
                  {fsck?.is_healthy ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  )}
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {fsck?.is_healthy ? 'Clean & Valid' : 'Corruptions'}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  {fsck?.dangling_blobs || 0} dangling blobs, {fsck?.dangling_commits || 0}{' '}
                  unreferenced commits
                </p>
              </div>

              {/* Card 2: Secrets */}
              <div
                onClick={() => setActiveTab('secrets')}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span>Secret Leaks</span>
                  <Key className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {totalSecrets}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  {totalSecrets > 0
                    ? 'High-risk credentials in commits'
                    : 'No credential patterns detected'}
                </p>
              </div>

              {/* Card 3: Large files */}
              <div
                onClick={() => setActiveTab('large_files')}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span>Large Historical Blobs</span>
                  <HardDrive className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {totalLargeFiles}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Objects &gt; 500 KB bloating packfiles
                </p>
              </div>

              {/* Card 4: AI Traces */}
              <div
                onClick={() => setActiveTab('ai_traces')}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span>AI Commit Metadata</span>
                  <Sparkles className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {totalAITraces}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Verifiable trailers & tool config files
                </p>
              </div>
            </div>

            {/* Quick Safety Actions Callout */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-rose-500" />
                  <span>Level 4 History Purge & Sanitization Runbook</span>
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Need to eradicate hardcoded API credentials, purge huge video or binary assets
                  from past commits, or rewrite co-authors? Use the automated 7-step isolated mirror
                  wizard.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenPurgeWizard}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <span>Launch Purge Wizard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Fsck Raw Output Card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Git Object Store Verification (`git fsck --full`)</span>
                </h3>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Scanned {report?.total_commits_scanned || 0} commits in {report?.duration_ms || 0}
                  ms
                </span>
              </div>
              <pre className="p-3 rounded-lg bg-zinc-950 text-zinc-300 font-mono text-[11px] overflow-x-auto max-h-40 leading-relaxed">
                {fsck?.raw_output || 'git fsck completed with no errors.'}
              </pre>
            </div>
          </div>
        )}

        {/* SECRETS TAB */}
        {activeTab === 'secrets' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter secrets by rule or path..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <button
                type="button"
                onClick={onOpenPurgeWizard}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Purge Leaked Secrets</span>
              </button>
            </div>

            {filteredSecrets.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  No Secret Leaks Found
                </h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  No API tokens, private keys, AWS credentials, or hardcoded tokens were detected in
                  the sampled commit history.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredSecrets.map((secret, idx) => (
                  <div
                    key={`${secret.commit_sha}-${secret.file_path}-${idx}`}
                    className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white">
                          {secret.severity}
                        </span>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {secret.rule_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                        <span>Commit {secret.commit_sha.slice(0, 8)}</span>
                        <span>•</span>
                        <span>{secret.author}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs font-mono bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2 truncate">
                        <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="text-zinc-800 dark:text-zinc-200 truncate">
                          {secret.file_path}
                        </span>
                      </div>
                      <span className="text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 bg-rose-50 dark:bg-rose-950/50 rounded shrink-0">
                        {secret.match_preview}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LARGE FILES TAB */}
        {activeTab === 'large_files' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter large files by name or blob..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={onOpenPurgeWizard}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Purge Large Files</span>
              </button>
            </div>

            {filteredLargeFiles.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  No Heavy Blobs Found
                </h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  No files over 500 KB were found in repository history. Object database is lean.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredLargeFiles.map((file) => (
                  <div
                    key={file.oid}
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {file.path}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        SHA-1: {file.oid.slice(0, 10)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2.5 py-1 rounded-md font-mono text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {file.formatted_size}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI TRACES TAB */}
        {activeTab === 'ai_traces' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter AI trailers or files..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAISanitizerOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Automatically remove AI Studio banners, co-author trailers, and watermarks"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto Clean AI Signs...</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenPurgeWizard}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>History Purge</span>
                </button>
              </div>
            </div>

            {filteredAITraces.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-2">
                <Sparkles className="w-8 h-8 text-zinc-400 mx-auto" />
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  No Verifiable AI Traces Found
                </h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  No identifiable AI co-author commit trailers or tool configuration files were
                  found.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAITraces.map((trace, idx) => (
                  <div
                    key={`${trace.marker}-${idx}`}
                    className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {trace.type === 'trailer' ? 'Commit Trailer' : 'Tracked Config File'}
                      </span>
                      {trace.commit_sha && (
                        <span className="text-[11px] font-mono text-zinc-400">
                          {trace.commit_sha.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {trace.marker}
                    </div>
                    <div className="text-[11px] text-zinc-500">{trace.details}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BACKUPS & RESTORE POINTS TAB */}
        {activeTab === 'backups' && (
          <div className="space-y-4">
            {/* Create backup widget */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <FolderLock className="w-4 h-4 text-emerald-500" />
                <span>Create Instant Safety Restore Point</span>
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Take an automatic safety snapshot before initiating manual or complex Git
                procedures.
              </p>

              {backupSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{backupSuccessMsg}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={backupReason}
                  onChange={(e) => setBackupReason(e.target.value)}
                  placeholder="Reason (e.g., pre-experiment-cleanup, release-v2)"
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                <select
                  value={backupKind}
                  onChange={(e) => setBackupKind(e.target.value as 'branch' | 'bundle')}
                  className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="branch">Branch (backup/pre-...)</option>
                  <option value="bundle">Bundle File (.bundle)</option>
                </select>

                <button
                  type="button"
                  onClick={handleManualBackup}
                  disabled={creatingBackup}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shrink-0 cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <FolderLock className="w-3.5 h-3.5" />
                  <span>{creatingBackup ? 'Creating...' : 'Snapshot'}</span>
                </button>
              </div>
            </div>

            {/* Backups List */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Existing Snapshots ({backups.length})
              </h4>

              {backups.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 text-xs text-zinc-500">
                  No safety branches or bundle backups created yet.
                </div>
              ) : (
                backups.map((bk) => (
                  <div
                    key={bk.id}
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            bk.kind === 'bundle'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {bk.kind}
                        </span>
                        <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {bk.identifier}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Reason: {bk.reason} • Created {new Date(bk.created_at).toLocaleString()}
                        {bk.file_size ? ` • ${(bk.file_size / (1024 * 1024)).toFixed(2)} MB` : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(bk.identifier)}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs transition-colors cursor-pointer self-end sm:self-center"
                      title="Copy identifier / path"
                    >
                      {copiedText === bk.identifier ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MAINTENANCE & GUARDS TAB (Phase 4 Hardening) */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            {/* Status alerts */}
            {hookSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{hookSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHookSuccessMsg(null)}
                  className="text-emerald-500 hover:text-emerald-700 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {gcResultMsg && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{gcResultMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGcResultMsg(null)}
                  className="text-purple-500 hover:text-purple-700 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Section 1: Defense-in-depth Git Hooks */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Proactive Git Hooks & Guard Rails
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">Local-only `.git/hooks`</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Install local defense-in-depth hooks that intercept commits before they are
                finalized. This prevents accidental attribution leakage or credential exposure
                regardless of IDE or agent behavior.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Hook Card 1: commit-msg */}
                <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      commit-msg hook
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                        hooksStatus?.commit_msg_blocks_ai_trailers
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-200/50 dark:bg-zinc-700/50 text-zinc-500 border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {hooksStatus?.commit_msg_blocks_ai_trailers
                        ? 'Active (Guarded)'
                        : 'Not Configured'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Defense-in-depth against AI trailers (e.g., <code>Co-authored-by: Claude</code>,{' '}
                    <code>Claude-Session: &lt;url&gt;</code>).
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleInstallCommitMsgHook('strip')}
                      disabled={installingAction !== null}
                      className="px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer transition-colors"
                    >
                      {installingAction === 'commit-msg-strip'
                        ? 'Installing...'
                        : 'Install (Auto-Strip)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInstallCommitMsgHook('reject')}
                      disabled={installingAction !== null}
                      className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                    >
                      {installingAction === 'commit-msg-reject'
                        ? 'Installing...'
                        : 'Install (Strict Reject)'}
                    </button>
                  </div>
                </div>

                {/* Hook Card 2: pre-commit scanner */}
                <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      pre-commit scanner
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                        hooksStatus?.pre_commit_blocks_secrets
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-200/50 dark:bg-zinc-700/50 text-zinc-500 border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {hooksStatus?.pre_commit_blocks_secrets
                        ? 'Active (Scanning)'
                        : 'Not Configured'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Blocks commits with staged secrets (AWS, OpenAI, Anthropic, SSH keys) and warns
                    on blobs &gt; 500 KB.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleInstallPreCommitHook}
                      disabled={installingAction !== null}
                      className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer transition-colors"
                    >
                      {installingAction === 'pre-commit'
                        ? 'Installing...'
                        : 'Install Pre-Commit Scanner'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: .gitignore Guard */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Development Environment & AI Workspaces (.gitignore)
                  </h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                    hooksStatus?.gitignore_has_ai_dirs
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}
                >
                  {hooksStatus?.gitignore_has_ai_dirs ? 'Protected' : 'Unprotected Folders'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Prevents accidental tracking of developer-local IDE configurations and AI
                workspaces:
                <code className="mx-1 text-zinc-700 dark:text-zinc-300 font-mono">.cursor/</code>,
                <code className="mx-1 text-zinc-700 dark:text-zinc-300 font-mono">
                  .cursorrules
                </code>
                ,<code className="mx-1 text-zinc-700 dark:text-zinc-300 font-mono">.claude/</code>,
                <code className="mx-1 text-zinc-700 dark:text-zinc-300 font-mono">.cline/</code>.
              </p>
              {hooksStatus?.missing_ai_dirs && hooksStatus.missing_ai_dirs.length > 0 && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                  Currently missing from .gitignore: {hooksStatus.missing_ai_dirs.join(', ')}
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={handleAddAIDirectoriesToGitignore}
                  disabled={installingAction !== null}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                >
                  {installingAction === 'gitignore'
                    ? 'Updating .gitignore...'
                    : 'Add AI Tool Rules to .gitignore'}
                </button>
              </div>
            </div>

            {/* Section 3: Isolated Manual Aggressive GC (Strict Safety Policy Compliance) */}
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10 space-y-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-4 h-4 shrink-0" />
                <h3 className="text-sm font-semibold">
                  Isolated Repository Compaction &amp; Prune (`git gc --prune=now --aggressive`)
                </h3>
              </div>
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Strict Safety Warning: Irreversible Garbage Collection</span>
                </div>
                <p className="leading-relaxed">
                  In accordance with <code>SAFETY_POLICY.md</code>, aggressive garbage collection is{' '}
                  <strong>never</strong> automated inside any wizard. Running this command
                  permanently prunes all unreferenced, dangling commits and repacks loose objects.
                  Once pruned, orphan commits cannot be rescued via reflog!
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Type{' '}
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    PRUNE NOW
                  </span>{' '}
                  to confirm manual garbage collection:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={gcConfirmationInput}
                    onChange={(e) => setGcConfirmationInput(e.target.value)}
                    placeholder="PRUNE NOW"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    onClick={handleRunAggressiveGC}
                    disabled={isGcRunning || gcConfirmationInput.trim() !== 'PRUNE NOW'}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shrink-0 cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isGcRunning ? 'Compacting & Pruning...' : 'Run Aggressive GC'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isAISanitizerOpen && (
        <AISanitizerModal
          isOpen={isAISanitizerOpen}
          onClose={() => setIsAISanitizerOpen(false)}
          repoPath={repoPath}
          theme={_theme}
          onSuccess={() => {
            loadHealthData();
          }}
        />
      )}
    </div>
  );
};
