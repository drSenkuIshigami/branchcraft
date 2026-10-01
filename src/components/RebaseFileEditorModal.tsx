import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  FileText,
  Search,
  Save,
  Check,
  Play,
  SkipForward,
  XCircle,
  AlertTriangle,
  GitCommit,
  CheckCircle2,
  FolderOpen,
  Plus,
  RefreshCw,
  X,
  FileCode,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { RebaseStatus, Theme } from '../types';
import {
  listRepositoryFiles,
  getFileContent,
  saveFileContent,
  rebaseAmendAndContinue,
  continueConflictOperation,
  rebaseSkip,
  abortConflictOperation,
  getDetailedRebaseStatus,
} from '../ipc';

interface RebaseFileEditorModalProps {
  isOpen: boolean;
  repoPath: string;
  rebaseStatus: RebaseStatus | null;
  theme: Theme;
  onClose: () => void;
  onRebaseFinished: (success: boolean, message: string) => void;
  onRefreshRepo: () => Promise<void>;
}

export const RebaseFileEditorModal: React.FC<RebaseFileEditorModalProps> = ({
  isOpen,
  repoPath,
  rebaseStatus: initialRebaseStatus,
  theme,
  onClose,
  onRebaseFinished,
  onRefreshRepo,
}) => {
  const [currentStatus, setCurrentStatus] = useState<RebaseStatus | null>(initialRebaseStatus);
  const [files, setFiles] = useState<string[]>([]);
  const [fileFilter, setFileFilter] = useState('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [useCustomMessage, setUseCustomMessage] = useState(false);

  // Sync internal status with prop
  useEffect(() => {
    if (initialRebaseStatus) {
      setCurrentStatus(initialRebaseStatus);
    }
  }, [initialRebaseStatus]);

  // Load files in the repo working tree
  const loadFiles = useCallback(async () => {
    if (!repoPath) return;
    setLoadingFiles(true);
    try {
      const fileList = await listRepositoryFiles(repoPath);
      setFiles(fileList);
      // Pre-select README.md if present and nothing selected, or select first file
      setSelectedFile((prev) => {
        if (prev && fileList.includes(prev)) return prev;
        const readme = fileList.find((f) => /^readme\.md$/i.test(f));
        return readme || fileList[0] || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list repository files');
    } finally {
      setLoadingFiles(false);
    }
  }, [repoPath]);

  // Load file content when selectedFile changes
  useEffect(() => {
    if (!repoPath || !selectedFile) {
      setFileContent('');
      setOriginalContent('');
      return;
    }

    let isMounted = true;
    setLoadingContent(true);
    setError(null);
    getFileContent(repoPath, selectedFile)
      .then((res) => {
        if (!isMounted) return;
        setFileContent(res.content);
        setOriginalContent(res.content);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load file');
      })
      .finally(() => {
        if (isMounted) setLoadingContent(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoPath, selectedFile]);

  // Fetch initial file list on modal open
  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, loadFiles]);

  const isDirty = fileContent !== originalContent;

  // Filtered files
  const filteredFiles = useMemo(() => {
    if (!fileFilter.trim()) return files;
    const q = fileFilter.toLowerCase();
    return files.filter((f) => f.toLowerCase().includes(q));
  }, [files, fileFilter]);

  // Determine Monaco language mode from file extension
  const editorLanguage = useMemo(() => {
    if (!selectedFile) return 'plaintext';
    const lower = selectedFile.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
    if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs')) return 'javascript';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
    if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'css';
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'shell';
    if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
    if (lower.endsWith('.sql')) return 'sql';
    if (lower.endsWith('.xml') || lower.endsWith('.svg')) return 'xml';
    return 'plaintext';
  }, [selectedFile]);

  // Save current file to disk and git add
  const handleSave = async () => {
    if (!repoPath || !selectedFile || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveFileContent(repoPath, selectedFile, fileContent, true);
      setOriginalContent(fileContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await onRefreshRepo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Re-check rebase status after an action
  const checkStatusAfterAction = async () => {
    try {
      const newStatus = await getDetailedRebaseStatus(repoPath);
      setCurrentStatus(newStatus);
      await onRefreshRepo();
      if (!newStatus.in_progress) {
        onRebaseFinished(true, 'Interactive rebase completed successfully! All changes applied.');
        onClose();
        return false;
      }
      return true;
    } catch {
      await onRefreshRepo();
      return false;
    }
  };

  // 1-Click Amend & Continue Rebase
  const handleAmendAndContinue = async () => {
    if (!repoPath || actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      // If current file has unsaved edits, save them first
      if (isDirty && selectedFile) {
        await saveFileContent(repoPath, selectedFile, fileContent, true);
        setOriginalContent(fileContent);
      }

      const msg = useCustomMessage && commitMessage.trim() ? commitMessage.trim() : undefined;
      const res = await rebaseAmendAndContinue(repoPath, msg);

      if (!res.success) {
        setError(res.stderr || res.stdout || 'Rebase amend or continue encountered an error.');
        setActionLoading(false);
        await onRefreshRepo();
        return;
      }

      // Check if rebase has finished or is stopped at next step
      const stillActive = await checkStatusAfterAction();
      if (stillActive) {
        await loadFiles();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to amend and continue rebase');
    } finally {
      setActionLoading(false);
    }
  };

  // Continue rebase without amending
  const handleContinue = async () => {
    if (!repoPath || actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      if (isDirty && selectedFile) {
        await saveFileContent(repoPath, selectedFile, fileContent, true);
        setOriginalContent(fileContent);
      }
      const res = await continueConflictOperation(repoPath);
      if (!res.success) {
        setError(res.stderr || 'Continue rebase encountered an error.');
        setActionLoading(false);
        await onRefreshRepo();
        return;
      }
      const stillActive = await checkStatusAfterAction();
      if (stillActive) {
        await loadFiles();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue rebase');
    } finally {
      setActionLoading(false);
    }
  };

  // Skip this commit
  const handleSkip = async () => {
    if (!repoPath || actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await rebaseSkip(repoPath);
      if (!res.success) {
        setError(res.stderr || 'Skip commit failed');
        setActionLoading(false);
        await onRefreshRepo();
        return;
      }
      const stillActive = await checkStatusAfterAction();
      if (stillActive) {
        await loadFiles();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip commit');
    } finally {
      setActionLoading(false);
    }
  };

  // Abort rebase
  const handleAbort = async () => {
    if (!repoPath || actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await abortConflictOperation(repoPath);
      await onRefreshRepo();
      if (res.success) {
        onRebaseFinished(false, 'Interactive rebase aborted. Working tree restored.');
        onClose();
      } else {
        setError(res.stderr || 'Failed to abort rebase');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to abort rebase');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentCommitSha = currentStatus?.current_commit?.slice(0, 7) || 'paused';
  const total =
    currentStatus?.total_steps ||
    (currentStatus?.done_steps?.length || 0) + (currentStatus?.todo_steps?.length || 0) + 1;
  const doneCount = currentStatus?.done_steps?.length || 0;
  const currentStepNum = doneCount + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-6xl h-[92vh] flex flex-col rounded-xl shadow-2xl border overflow-hidden transition-all ${
          theme === 'dark'
            ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-800'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-amber-500/10 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                  Edit Commit Files & Rebase
                </h3>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  Stopped at {currentCommitSha}
                </span>
                <span className="text-xs text-zinc-500">
                  (Step {currentStepNum} of {total})
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Edit any file (such as <code className="font-mono font-semibold">README.md</code>) in this commit, save changes, and click <strong>Amend & Continue</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadFiles}
              title="Refresh repository files"
              className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-mono break-all">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs hover:underline shrink-0 ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Work Area: File Explorer on left, Monaco Editor on right */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-0">
          {/* File Picker (3 cols) */}
          <div className="md:col-span-3 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/40">
            {/* Search filter */}
            <div className="p-2.5 border-b border-zinc-200 dark:border-zinc-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter files (README.md...)"
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {loadingFiles ? (
                <div className="p-4 text-center text-xs text-zinc-400">Loading files...</div>
              ) : filteredFiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400">No files found</div>
              ) : (
                filteredFiles.map((f) => {
                  const isSelected = f === selectedFile;
                  const isReadme = /^readme\.md$/i.test(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSelectedFile(f)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium'
                          : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${isReadme ? 'text-amber-500' : 'text-zinc-400'}`} />
                        <span className="truncate">{f}</span>
                      </div>
                      {isReadme && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">
                          target
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Monaco Editor (9 cols) */}
          <div className="md:col-span-9 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
            {/* Editor Toolbar */}
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/70 dark:bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <FileCode className="w-4 h-4 text-amber-500" />
                <span className="font-mono text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {selectedFile || 'No file selected'}
                </span>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    ● Unsaved Changes
                  </span>
                )}
                {saveSuccess && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3 h-3" /> Saved & Auto-Staged
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!selectedFile || saving || !isDirty}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 dark:bg-zinc-200 hover:bg-zinc-900 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save File'}</span>
                  <span className="text-[10px] opacity-60 ml-0.5 font-mono">⌘S</span>
                </button>
              </div>
            </div>

            {/* Monaco Editor Area */}
            <div className="flex-1 overflow-hidden relative">
              {loadingContent ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-xs">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
                  Loading file content...
                </div>
              ) : selectedFile ? (
                <Editor
                  height="100%"
                  language={editorLanguage}
                  value={fileContent}
                  onChange={(val) => setFileContent(val || '')}
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 13,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    lineNumbers: 'on',
                    tabSize: 2,
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-xs">
                  <FolderOpen className="w-8 h-8 text-zinc-500 mb-2 stroke-1" />
                  Select a file from the left to edit its content.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Commit Message & Action Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex flex-col gap-3 shrink-0">
          {/* Optional Commit Message Reword */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useCustomMessage}
                onChange={(e) => setUseCustomMessage(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 text-amber-600 focus:ring-amber-500"
              />
              <span>Reword commit message on amend:</span>
            </label>
            {useCustomMessage && (
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="New commit message..."
                className="flex-1 px-2.5 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-1 focus:ring-amber-500"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAbort}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Abort Rebase</span>
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Skip Commit</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleContinue}
                disabled={actionLoading}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Continue Without Amending</span>
              </button>

              <button
                type="button"
                onClick={handleAmendAndContinue}
                disabled={actionLoading}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Amend Commit & Continue Rebase</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
