import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Terminal,
  FolderOpen,
  SplitSquareVertical,
  AlertCircle,
  FolderGit2,
  X,
  Globe,
  ArrowUp,
  ArrowDown,
  FolderSearch,
  SquareTerminal,
  CheckCircle2,
  ShieldCheck,
  BookOpen,
  HelpCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import type {
  BranchInfo,
  CommitDetail,
  CommitInfo,
  ConflictResolutionType,
  ConflictState,
  FileDiff,
  RebaseStatus,
  RemoteInfo,
  StashInfo,
  StatusInfo,
  SyncStatus,
  Theme,
  OperationResult,
  ReflogEntry,
  ResetMode,
  WorktreeInfo,
  TagInfo,
  CreateTagOptions,
  SubmoduleInfo,
  LfsDiagnostics,
  BisectStatus,
  RerereStatus,
  PushMode,
} from '../types';
import {
  abortConflictOperation,
  amendCommit,
  applyStash,
  branchFromStash,
  cherryPickSkip,
  clearStashes,
  continueConflictOperation,
  createBranch,
  createCommit,
  createDemoCherryPickConflict,
  createDemoConflict,
  createStash,
  createTag,
  deleteBranch,
  deleteRemoteRef,
  deleteTag,
  discardHunk,
  discardPath,
  dropStash,
  getBranches,
  getBisectStatus,
  getCommitDetail,
  getCommitGraph,
  getConflictState,
  getDetailedRebaseStatus,
  getFileDiff,
  getLfsDiagnostics,
  getReflog,
  getRemotes,
  getRerereStatus,
  getStashes,
  getStatus,
  getSubmodules,
  getSyncStatus,
  getTags,
  getWorktrees,
  gitFetch,
  gitPull,
  gitPush,
  launchMergetool,
  openRepository,
  openSampleRepository,
  openSystemLocation,
  pickFolder,
  popStash,
  rebaseSkip,
  renameBranch,
  resetHard,
  resetToTarget,
  resolveConflict,
  restoreFileFromCommit,
  revertSkip,
  runBisectCommand,
  createDemoRevertConflict,
  stageAll,
  stageHunk,
  stagePath,
  switchBranch,
  toggleRerere,
  unstageAll,
  unstageHunk,
  unstagePath,
  updateSubmodules,
  getRangeDiff,
  mergeWithOptions,
  previewForceRelocateBranch,
  executeForceRelocateBranch,
} from '../ipc';
import { Sidebar } from '../components/Sidebar';
import { CommitList } from '../components/CommitList';
import { CommitDetailPanel } from '../components/CommitDetailPanel';
import { DiffViewer } from '../components/DiffViewer';
import { WorkingTreePanel } from '../components/WorkingTreePanel';
import { StashManager } from '../components/StashManager';
import { CreateStashModal } from '../components/CreateStashModal';
import { DropStashModal } from '../components/DropStashModal';
import { BranchFromStashModal } from '../components/BranchFromStashModal';
import { ResetHardModal } from '../components/ResetHardModal';
import { RestoreFileModal } from '../components/RestoreFileModal';
import { InteractiveRebaseModal } from '../components/InteractiveRebaseModal';
import { CommitAuthorDateModal } from '../components/CommitAuthorDateModal';
import { CherryPickModal } from '../components/CherryPickModal';
import { RevertModal } from '../components/RevertModal';
import { ReflogViewer } from '../components/ReflogViewer';
import { ResetConfirmModal } from '../components/ResetConfirmModal';
import { WorktreeManager } from '../components/WorktreeManager';
import { AddWorktreeModal } from '../components/AddWorktreeModal';
import { RepoHealthAudit } from '../components/RepoHealthAudit';
import { HistoryPurgeWizard } from '../components/HistoryPurgeWizard';
import type { CommitAuthorOptions } from '../components/CommitBox';
import { OpenRepoModal } from '../components/OpenRepoModal';
import { CommandLogModal, type LoggedCommand } from '../components/CommandLogModal';
import { CreateBranchModal } from '../components/CreateBranchModal';
import { RenameBranchModal } from '../components/RenameBranchModal';
import { DeleteBranchModal } from '../components/DeleteBranchModal';
import { RemoteSyncModal } from '../components/RemoteSyncModal';
import { SystemAuditModal } from '../components/SystemAuditModal';
import { TagManagerModal } from '../components/TagManagerModal';
import { SubmodulesAndLfsModal } from '../components/SubmodulesAndLfsModal';
import { BisectAndRerereModal } from '../components/BisectAndRerereModal';
import { MergeBranchModal } from '../components/MergeBranchModal';
import { ForceRelocateBranchModal } from '../components/ForceRelocateBranchModal';
import { RangeDiffViewerModal } from '../components/RangeDiffViewerModal';
import { HelpManualModal, type HelpActionId } from '../components/HelpManualModal';
import { SearchAndReplaceModal } from '../components/SearchAndReplaceModal';
import { AISanitizerModal } from '../components/AISanitizerModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { GitStatusBadge } from '../components/GitStatusBadge';

interface RepositoryExplorerProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export const RepositoryExplorer: React.FC<RepositoryExplorerProps> = ({ theme, onToggleTheme }) => {
  const [repoPath, setRepoPath] = useState<string | null>(() => {
    return localStorage.getItem('git_workbench_repo_path');
  });
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<CommitDetail | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);

  const [selectedView, setSelectedView] = useState<
    'graph' | 'working-tree' | 'stashes' | 'reflog' | 'worktrees' | 'health'
  >('graph');
  const [isPurgeWizardOpen, setIsPurgeWizardOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isCommandLogOpen, setIsCommandLogOpen] = useState(false);
  const [isSystemAuditOpen, setIsSystemAuditOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isSearchReplaceOpen, setIsSearchReplaceOpen] = useState(false);
  const [isAISanitizerOpen, setIsAISanitizerOpen] = useState(false);
  const [commandLogs, setCommandLogs] = useState<LoggedCommand[]>([]);

  // Branch Management State
  const [isCreateBranchOpen, setIsCreateBranchOpen] = useState(false);
  const [createBranchStartSha, setCreateBranchStartSha] = useState<string | undefined>(undefined);
  const [createBranchRefName, setCreateBranchRefName] = useState<string | undefined>(undefined);

  const [isRenameBranchOpen, setIsRenameBranchOpen] = useState(false);
  const [renameBranchOldName, setRenameBranchOldName] = useState('');

  const [isDeleteBranchOpen, setIsDeleteBranchOpen] = useState(false);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState<{
    name: string;
    isHead: boolean;
  } | null>(null);

  // Stash Management & Reset State
  const [stashes, setStashes] = useState<StashInfo[]>([]);
  const [selectedStashRef, setSelectedStashRef] = useState<string | null>(null);
  const [isCreateStashOpen, setIsCreateStashOpen] = useState(false);
  const [isDropStashOpen, setIsDropStashOpen] = useState(false);
  const [dropStashTarget, setDropStashTarget] = useState<StashInfo | null>(null);
  const [isBranchFromStashOpen, setIsBranchFromStashOpen] = useState(false);
  const [branchFromStashTarget, setBranchFromStashTarget] = useState<StashInfo | null>(null);
  const [isResetHardOpen, setIsResetHardOpen] = useState(false);

  // Remote Synchronization State (Phase 2)
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // File Restoration from History State (Phase 2 / Phase 3)
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreTargetFile, setRestoreTargetFile] = useState<string | null>(null);
  const [restoreTargetSha, setRestoreTargetSha] = useState<string | null>(null);
  const [restoreTargetSubject, setRestoreTargetSubject] = useState<string | null>(null);

  // System Action Feedback Toast
  const [systemToast, setSystemToast] = useState<{
    message: string;
    commandSnippet?: string;
  } | null>(null);

  // Conflict State (Phase 2)
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  // Interactive Rebase State (Phase 3 Step 1)
  const [rebaseStatus, setRebaseStatus] = useState<RebaseStatus | null>(null);
  const [rebaseModalTarget, setRebaseModalTarget] = useState<{
    baseSha: string;
    baseSummary?: string;
  } | null>(null);

  // Commit Author & Date Modification State (Phase 3 Step 2)
  const [authorDateModalCommit, setAuthorDateModalCommit] = useState<CommitInfo | null>(null);

  // Cherry-pick State (Phase 3 Step 3)
  const [cherryPickModalCommit, setCherryPickModalCommit] = useState<CommitInfo | null>(null);

  // Revert State (Phase 3 Step 4)
  const [revertModalCommit, setRevertModalCommit] = useState<CommitInfo | null>(null);

  // Reflog & Reset State (Phase 3 Step 5)
  const [reflogEntries, setReflogEntries] = useState<ReflogEntry[]>([]);
  const [reflogLoading, setReflogLoading] = useState(false);
  const [resetTargetModal, setResetTargetModal] = useState<{
    targetRef: string;
    subject?: string;
  } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Worktree Management State (Phase 3 Step 6)
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [worktreesLoading, setWorktreesLoading] = useState(false);
  const [isAddWorktreeOpen, setIsAddWorktreeOpen] = useState(false);

  // Tags Management State (Phase 3 Extension)
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  // Submodules & LFS State (Phase 3 Extension)
  const [submodules, setSubmodules] = useState<SubmoduleInfo[]>([]);
  const [lfsDiagnostics, setLfsDiagnostics] = useState<LfsDiagnostics | null>(null);
  const [isSubmodulesLfsOpen, setIsSubmodulesLfsOpen] = useState(false);

  // Bisect & Rerere State (Phase 3 Extension)
  const [bisectStatus, setBisectStatus] = useState<BisectStatus | null>(null);
  const [rerereStatus, setRerereStatus] = useState<RerereStatus | null>(null);
  const [isBisectRerereOpen, setIsBisectRerereOpen] = useState(false);

  // Range-Diff, Merge Strategy & Force Relocate State (Phase 3 Extension)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isRangeDiffOpen, setIsRangeDiffOpen] = useState(false);
  const [forceRelocateTarget, setForceRelocateTarget] = useState<{
    branchName: string;
    targetSha: string;
    targetSubject?: string;
  } | null>(null);

  useEffect(() => {
    if (!systemToast) return;
    const timer = setTimeout(() => {
      setSystemToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [systemToast]);

  const recordCommand = useCallback(
    (commandRun: string[], durationMs: number, success = true, exitCode = 0, stderr = '') => {
      setCommandLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          result: {
            success,
            stdout: '',
            stderr,
            exit_code: exitCode,
            command_run: commandRun,
            duration_ms: durationMs,
          },
        },
        ...prev.slice(0, 49), // Keep latest 50
      ]);
    },
    []
  );

  const loadRepositoryData = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      const start = performance.now();

      try {
        const newStatus = await getStatus(path);
        recordCommand(
          ['status', '--porcelain=v2', '--branch'],
          Math.round(performance.now() - start)
        );
        setStatus(newStatus);
        setRepoPath(newStatus.root_path);
        localStorage.setItem('git_workbench_repo_path', newStatus.root_path);

        const branchStart = performance.now();
        const newBranches = await getBranches(newStatus.root_path);
        recordCommand(
          ['for-each-ref', 'refs/heads/', 'refs/remotes/'],
          Math.round(performance.now() - branchStart)
        );
        setBranches(newBranches);

        const logStart = performance.now();
        const newCommits = await getCommitGraph(newStatus.root_path, 100);
        recordCommand(
          ['log', '--all', '--topo-order', '-n', '100'],
          Math.round(performance.now() - logStart)
        );
        setCommits(newCommits);

        if (newCommits.length > 0) {
          setSelectedSha(newCommits[0].sha);
        }

        const stashStart = performance.now();
        const newStashes = await getStashes(newStatus.root_path);
        recordCommand(['stash', 'list'], Math.round(performance.now() - stashStart));
        setStashes(newStashes);
        if (newStashes.length > 0) {
          setSelectedStashRef((prev) =>
            prev && newStashes.some((s) => s.ref === prev) ? prev : newStashes[0].ref
          );
        } else {
          setSelectedStashRef(null);
        }

        // Remotes & Sync Status (Phase 2)
        try {
          const remotesStart = performance.now();
          const newRemotes = await getRemotes(newStatus.root_path);
          recordCommand(['remote', '-v'], Math.round(performance.now() - remotesStart));
          setRemotes(newRemotes);

          const syncStart = performance.now();
          const newSyncStatus = await getSyncStatus(newStatus.root_path);
          recordCommand(
            ['rev-list', '--left-right', '--count', 'HEAD...@{u}'],
            Math.round(performance.now() - syncStart)
          );
          setSyncStatus(newSyncStatus);
        } catch {
          // Remotes or upstream tracking may not exist for local-only repos
          setRemotes([]);
          setSyncStatus(null);
        }

        // Conflict State (Phase 2)
        try {
          const conflictStart = performance.now();
          const newConflictState = await getConflictState(newStatus.root_path);
          if (
            newConflictState.in_merge ||
            newConflictState.in_rebase ||
            newConflictState.in_cherry_pick ||
            newConflictState.in_revert
          ) {
            recordCommand(
              ['status', '(conflict-detection)'],
              Math.round(performance.now() - conflictStart)
            );
          }
          setConflictState(newConflictState);
        } catch {
          setConflictState(null);
        }

        // Detailed Rebase Status (Phase 3 Step 1)
        try {
          const detailedRebase = await getDetailedRebaseStatus(newStatus.root_path);
          setRebaseStatus(detailedRebase);
        } catch {
          setRebaseStatus(null);
        }

        // Reflog History (Phase 3 Step 5)
        try {
          const reflogStart = performance.now();
          const newReflog = await getReflog(newStatus.root_path, 100);
          recordCommand(
            ['reflog', 'show', '-n', '100'],
            Math.round(performance.now() - reflogStart)
          );
          setReflogEntries(newReflog);
        } catch {
          setReflogEntries([]);
        }

        // Worktrees (Phase 3 Step 6)
        try {
          const wtStart = performance.now();
          const newWorktrees = await getWorktrees(newStatus.root_path);
          recordCommand(
            ['worktree', 'list', '--porcelain'],
            Math.round(performance.now() - wtStart)
          );
          setWorktrees(newWorktrees);
        } catch {
          setWorktrees([]);
        }

        // Tags & Release Markers (Phase 3 Extension)
        try {
          const tagsStart = performance.now();
          const newTags = await getTags(newStatus.root_path);
          recordCommand(['for-each-ref', 'refs/tags/'], Math.round(performance.now() - tagsStart));
          setTags(newTags);
        } catch {
          setTags([]);
        }

        // Submodules & LFS Diagnostics (Phase 3 Extension)
        try {
          const subStart = performance.now();
          const newSubs = await getSubmodules(newStatus.root_path);
          recordCommand(['submodule', 'status'], Math.round(performance.now() - subStart));
          setSubmodules(newSubs);

          const lfsDiag = await getLfsDiagnostics(newStatus.root_path);
          setLfsDiagnostics(lfsDiag);
        } catch {
          setSubmodules([]);
          setLfsDiagnostics(null);
        }

        // Bisect & Rerere (Phase 3 Extension)
        try {
          const bStatus = await getBisectStatus(newStatus.root_path);
          setBisectStatus(bStatus);
          const rStatus = await getRerereStatus(newStatus.root_path);
          setRerereStatus(rStatus);
        } catch {
          setBisectStatus(null);
          setRerereStatus(null);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Path does not exist') || msg.includes('not a valid Git repository')) {
          localStorage.removeItem('git_workbench_repo_path');
          if (path.includes('sample-repo')) {
            // Automatically resurrect or re-initialize demo sandbox
            try {
              const res = await openSampleRepository();
              setRepoPath(res.path);
              localStorage.setItem('git_workbench_repo_path', res.path);
              await loadRepositoryData(res.path);
              return;
            } catch {
              // fall through to error display
            }
          }
        }
        setError(msg);
        recordCommand(['open_repository', path], 0, false, 1, msg);
      } finally {
        setLoading(false);
      }
    },
    [recordCommand]
  );

  // Load commit details whenever selectedSha changes
  useEffect(() => {
    if (!repoPath || !selectedSha) return;

    let isMounted = true;
    setDetailLoading(true);
    const start = performance.now();

    getCommitDetail(repoPath, selectedSha)
      .then((detail) => {
        if (!isMounted) return;
        recordCommand(
          ['show', '--stat', selectedSha.substring(0, 8)],
          Math.round(performance.now() - start)
        );
        setCommitDetail(detail);

        // Auto-select first changed file for diff preview
        if (detail.files.length > 0) {
          setSelectedFile(detail.files[0].path);
        } else {
          setSelectedFile(null);
          setDiff(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        recordCommand(['show', selectedSha], 0, false, 1, String(err));
      })
      .finally(() => {
        if (isMounted) setDetailLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoPath, selectedSha, recordCommand]);

  // Load diff whenever selectedFile or selectedSha/view changes
  useEffect(() => {
    if (!repoPath || !selectedFile) {
      setDiff(null);
      return;
    }

    let isMounted = true;
    setDiffLoading(true);
    const start = performance.now();

    const rev =
      selectedView === 'graph' || selectedView === 'reflog'
        ? selectedSha
        : selectedView === 'stashes'
          ? selectedStashRef
          : null;
    getFileDiff(repoPath, selectedFile, rev)
      .then((d) => {
        if (!isMounted) return;
        recordCommand(
          ['diff', rev ? `${rev}^..${rev}` : 'HEAD', '--', selectedFile],
          Math.round(performance.now() - start)
        );
        setDiff(d);
      })
      .catch((err) => {
        if (!isMounted) return;
        recordCommand(['diff', selectedFile], 0, false, 1, String(err));
      })
      .finally(() => {
        if (isMounted) setDiffLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoPath, selectedFile, selectedSha, selectedStashRef, selectedView, recordCommand]);

  // Initialize: load existing or auto-open sample sandbox repository
  useEffect(() => {
    if (repoPath) {
      loadRepositoryData(repoPath);
    } else {
      // Auto-open sample repository for instantaneous full experience
      handleOpenSample();
    }
  }, []);

  const saveRecentRepo = (newPath: string) => {
    try {
      const raw = localStorage.getItem('git_workbench_recent_repos');
      const existing: string[] = raw ? JSON.parse(raw) : [];
      const updated = [newPath, ...existing.filter((p) => p !== newPath)].slice(0, 10);
      localStorage.setItem('git_workbench_recent_repos', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleOpenPath = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await openRepository(path);
      const targetPath = res.root_path || path;
      setRepoPath(targetPath);
      localStorage.setItem('git_workbench_repo_path', targetPath);
      saveRecentRepo(targetPath);
      await loadRepositoryData(targetPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await pickFolder();
      if (selected && selected.trim()) {
        await handleOpenPath(selected.trim());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  const handlePerformHelpAction = (actionId: HelpActionId) => {
    switch (actionId) {
      case 'view_working_tree':
        setSelectedView('working-tree');
        break;
      case 'view_graph':
        setSelectedView('graph');
        break;
      case 'view_stashes':
        setSelectedView('stashes');
        break;
      case 'view_reflog':
        setSelectedView('reflog');
        break;
      case 'view_worktrees':
        setSelectedView('worktrees');
        break;
      case 'view_health':
        setSelectedView('health');
        break;
      case 'open_repo_modal':
        setIsRepoModalOpen(true);
        break;
      case 'open_sync_modal':
        setIsSyncModalOpen(true);
        break;
      case 'open_purge_wizard':
        setIsPurgeWizardOpen(true);
        break;
      case 'open_system_audit':
        setIsSystemAuditOpen(true);
        break;
      case 'open_command_log':
        setIsCommandLogOpen(true);
        break;
      case 'open_bisect_rerere':
        setIsBisectRerereOpen(true);
        break;
      case 'open_submodules':
        setIsSubmodulesLfsOpen(true);
        break;
      case 'open_search_replace':
        setIsSearchReplaceOpen(true);
        break;
      case 'open_ai_sanitizer':
        setIsAISanitizerOpen(true);
        break;
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;

      // Ctrl+Shift+F or Cmd+Shift+F opens Global Search & Replace
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchReplaceOpen((prev) => !prev);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setIsHelpModalOpen((prev) => !prev);
      } else if (e.key === '?' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsHelpModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleOpenSample = async () => {
    setLoading(true);
    try {
      const res = await openSampleRepository();
      setRepoPath(res.path);
      localStorage.setItem('git_workbench_repo_path', res.path);
      await loadRepositoryData(res.path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (repoPath) {
      loadRepositoryData(repoPath);
    }
  };

  const handleStageFile = async (filePath: string) => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await stagePath(repoPath, filePath);
      recordCommand(
        ['add', '--', filePath],
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['add', '--', filePath], Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await unstagePath(repoPath, filePath);
      recordCommand(
        ['restore', '--staged', '--', filePath],
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(
        ['restore', '--staged', '--', filePath],
        Math.round(performance.now() - start),
        false,
        1,
        msg
      );
      setError(msg);
    }
  };

  const handleDiscardFile = async (filePath: string, isUntracked: boolean) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmd = isUntracked ? ['clean', '-f', '--', filePath] : ['restore', '--', filePath];
    try {
      const res = await discardPath(repoPath, filePath, isUntracked);
      recordCommand(
        cmd,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      if (selectedFile === filePath) {
        setSelectedFile(null);
        setDiff(null);
      }
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmd, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
    }
  };

  const handleStageAll = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await stageAll(repoPath);
      recordCommand(
        ['add', '-A'],
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['add', '-A'], Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
    }
  };

  const handleUnstageAll = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await unstageAll(repoPath);
      recordCommand(
        ['restore', '--staged', '.'],
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(
        ['restore', '--staged', '.'],
        Math.round(performance.now() - start),
        false,
        1,
        msg
      );
      setError(msg);
    }
  };

  const handleCommit = async (
    message: string,
    isAmend: boolean,
    authorOptions?: CommitAuthorOptions
  ) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = isAmend ? ['commit', '--amend', '-m', message] : ['commit', '-m', message];
    if (authorOptions?.authorDate) {
      cmdTokens.push(`--date=${authorOptions.authorDate}`);
    }
    if (authorOptions?.authorName || authorOptions?.authorEmail) {
      cmdTokens.push(
        `--author="${authorOptions.authorName || ''} <${authorOptions.authorEmail || ''}>"`
      );
    }
    try {
      const res = isAmend
        ? await amendCommit(repoPath, message)
        : await createCommit(repoPath, message, authorOptions);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSelectedFile(null);
      setDiff(null);
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  // Branch operations handlers
  const handleOpenCreateBranch = (startSha?: string, refName?: string) => {
    setCreateBranchStartSha(startSha);
    setCreateBranchRefName(refName);
    setIsCreateBranchOpen(true);
  };

  const handleOpenRenameBranch = (branchName: string) => {
    setRenameBranchOldName(branchName);
    setIsRenameBranchOpen(true);
  };

  const handleOpenDeleteBranch = (branchName: string, isHead: boolean) => {
    setDeleteBranchTarget({ name: branchName, isHead });
    setIsDeleteBranchOpen(true);
  };

  const handleSwitchBranch = async (branchName: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['switch', branchName];
    try {
      const res = await switchBranch(repoPath, branchName);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleCreateBranch = async (name: string, startSha?: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = startSha ? ['switch', '-c', name, startSha] : ['switch', '-c', name];
    try {
      const res = await createBranch(repoPath, name, startSha);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleRenameBranch = async (oldName: string, newName: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['branch', '-m', oldName, newName];
    try {
      const res = await renameBranch(repoPath, oldName, newName);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleDeleteBranch = async (name: string, force: boolean) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = force ? ['branch', '-D', name] : ['branch', '-d', name];
    try {
      const res = await deleteBranch(repoPath, name, force);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleCreateStash = async (
    message: string,
    includeUntracked: boolean,
    keepIndex: boolean
  ) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['stash', 'push'];
    if (includeUntracked) cmdTokens.push('-u');
    if (keepIndex) cmdTokens.push('--keep-index');
    if (message) cmdTokens.push('-m', message);

    try {
      const res = await createStash(repoPath, message, includeUntracked, keepIndex);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleApplyStash = async (stashRef: string, reinstateIndex: boolean) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['stash', 'apply'];
    if (reinstateIndex) cmdTokens.push('--index');
    cmdTokens.push(stashRef);

    try {
      const res = await applyStash(repoPath, stashRef, reinstateIndex);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handlePopStash = async (stashRef: string, reinstateIndex: boolean) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['stash', 'pop'];
    if (reinstateIndex) cmdTokens.push('--index');
    cmdTokens.push(stashRef);

    try {
      const res = await popStash(repoPath, stashRef, reinstateIndex);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleDropStash = async (stashRef: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['stash', 'drop', stashRef];

    try {
      const res = await dropStash(repoPath, stashRef);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleClearStashes = async () => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['stash', 'clear'];

    try {
      const res = await clearStashes(repoPath);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleBranchFromStash = async (branchName: string, stashRef: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['stash', 'branch', branchName, stashRef];

    try {
      const res = await branchFromStash(repoPath, branchName, stashRef);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleResetHard = async (createBackup = true) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['reset', '--hard', 'HEAD'];

    try {
      const res = await resetHard(repoPath, createBackup);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  // Remote Synchronization Handlers (Phase 2)
  const handleFetch = async (remote = 'origin', prune = true) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['fetch', remote, ...(prune ? ['--prune'] : [])];

    try {
      const res = await gitFetch(repoPath, remote, prune);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handlePull = async (remote = 'origin', branch?: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['pull', remote, ...(branch ? [branch] : [])];

    try {
      const res = await gitPull(repoPath, remote, branch);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handlePush = async (
    remote = 'origin',
    branch?: string,
    forceWithLease = false,
    setUpstream = false,
    mode?: PushMode
  ) => {
    if (!repoPath) return;
    const start = performance.now();
    const effectiveMode = mode || (forceWithLease ? 'force_with_lease' : 'normal');
    const cmdTokens = [
      'push',
      ...(setUpstream && effectiveMode !== 'mirror' ? ['-u'] : []),
      ...(effectiveMode === 'force_with_lease'
        ? ['--force-with-lease']
        : effectiveMode === 'raw_force'
        ? ['--force']
        : effectiveMode === 'mirror'
        ? ['--mirror']
        : []),
      remote,
      ...(effectiveMode !== 'mirror' && branch ? [branch] : []),
    ];

    try {
      const res = await gitPush(repoPath, remote, branch, forceWithLease, setUpstream, mode);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleDeleteRemoteRef = async (
    remote: string,
    refType: 'branch' | 'tag',
    refName: string
  ) => {
    if (!repoPath) return;
    const start = performance.now();
    const target = refType === 'tag' ? `refs/tags/${refName}` : refName;
    const cmdTokens = ['push', remote, '--delete', target];

    try {
      const res = await deleteRemoteRef(repoPath, remote, refType, refName);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleOpenRestoreModal = (sha: string, filePath: string) => {
    const commit = commits.find((c) => c.sha === sha);
    setRestoreTargetSha(sha);
    setRestoreTargetFile(filePath);
    setRestoreTargetSubject(commit?.subject || commitDetail?.commit.subject || null);
    setIsRestoreModalOpen(true);
  };

  const handleConfirmRestore = async (sha: string, filePath: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['checkout', sha.substring(0, 8), '--', filePath];
    try {
      const res = await restoreFileFromCommit(repoPath, sha, filePath);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
      setSystemToast({
        message: `Restored ${filePath} from commit ${sha.substring(0, 8)} into working tree`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleOpenSystemLocation = async (target: 'terminal' | 'file_manager') => {
    if (!repoPath) return;
    try {
      const res = await openSystemLocation(repoPath, target);
      if (res.command_snippet) {
        navigator.clipboard?.writeText?.(res.command_snippet).catch(() => {});
      }
      setSystemToast({
        message: res.message,
        commandSnippet: res.command_snippet,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSystemToast({
        message: `Failed to open: ${msg}`,
      });
    }
  };

  // Hunk Operations Handlers (Phase 2)
  const handleStageHunk = async (patch: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['apply', '--cached', '-'];
    try {
      const res = await stageHunk(repoPath, patch);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
      if (selectedFile) {
        const diffStart = performance.now();
        const newDiff = await getFileDiff(repoPath, selectedFile);
        recordCommand(['diff', '--', selectedFile], Math.round(performance.now() - diffStart));
        setDiff(newDiff);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleUnstageHunk = async (patch: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['apply', '--cached', '--reverse', '-'];
    try {
      const res = await unstageHunk(repoPath, patch);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
      if (selectedFile) {
        const diffStart = performance.now();
        const newDiff = await getFileDiff(repoPath, selectedFile);
        recordCommand(
          ['diff', '--cached', '--', selectedFile],
          Math.round(performance.now() - diffStart)
        );
        setDiff(newDiff);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleDiscardHunk = async (patch: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['apply', '--reverse', '-'];
    try {
      const res = await discardHunk(repoPath, patch);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
      if (selectedFile) {
        const diffStart = performance.now();
        const newDiff = await getFileDiff(repoPath, selectedFile);
        recordCommand(['diff', '--', selectedFile], Math.round(performance.now() - diffStart));
        setDiff(newDiff);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  // Conflict Resolution Handlers (Phase 2)
  const handleResolveConflict = async (filePath: string, resolution: ConflictResolutionType) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens =
      resolution === 'ours'
        ? ['checkout', '--ours', '--', filePath]
        : resolution === 'theirs'
          ? ['checkout', '--theirs', '--', filePath]
          : ['add', '--', filePath];

    try {
      const res = await resolveConflict(repoPath, filePath, resolution);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      await loadRepositoryData(repoPath);
      setSystemToast({
        message: `Resolved ${filePath} (${resolution})`,
        commandSnippet: `git ${cmdTokens.join(' ')}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleLaunchMergetool = async (filePath?: string) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['mergetool', '--no-prompt', ...(filePath ? ['--', filePath] : [])];
    try {
      const res = await launchMergetool(repoPath, filePath);
      recordCommand(
        cmdTokens,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: 'External mergetool command initiated',
        commandSnippet: `git ${cmdTokens.join(' ')}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(cmdTokens, Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
    }
  };

  const handleContinueConflict = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await continueConflictOperation(repoPath);
      recordCommand(
        res.command_run,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: 'Operation successfully continued and committed',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['continue'], Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleAbortConflict = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await abortConflictOperation(repoPath);
      recordCommand(
        res.command_run,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: 'Conflict operation aborted; repository state restored',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['abort'], Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleCreateDemoConflict = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await createDemoConflict(repoPath);
      recordCommand(
        res.command_run,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: 'Simulated merge conflict generated on src/index.js',
        commandSnippet: 'git merge feature/conflict-demo',
      });
      await loadRepositoryData(repoPath);
      setSelectedView('working-tree');
      setSelectedFile('src/index.js');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(
        ['merge', 'feature/conflict-demo'],
        Math.round(performance.now() - start),
        false,
        1,
        msg
      );
      setError(msg);
      throw err;
    }
  };

  // Interactive Rebase Handlers (Phase 3 Step 1)
  const handleOpenRebaseModal = (baseSha: string, baseSummary?: string) => {
    setRebaseModalTarget({ baseSha, baseSummary });
  };

  const handleRebaseContinue = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await continueConflictOperation(repoPath);
      recordCommand(
        res.command_run,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: 'Interactive rebase continued',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['rebase', '--continue'], Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleRebaseSkip = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await rebaseSkip(repoPath);
      recordCommand(
        res.command_run,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: 'Current commit skipped; rebase continued',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['rebase', '--skip'], Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleRebaseAbort = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await abortConflictOperation(repoPath);
      recordCommand(
        res.command_run,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: 'Interactive rebase aborted; original branch restored',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['rebase', '--abort'], Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  // Cherry-Pick Handlers (Phase 3 Step 3)
  const handleCherryPickSuccess = async (
    result: OperationResult,
    commit: CommitInfo,
    hasConflict?: boolean
  ) => {
    recordCommand(
      result.command_run || ['cherry-pick', commit.sha.slice(0, 7)],
      result.duration_ms || 100,
      result.success,
      result.exit_code,
      result.stderr
    );

    if (repoPath) {
      await loadRepositoryData(repoPath);
    }

    if (hasConflict || result.exit_code === 1) {
      setSelectedView('working-tree');
      setSystemToast({
        message: `Cherry-pick paused with conflicts applying ${commit.sha.slice(0, 7)}. Resolve in Working Tree.`,
        commandSnippet: result.command_run?.join(' '),
      });
    } else {
      setSystemToast({
        message: `Successfully cherry-picked commit ${commit.sha.slice(0, 7)} onto HEAD`,
        commandSnippet: result.command_run?.join(' '),
      });
    }
  };

  const handleSkipConflict = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      let res: OperationResult;
      if (conflictState?.in_cherry_pick) {
        res = await cherryPickSkip(repoPath);
      } else if (conflictState?.in_revert) {
        res = await revertSkip(repoPath);
      } else {
        res = await rebaseSkip(repoPath);
      }
      recordCommand(
        res.command_run,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: conflictState?.in_cherry_pick
          ? 'Cherry-pick commit skipped; operation resumed'
          : conflictState?.in_revert
            ? 'Revert commit skipped; operation resumed'
            : 'Rebase commit skipped; rebase resumed',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['skip'], Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  // Revert Handlers (Phase 3 Step 4)
  const handleRevertSuccess = async (
    result: OperationResult,
    commit: CommitInfo,
    hasConflict?: boolean
  ) => {
    recordCommand(
      result.command_run || ['revert', commit.sha.slice(0, 7)],
      result.duration_ms || 100,
      result.success,
      result.exit_code,
      result.stderr
    );

    if (repoPath) {
      await loadRepositoryData(repoPath);
    }

    if (hasConflict || result.exit_code === 1) {
      setSelectedView('working-tree');
      setSystemToast({
        message: `Revert paused with conflicts reverting ${commit.sha.slice(0, 7)}. Resolve in Working Tree.`,
        commandSnippet: result.command_run?.join(' '),
      });
    } else {
      setSystemToast({
        message: `Successfully reverted commit ${commit.sha.slice(0, 7)}`,
        commandSnippet: result.command_run?.join(' '),
      });
    }
  };

  const handleCreateDemoRevertConflict = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await createDemoRevertConflict(repoPath);
      recordCommand(
        res.command_run,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: 'Simulated revert conflict scenario prepared',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
      setSelectedView('working-tree');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(
        ['revert', 'demo-conflict'],
        Math.round(performance.now() - start),
        false,
        1,
        msg
      );
      setError(msg);
      throw err;
    }
  };

  const handleCreateDemoCherryPickConflict = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await createDemoCherryPickConflict(repoPath);
      recordCommand(
        res.command_run,
        Math.round(performance.now() - start),
        res.success,
        res.exit_code,
        res.stderr
      );
      setSystemToast({
        message: 'Simulated cherry-pick conflict scenario prepared',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
      setSelectedView('working-tree');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(
        ['cherry-pick', 'demo-conflict'],
        Math.round(performance.now() - start),
        false,
        1,
        msg
      );
      setError(msg);
      throw err;
    }
  };

  // Reflog & Reset Handlers (Phase 3 Step 5)
  const handleRefreshReflog = async () => {
    if (!repoPath) return;
    setReflogLoading(true);
    const start = performance.now();
    try {
      const newReflog = await getReflog(repoPath, 100);
      recordCommand(['reflog', 'show', '-n', '100'], Math.round(performance.now() - start));
      setReflogEntries(newReflog);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to refresh reflog: ${msg}`);
    } finally {
      setReflogLoading(false);
    }
  };

  const handleConfirmReset = async (mode: ResetMode, createBackup = true) => {
    if (!repoPath || !resetTargetModal) return;
    setResetLoading(true);
    const start = performance.now();
    try {
      const res = await resetToTarget(repoPath, resetTargetModal.targetRef, mode, createBackup);
      recordCommand(res.command_run, res.duration_ms, res.success, res.exit_code, res.stderr);
      setSystemToast({
        message: `Successfully reset HEAD to ${resetTargetModal.targetRef} (--${mode})${res.backup_declined ? ' (backup declined)' : ''}`,
        commandSnippet: `git reset --${mode} ${resetTargetModal.targetRef}`,
      });
      setResetTargetModal(null);
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Reset failed: ${msg}`);
      recordCommand(
        ['reset', `--${mode}`, resetTargetModal.targetRef],
        Math.round(performance.now() - start),
        false,
        1,
        msg
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleRescueBranch = (sha: string, refSelector: string) => {
    setCreateBranchStartSha(sha);
    const sanitized = refSelector
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    setCreateBranchRefName(sanitized.startsWith('rescue') ? sanitized : `rescue-${sanitized}`);
    setIsCreateBranchOpen(true);
  };

  const handleCherryPickFromReflog = (sha: string) => {
    const existing = commits.find((c) => c.sha === sha);
    if (existing) {
      setCherryPickModalCommit(existing);
    } else {
      const now = new Date().toISOString();
      setCherryPickModalCommit({
        sha,
        parents: [],
        author_name: 'Unknown',
        author_email: '',
        author_date: now,
        committer_name: 'Unknown',
        committer_email: '',
        committer_date: now,
        subject: `Commit ${sha.substring(0, 7)}`,
        body: '',
        refs: [],
      });
    }
  };

  // Worktree Handlers (Phase 3 Step 6)
  const handleRefreshWorktrees = async () => {
    if (!repoPath) return;
    setWorktreesLoading(true);
    const start = performance.now();
    try {
      const newWorktrees = await getWorktrees(repoPath);
      recordCommand(['worktree', 'list', '--porcelain'], Math.round(performance.now() - start));
      setWorktrees(newWorktrees);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to refresh worktrees: ${msg}`);
    } finally {
      setWorktreesLoading(false);
    }
  };

  const latestCommitMsg =
    commits.length > 0
      ? commits[0].body
        ? `${commits[0].subject}\n\n${commits[0].body}`
        : commits[0].subject
      : undefined;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Top Application Bar */}
      <header className="h-11 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 px-3 flex items-center justify-between shrink-0 select-none">
        {/* Left: App Brand & Current Branch */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
            <span className="hidden sm:inline">Git Workbench</span>
          </div>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

          {/* Repo button / selector */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsRepoModalOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 transition-colors truncate max-w-xs cursor-pointer"
              title="Open repository modal or view recent"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">
                {status
                  ? status.root_path.split(/[\\/]/).filter(Boolean).pop() || 'Repository'
                  : 'Open Repository...'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleBrowseFolder}
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-200/60 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              title="Open operating system folder selection dialog"
            >
              <FolderSearch className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="hidden md:inline text-[11px] font-medium">Open Folder...</span>
            </button>
          </div>

          {/* Quick Open System Location (Phase 2 / Phase 3) */}
          {status && (
            <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-2">
              <button
                type="button"
                onClick={() => handleOpenSystemLocation('terminal')}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                title="Launch system terminal at repository root (or copy cd command)"
              >
                <SquareTerminal className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="hidden md:inline text-[11px]">Terminal</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenSystemLocation('file_manager')}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                title="Reveal repository folder in native file explorer"
              >
                <FolderSearch className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="hidden md:inline text-[11px]">Reveal</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Controls, Audit Log, Git Status, Theme */}
        <div className="flex items-center gap-2">
          {/* Remote Sync Button & Indicator (Phase 2) */}
          {status && (
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 transition-colors"
              title={
                syncStatus?.has_upstream
                  ? `Sync with ${syncStatus.upstream_name} (${syncStatus.ahead} ahead, ${syncStatus.behind} behind)`
                  : 'Remote Synchronization'
              }
            >
              <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="hidden sm:inline font-medium text-xs">Sync</span>
              {syncStatus?.has_upstream && (syncStatus.ahead > 0 || syncStatus.behind > 0) && (
                <div className="flex items-center gap-1 font-mono text-[10px] ml-0.5">
                  {syncStatus.ahead > 0 && (
                    <span className="flex items-center text-blue-600 dark:text-blue-400 font-semibold">
                      <ArrowUp className="w-2.5 h-2.5" />
                      {syncStatus.ahead}
                    </span>
                  )}
                  {syncStatus.behind > 0 && (
                    <span className="flex items-center text-amber-600 dark:text-amber-400 font-semibold">
                      <ArrowDown className="w-2.5 h-2.5" />
                      {syncStatus.behind}
                    </span>
                  )}
                </div>
              )}
            </button>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
            title="Refresh repository (re-run status, branches, commits)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>

          {/* Audit & Command Log */}
          <button
            type="button"
            onClick={() => setIsCommandLogOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-200/60 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-mono text-zinc-700 dark:text-zinc-300 transition-colors"
            title="View executed Git command log"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden md:inline">Command Log</span>
            <span className="px-1 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px]">
              {commandLogs.length}
            </span>
          </button>

          {/* Global Search & Replace */}
          <button
            type="button"
            onClick={() => setIsSearchReplaceOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-200/60 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Global Search & Replace across repository (Ctrl+Shift+F)"
          >
            <Search className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden md:inline">Find &amp; Replace</span>
            <kbd className="hidden 2xl:inline-block px-1 py-0.2 text-[9px] font-mono bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded">
              Ctrl+Shift+F
            </kbd>
          </button>

          {/* Clean AI Signs (AI Sanitizer) */}
          <button
            type="button"
            onClick={() => setIsAISanitizerOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-medium transition-colors cursor-pointer"
            title="Automatically scrub Built with AI Studio banners, Cursor trailers, and config files"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span className="hidden xl:inline">Clean AI Signs</span>
          </button>

          {/* System Audit (Phase 5) */}
          <button
            type="button"
            onClick={() => setIsSystemAuditOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-medium transition-colors cursor-pointer"
            title="Architecture Invariants & System Audit"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">System Audit</span>
          </button>

          {/* Help & Problem Solving Manual */}
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-medium transition-colors cursor-pointer"
            title="Open Problem Solving & Troubleshooting Manual (F1 or ?)"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Help &amp; Manual</span>
            <kbd className="hidden lg:inline-block px-1 py-0.2 text-[9px] font-mono bg-blue-500/15 text-blue-600 dark:text-blue-300 rounded border border-blue-500/20">
              F1
            </kbd>
          </button>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

          {/* Non-blocking Git CLI status badge */}
          <GitStatusBadge />

          {/* Theme switcher */}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      {/* Error banner if repository failed to load */}
      {error && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenSample}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 font-medium transition-colors"
            >
              Open Demo Sandbox
            </button>
            <button
              type="button"
              onClick={() => setIsRepoModalOpen(true)}
              className="font-medium underline hover:text-rose-700 dark:hover:text-rose-300"
            >
              Switch Repository
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-0.5 hover:bg-rose-500/20 rounded text-rose-500 hover:text-rose-700 dark:hover:text-rose-200"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          status={status}
          branches={branches}
          stashes={stashes}
          remotes={remotes}
          reflogCount={reflogEntries.length}
          worktreesCount={worktrees.length}
          tagsCount={tags.length}
          submodulesCount={submodules.length}
          inBisect={Boolean(bisectStatus?.in_bisect)}
          selectedView={selectedView}
          onSelectView={setSelectedView}
          onOpenRepoDialog={() => setIsRepoModalOpen(true)}
          onOpenHelpManual={() => setIsHelpModalOpen(true)}
          onOpenSearchReplace={() => setIsSearchReplaceOpen(true)}
          onOpenAISanitizer={() => setIsAISanitizerOpen(true)}
          onSwitchBranch={handleSwitchBranch}
          onOpenCreateBranch={handleOpenCreateBranch}
          onOpenRenameBranch={handleOpenRenameBranch}
          onOpenDeleteBranch={handleOpenDeleteBranch}
          onOpenCreateStash={() => setIsCreateStashOpen(true)}
          onOpenAddWorktree={() => setIsAddWorktreeOpen(true)}
          onOpenResetHard={() => setIsResetHardOpen(true)}
          onOpenSync={() => setIsSyncModalOpen(true)}
          onOpenSystemAudit={() => setIsSystemAuditOpen(true)}
          onOpenTags={() => setIsTagModalOpen(true)}
          onOpenSubmodulesAndLfs={() => setIsSubmodulesLfsOpen(true)}
          onOpenBisect={() => setIsBisectRerereOpen(true)}
          onOpenRangeDiff={() => setIsRangeDiffOpen(true)}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
          theme={theme}
        />

        {/* Center & Right Work Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-zinc-50/20 dark:bg-zinc-950">
          {selectedView === 'working-tree' ? (
            /* Working tree mode: File status on top/left, Monaco diff on right/bottom */
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              <div className="lg:col-span-4 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden h-full">
                <WorkingTreePanel
                  status={status}
                  conflictState={conflictState}
                  rebaseStatus={rebaseStatus}
                  selectedFile={selectedFile}
                  onSelectFile={setSelectedFile}
                  onRefresh={handleRefresh}
                  onStageFile={handleStageFile}
                  onUnstageFile={handleUnstageFile}
                  onDiscardFile={handleDiscardFile}
                  onStageAll={handleStageAll}
                  onUnstageAll={handleUnstageAll}
                  onCommit={handleCommit}
                  onResolveConflict={handleResolveConflict}
                  onLaunchMergetool={handleLaunchMergetool}
                  onContinueConflict={handleContinueConflict}
                  onSkipConflict={handleSkipConflict}
                  onAbortConflict={handleAbortConflict}
                  onCreateDemoConflict={handleCreateDemoConflict}
                  onCreateDemoCherryPickConflict={handleCreateDemoCherryPickConflict}
                  onCreateDemoRevertConflict={handleCreateDemoRevertConflict}
                  onRebaseContinue={handleRebaseContinue}
                  onRebaseSkip={handleRebaseSkip}
                  onRebaseAbort={handleRebaseAbort}
                  lastCommitMessage={latestCommitMsg}
                  loading={loading}
                  theme={theme}
                />
              </div>
              <div className="lg:col-span-8 p-3 overflow-hidden h-full">
                <DiffViewer
                  diff={diff}
                  loading={diffLoading}
                  theme={theme}
                  isStaged={Boolean(status?.staged.some((f) => f.path === selectedFile))}
                  onStageHunk={handleStageHunk}
                  onUnstageHunk={handleUnstageHunk}
                  onDiscardHunk={handleDiscardHunk}
                />
              </div>
            </div>
          ) : selectedView === 'stashes' ? (
            /* Stash mode: Stash list & changed files on left, Monaco diff on right */
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              <div className="lg:col-span-5 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden h-full">
                <StashManager
                  repoPath={repoPath || ''}
                  stashes={stashes}
                  selectedStashRef={selectedStashRef}
                  onSelectStash={(ref) => {
                    setSelectedStashRef(ref);
                    setSelectedFile(null);
                    setDiff(null);
                  }}
                  onSelectFileForDiff={(filePath, stashRef) => {
                    setSelectedStashRef(stashRef);
                    setSelectedFile(filePath);
                  }}
                  activeDiffFile={selectedFile}
                  onOpenCreateStashModal={() => setIsCreateStashOpen(true)}
                  onApplyStash={handleApplyStash}
                  onPopStash={handlePopStash}
                  onRequestDropStash={(stash) => {
                    setDropStashTarget(stash);
                    setIsDropStashOpen(true);
                  }}
                  onRequestBranchFromStash={(stash) => {
                    setBranchFromStashTarget(stash);
                    setIsBranchFromStashOpen(true);
                  }}
                  onClearStashes={handleClearStashes}
                />
              </div>
              <div className="lg:col-span-7 p-3 overflow-hidden h-full">
                <DiffViewer diff={diff} loading={diffLoading} theme={theme} />
              </div>
            </div>
          ) : selectedView === 'reflog' ? (
            /* Reflog mode: Reflog entries timeline on left, commit detail & Monaco diff on right */
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              <div className="lg:col-span-7 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden h-full">
                <ReflogViewer
                  repoPath={repoPath || ''}
                  reflogEntries={reflogEntries}
                  loading={reflogLoading}
                  onRefresh={handleRefreshReflog}
                  onSelectCommit={(sha) => {
                    setSelectedSha(sha);
                  }}
                  selectedSha={selectedSha}
                  onRescueBranch={handleRescueBranch}
                  onResetHead={(targetRef, subject) => {
                    setResetTargetModal({ targetRef, subject });
                  }}
                  onCherryPick={handleCherryPickFromReflog}
                  theme={theme}
                />
              </div>
              <div className="lg:col-span-5 flex flex-col overflow-hidden h-full bg-zinc-50/20 dark:bg-zinc-900/20">
                <div className="h-[45%] border-b border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <CommitDetailPanel
                    detail={commitDetail}
                    loading={detailLoading}
                    selectedFile={selectedFile}
                    onSelectFile={setSelectedFile}
                    onCreateBranchAtCommit={(sha, subject) => handleOpenCreateBranch(sha, subject)}
                    onStartInteractiveRebase={handleOpenRebaseModal}
                    onCherryPick={setCherryPickModalCommit}
                    onRevert={setRevertModalCommit}
                    onModifyAuthorDate={setAuthorDateModalCommit}
                    onRestoreFile={handleOpenRestoreModal}
                    theme={theme}
                  />
                </div>
                <div className="h-[55%] p-3 overflow-hidden">
                  <DiffViewer diff={diff} loading={diffLoading} theme={theme} />
                </div>
              </div>
            </div>
          ) : selectedView === 'worktrees' ? (
            /* Worktrees mode: Parallel working trees dashboard */
            <div className="flex-1 overflow-hidden h-full">
              <WorktreeManager
                currentRepoPath={repoPath || ''}
                worktrees={worktrees}
                loading={worktreesLoading}
                onRefresh={handleRefreshWorktrees}
                onOpenAddModal={() => setIsAddWorktreeOpen(true)}
                onSwitchRepo={(newPath) => {
                  setRepoPath(newPath);
                  loadRepositoryData(newPath);
                }}
                onCommandExecuted={(res) => {
                  if (res.command_run) {
                    recordCommand(res.command_run, res.duration_ms || 100);
                  }
                  handleRefreshWorktrees();
                }}
                theme={theme}
              />
            </div>
          ) : selectedView === 'health' ? (
            /* Health mode: Object store fsck, secret leak audit, and safety backups */
            <div className="flex-1 overflow-hidden h-full">
              <RepoHealthAudit
                repoPath={repoPath || ''}
                onOpenPurgeWizard={() => setIsPurgeWizardOpen(true)}
                theme={theme}
              />
            </div>
          ) : (
            /* Graph mode: Commit Graph on top, Commit details & Monaco diff below */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top half: Topological Commit Graph List */}
              <div className="h-[48%] border-b border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <CommitList
                  commits={commits}
                  selectedSha={selectedSha}
                  onSelectCommit={setSelectedSha}
                  onStartInteractiveRebase={handleOpenRebaseModal}
                  onCherryPick={setCherryPickModalCommit}
                  onRevert={setRevertModalCommit}
                  onModifyAuthorDate={setAuthorDateModalCommit}
                  onResetToCommit={(c) =>
                    setResetTargetModal({ targetRef: c.sha, subject: c.subject })
                  }
                  onForceRelocateBranch={(c) => {
                    const currentHeadBranch = branches.find((b) => b.is_head)?.name || 'main';
                    setForceRelocateTarget({
                      branchName: currentHeadBranch,
                      targetSha: c.sha,
                      targetSubject: c.subject,
                    });
                  }}
                  onCreateBranchAtCommit={(sha, subject) => handleOpenCreateBranch(sha, subject)}
                  loading={loading}
                  theme={theme}
                />
              </div>

              {/* Bottom half: Selected Commit Details & Diff Inspector */}
              <div className="h-[52%] grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/20">
                {/* Left 4 cols: Commit metadata and changed files list */}
                <div className="lg:col-span-5 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden h-full">
                  <CommitDetailPanel
                    detail={commitDetail}
                    loading={detailLoading}
                    selectedFile={selectedFile}
                    onSelectFile={setSelectedFile}
                    onCreateBranchAtCommit={(sha, subject) => handleOpenCreateBranch(sha, subject)}
                    onStartInteractiveRebase={handleOpenRebaseModal}
                    onCherryPick={setCherryPickModalCommit}
                    onRevert={setRevertModalCommit}
                    onModifyAuthorDate={setAuthorDateModalCommit}
                    onRestoreFile={handleOpenRestoreModal}
                    theme={theme}
                  />
                </div>

                {/* Right 7 cols: Monaco Diff Editor */}
                <div className="lg:col-span-7 p-2.5 overflow-hidden h-full">
                  <DiffViewer diff={diff} loading={diffLoading} theme={theme} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Branch Management Modals */}
      <CreateBranchModal
        isOpen={isCreateBranchOpen}
        onClose={() => setIsCreateBranchOpen(false)}
        startSha={createBranchStartSha}
        startRefName={
          createBranchRefName ||
          (createBranchStartSha ? undefined : branches.find((b) => b.is_head)?.name || 'HEAD')
        }
        existingBranches={branches.filter((b) => b.is_local).map((b) => b.name)}
        onCreateBranch={handleCreateBranch}
        theme={theme}
      />

      <RenameBranchModal
        isOpen={isRenameBranchOpen}
        onClose={() => setIsRenameBranchOpen(false)}
        currentName={renameBranchOldName}
        existingBranches={branches.filter((b) => b.is_local).map((b) => b.name)}
        onRenameBranch={handleRenameBranch}
        theme={theme}
      />

      <DeleteBranchModal
        isOpen={isDeleteBranchOpen}
        onClose={() => setIsDeleteBranchOpen(false)}
        branchName={deleteBranchTarget?.name || ''}
        isHead={deleteBranchTarget?.isHead ?? false}
        onDeleteBranch={handleDeleteBranch}
        theme={theme}
      />

      {/* Stash Management Modals */}
      <CreateStashModal
        isOpen={isCreateStashOpen}
        onClose={() => setIsCreateStashOpen(false)}
        onConfirm={handleCreateStash}
        status={status}
      />

      <DropStashModal
        isOpen={isDropStashOpen}
        stash={dropStashTarget}
        onClose={() => {
          setIsDropStashOpen(false);
          setDropStashTarget(null);
        }}
        onConfirm={handleDropStash}
      />

      <BranchFromStashModal
        isOpen={isBranchFromStashOpen}
        stash={branchFromStashTarget}
        existingBranches={branches}
        onClose={() => {
          setIsBranchFromStashOpen(false);
          setBranchFromStashTarget(null);
        }}
        onConfirm={handleBranchFromStash}
      />

      <ResetHardModal
        isOpen={isResetHardOpen}
        status={status}
        onClose={() => setIsResetHardOpen(false)}
        onConfirm={handleResetHard}
      />

      {/* Remote Synchronization Modal (Phase 2) */}
      <RemoteSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncStatus={syncStatus}
        remotes={remotes}
        currentBranch={status?.current_branch || null}
        onFetch={handleFetch}
        onPull={handlePull}
        onPush={handlePush}
        onDeleteRemoteRef={handleDeleteRemoteRef}
      />

      {/* Open Repository Modal */}
      <OpenRepoModal
        isOpen={isRepoModalOpen}
        onClose={() => setIsRepoModalOpen(false)}
        onOpenPath={handleOpenPath}
        onOpenSample={handleOpenSample}
        theme={theme}
      />

      {/* Command & Audit Log Modal */}
      <CommandLogModal
        isOpen={isCommandLogOpen}
        onClose={() => setIsCommandLogOpen(false)}
        logs={commandLogs}
        theme={theme}
      />

      {/* Restore File From Historical Commit Modal (Phase 2 / Phase 3) */}
      <RestoreFileModal
        isOpen={isRestoreModalOpen}
        filePath={restoreTargetFile}
        commitSha={restoreTargetSha}
        commitSubject={restoreTargetSubject}
        onClose={() => setIsRestoreModalOpen(false)}
        onConfirm={handleConfirmRestore}
        theme={theme}
      />

      {/* Interactive Rebase Modal (Phase 3 Step 1) */}
      {rebaseModalTarget && repoPath && (
        <InteractiveRebaseModal
          isOpen={Boolean(rebaseModalTarget)}
          repoPath={repoPath}
          baseSha={rebaseModalTarget.baseSha}
          baseSummary={rebaseModalTarget.baseSummary}
          onClose={() => setRebaseModalTarget(null)}
          onRebaseStarted={(cmd) => {
            recordCommand(cmd, 0);
            setSystemToast({
              message: 'Interactive rebase initiated',
              commandSnippet: cmd.join(' '),
            });
            if (repoPath) loadRepositoryData(repoPath);
          }}
          theme={theme}
        />
      )}

      {/* Modify Commit Author & Timestamp Modal (Phase 3 Step 2) */}
      {authorDateModalCommit && repoPath && (
        <CommitAuthorDateModal
          isOpen={Boolean(authorDateModalCommit)}
          repoPath={repoPath}
          commit={authorDateModalCommit}
          isHead={Boolean(
            authorDateModalCommit &&
            (authorDateModalCommit.refs.some((r) => r.includes('HEAD')) ||
              branches.find((b) => b.is_head)?.tip_sha === authorDateModalCommit.sha ||
              commits[0]?.sha === authorDateModalCommit.sha)
          )}
          onClose={() => setAuthorDateModalCommit(null)}
          onSuccess={async (result) => {
            recordCommand(
              ['commit', '--amend', '...'],
              100,
              result.success,
              result.exit_code,
              result.stderr
            );
            setSystemToast({
              message: 'Commit author and timestamp updated successfully!',
            });
            if (repoPath) {
              await loadRepositoryData(repoPath);
            }
          }}
          onStartInteractiveRebase={handleOpenRebaseModal}
        />
      )}

      {/* Cherry-Pick Modal (Phase 3 Step 3) */}
      {cherryPickModalCommit && repoPath && (
        <CherryPickModal
          isOpen={Boolean(cherryPickModalCommit)}
          repoPath={repoPath}
          commit={cherryPickModalCommit}
          onClose={() => setCherryPickModalCommit(null)}
          onSuccess={(result, hasConflict) => {
            if (cherryPickModalCommit) {
              handleCherryPickSuccess(result, cherryPickModalCommit, hasConflict);
            }
          }}
          theme={theme}
        />
      )}

      {/* Revert Modal (Phase 3 Step 4) */}
      {revertModalCommit && repoPath && (
        <RevertModal
          isOpen={Boolean(revertModalCommit)}
          repoPath={repoPath}
          commit={revertModalCommit}
          targetBranch={branches.find((b) => b.is_head)?.name || 'HEAD'}
          onClose={() => setRevertModalCommit(null)}
          onSuccess={(result, hasConflict) => {
            if (revertModalCommit) {
              handleRevertSuccess(result, revertModalCommit, hasConflict);
            }
          }}
          theme={theme}
        />
      )}

      {/* Reset HEAD Modal (Phase 3 Step 5) */}
      {resetTargetModal && (
        <ResetConfirmModal
          isOpen={Boolean(resetTargetModal)}
          targetRef={resetTargetModal.targetRef}
          targetSubject={resetTargetModal.subject}
          onClose={() => setResetTargetModal(null)}
          onConfirm={handleConfirmReset}
          loading={resetLoading}
          theme={theme}
        />
      )}

      {/* Add Linked Worktree Modal (Phase 3 Step 6) */}
      {isAddWorktreeOpen && repoPath && (
        <AddWorktreeModal
          isOpen={isAddWorktreeOpen}
          repoPath={repoPath}
          branches={branches}
          existingWorktreePaths={worktrees.map((w) => w.path)}
          existingWorktreeBranches={worktrees.map((w) => w.branch).filter(Boolean) as string[]}
          onClose={() => setIsAddWorktreeOpen(false)}
          onSuccess={(result, newPath) => {
            if (result.command_run) {
              recordCommand(result.command_run, result.duration_ms || 100);
            }
            handleRefreshWorktrees();
            setSystemToast({
              message: `Worktree created successfully at ${newPath}`,
            });
          }}
          theme={theme}
        />
      )}

      {/* History Purge Wizard Modal (Phase 4) */}
      {isPurgeWizardOpen && repoPath && (
        <HistoryPurgeWizard
          isOpen={isPurgeWizardOpen}
          repoPath={repoPath}
          onClose={() => setIsPurgeWizardOpen(false)}
          onSuccess={(result) => {
            if (result.command_run) {
              recordCommand(result.command_run, result.duration_ms || 500);
            }
            loadRepositoryData(repoPath);
            setSystemToast({
              message: 'History purge complete. Repository reloaded.',
            });
          }}
          theme={theme}
        />
      )}

      {/* System Audit & Distribution Readiness Modal (Phase 5) */}
      {isSystemAuditOpen && (
        <SystemAuditModal
          isOpen={isSystemAuditOpen}
          onClose={() => setIsSystemAuditOpen(false)}
          gitAvailability={null}
          activeRepoPath={repoPath}
        />
      )}

      {/* Tag Manager Modal (Phase 3 Extension) */}
      {isTagModalOpen && (
        <TagManagerModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          tags={tags}
          currentHeadSha={commits[0]?.sha}
          onRefreshTags={async () => {
            if (!repoPath) return;
            const newTags = await getTags(repoPath);
            setTags(newTags);
          }}
          onCreateTag={async (options) => {
            if (!repoPath) return;
            const start = performance.now();
            const res = await createTag(repoPath, options);
            recordCommand(
              res.command_run || ['tag', options.name],
              Math.round(performance.now() - start)
            );
            setSystemToast({ message: `Tag "${options.name}" created.` });
          }}
          onDeleteTag={async (tagName) => {
            if (!repoPath) return;
            const start = performance.now();
            const res = await deleteTag(repoPath, tagName);
            recordCommand(
              res.command_run || ['tag', '-d', tagName],
              Math.round(performance.now() - start)
            );
            setSystemToast({ message: `Tag "${tagName}" deleted.` });
          }}
          onPushTag={async (tagName) => {
            if (!repoPath) return;
            const start = performance.now();
            const res = await gitPush(repoPath, undefined, tagName);
            recordCommand(
              res.command_run || ['push', 'origin', tagName],
              Math.round(performance.now() - start)
            );
            setSystemToast({ message: `Tag "${tagName}" pushed to remote.` });
          }}
        />
      )}

      {/* Submodules & Git LFS Modal (Phase 3 Extension) */}
      {isSubmodulesLfsOpen && (
        <SubmodulesAndLfsModal
          isOpen={isSubmodulesLfsOpen}
          onClose={() => setIsSubmodulesLfsOpen(false)}
          submodules={submodules}
          lfsDiagnostics={lfsDiagnostics}
          onUpdateSubmodules={async (recursive) => {
            if (!repoPath) throw new Error('No repository selected');
            const start = performance.now();
            const res = await updateSubmodules(repoPath, recursive);
            recordCommand(
              res.command_run || ['submodule', 'update', '--init', recursive ? '--recursive' : ''],
              Math.round(performance.now() - start)
            );
            return res;
          }}
          onRefreshData={async () => {
            if (!repoPath) return;
            const newSubs = await getSubmodules(repoPath);
            setSubmodules(newSubs);
            const lfsDiag = await getLfsDiagnostics(repoPath);
            setLfsDiagnostics(lfsDiag);
          }}
          onOpenSubmoduleRepo={(subPath) => {
            if (!repoPath) return;
            const fullPath = `${repoPath}/${subPath}`;
            loadRepositoryData(fullPath);
            setIsSubmodulesLfsOpen(false);
          }}
        />
      )}

      {/* Bisect & Rerere Modal (Phase 3 Extension) */}
      {isBisectRerereOpen && repoPath && (
        <BisectAndRerereModal
          isOpen={isBisectRerereOpen}
          onClose={() => setIsBisectRerereOpen(false)}
          repoPath={repoPath}
          commits={commits}
          bisectStatus={bisectStatus}
          rerereStatus={rerereStatus}
          onRunBisect={async (action, commitSha) => {
            const start = performance.now();
            const res = await runBisectCommand(repoPath, action, commitSha);
            recordCommand(
              res.command_run || ['bisect', action, ...(commitSha ? [commitSha] : [])],
              Math.round(performance.now() - start),
              res.success,
              res.exit_code,
              res.stderr
            );
            return res;
          }}
          onToggleRerere={async (enable) => {
            const start = performance.now();
            const res = await toggleRerere(repoPath, enable);
            recordCommand(
              res.command_run || ['config', 'rerere.enabled', String(enable)],
              Math.round(performance.now() - start)
            );
            setSystemToast({
              message: `git rerere ${enable ? 'enabled' : 'disabled'}`,
            });
            return res;
          }}
          onRefresh={async () => {
            if (!repoPath) return;
            const bStatus = await getBisectStatus(repoPath);
            setBisectStatus(bStatus);
            const rStatus = await getRerereStatus(repoPath);
            setRerereStatus(rStatus);
            // Refresh git status as bisect checks out commits
            const st = await getStatus(repoPath);
            setStatus(st);
            const cList = await getCommitGraph(repoPath);
            setCommits(cList);
          }}
        />
      )}

      {/* Merge Branch Modal (Phase 3 Extension: -X ours/theirs vs -s ours) */}
      {isMergeModalOpen && repoPath && (
        <MergeBranchModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          currentBranch={status?.current_branch || 'HEAD'}
          branches={branches}
          onExecuteMerge={async (options) => {
            const start = performance.now();
            const res = await mergeWithOptions(repoPath, options);
            recordCommand(
              res.command_run || ['merge', options.branchName],
              Math.round(performance.now() - start),
              res.success,
              res.exit_code,
              res.stderr
            );
            setSystemToast({
              message: `Merge operation finished: ${options.branchName} into ${status?.current_branch || 'HEAD'}`,
            });
            await handleRefresh();
            return res;
          }}
        />
      )}

      {/* Range-Diff Modal (Phase 3 Extension) */}
      {isRangeDiffOpen && repoPath && (
        <RangeDiffViewerModal
          isOpen={isRangeDiffOpen}
          onClose={() => setIsRangeDiffOpen(false)}
          onRunRangeDiff={async (baseSha, oldSha, newSha, creationFactor) => {
            const start = performance.now();
            const res = await getRangeDiff(repoPath, baseSha, oldSha, newSha, creationFactor);
            const cmd = ['range-diff'];
            if (creationFactor !== undefined) {
              cmd.push(`--creation-factor=${Math.round(creationFactor)}`);
            }
            cmd.push(`${baseSha}..${oldSha}`, `${baseSha}..${newSha}`);
            recordCommand(cmd, Math.round(performance.now() - start));
            return res;
          }}
        />
      )}

      {/* Force Relocate Branch Modal (Phase 3 Extension: branch -f with lost commits preview) */}
      {forceRelocateTarget && repoPath && (
        <ForceRelocateBranchModal
          isOpen={Boolean(forceRelocateTarget)}
          onClose={() => setForceRelocateTarget(null)}
          branchName={forceRelocateTarget.branchName}
          targetSha={forceRelocateTarget.targetSha}
          targetSubject={forceRelocateTarget.targetSubject}
          currentBranch={status?.current_branch || undefined}
          onPreview={async (branchName, newSha) => {
            return await previewForceRelocateBranch(repoPath, branchName, newSha);
          }}
          onExecute={async (branchName, newSha, createBackup) => {
            const start = performance.now();
            const res = await executeForceRelocateBranch(
              repoPath,
              branchName,
              newSha,
              createBackup
            );
            recordCommand(
              res.command_run || ['branch', '-f', branchName, newSha],
              Math.round(performance.now() - start),
              res.success,
              res.exit_code,
              res.stderr
            );
            if (res.success) {
              setSystemToast({
                message: `Branch ${branchName} pointer relocated to ${newSha.slice(0, 7)}${createBackup ? ' (safety backup created)' : ''}`,
              });
              await handleRefresh();
            }
            return res;
          }}
        />
      )}

      {/* Help & Problem-Solving Manual Modal (Interactive Search & Step-by-Step Guides) */}
      <HelpManualModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        onPerformAction={handlePerformHelpAction}
        theme={theme}
      />

      {/* Global Search & Replace Modal */}
      {repoPath && (
        <SearchAndReplaceModal
          isOpen={isSearchReplaceOpen}
          onClose={() => setIsSearchReplaceOpen(false)}
          repoPath={repoPath}
          branches={branches}
          theme={theme}
          onSelectCommit={(sha) => {
            setSelectedSha(sha);
            setSelectedView('graph');
          }}
          onSelectFile={(filePath) => {
            setSelectedFile(filePath);
            setSelectedView('working-tree');
          }}
          onOpenAISanitizer={() => setIsAISanitizerOpen(true)}
          onRefresh={handleRefresh}
        />
      )}

      {/* AI Signs & Signature Sanitizer Modal */}
      {repoPath && (
        <AISanitizerModal
          isOpen={isAISanitizerOpen}
          onClose={() => setIsAISanitizerOpen(false)}
          repoPath={repoPath}
          theme={theme}
          onSuccess={() => {
            handleRefresh();
            setSystemToast({
              message: 'Repository sanitized: AI banners, trailers, and watermarks removed',
            });
          }}
        />
      )}

      {/* System Toast Notification */}
      {systemToast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 shadow-xl border border-zinc-700/60 dark:border-zinc-300 text-xs animate-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="flex flex-col gap-0.5 max-w-sm">
            <span className="font-medium truncate">{systemToast.message}</span>
            {systemToast.commandSnippet && (
              <span className="font-mono text-[10px] opacity-75 truncate">
                Command copied to clipboard
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSystemToast(null)}
            className="p-1 rounded hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-400 hover:text-zinc-200 dark:hover:text-zinc-800 cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
