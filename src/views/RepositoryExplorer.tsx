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
  deleteBranch,
  discardHunk,
  discardPath,
  dropStash,
  getBranches,
  getCommitDetail,
  getCommitGraph,
  getConflictState,
  getDetailedRebaseStatus,
  getFileDiff,
  getReflog,
  getRemotes,
  getStashes,
  getStatus,
  getSyncStatus,
  gitFetch,
  gitPull,
  gitPush,
  launchMergetool,
  openRepository,
  openSampleRepository,
  openSystemLocation,
  popStash,
  rebaseSkip,
  renameBranch,
  resetHard,
  resetToTarget,
  resolveConflict,
  restoreFileFromCommit,
  revertSkip,
  createDemoRevertConflict,
  stageAll,
  stageHunk,
  stagePath,
  switchBranch,
  unstageAll,
  unstageHunk,
  unstagePath,
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
import type { CommitAuthorOptions } from '../components/CommitBox';
import { OpenRepoModal } from '../components/OpenRepoModal';
import { CommandLogModal, type LoggedCommand } from '../components/CommandLogModal';
import { CreateBranchModal } from '../components/CreateBranchModal';
import { RenameBranchModal } from '../components/RenameBranchModal';
import { DeleteBranchModal } from '../components/DeleteBranchModal';
import { RemoteSyncModal } from '../components/RemoteSyncModal';
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

  const [selectedView, setSelectedView] = useState<'graph' | 'working-tree' | 'stashes' | 'reflog'>('graph');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isCommandLogOpen, setIsCommandLogOpen] = useState(false);
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
  const [systemToast, setSystemToast] = useState<{ message: string; commandSnippet?: string } | null>(null);

  // Conflict State (Phase 2)
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  // Interactive Rebase State (Phase 3 Step 1)
  const [rebaseStatus, setRebaseStatus] = useState<RebaseStatus | null>(null);
  const [rebaseModalTarget, setRebaseModalTarget] = useState<{ baseSha: string; baseSummary?: string } | null>(null);

  // Commit Author & Date Modification State (Phase 3 Step 2)
  const [authorDateModalCommit, setAuthorDateModalCommit] = useState<CommitInfo | null>(null);

  // Cherry-pick State (Phase 3 Step 3)
  const [cherryPickModalCommit, setCherryPickModalCommit] = useState<CommitInfo | null>(null);

  // Revert State (Phase 3 Step 4)
  const [revertModalCommit, setRevertModalCommit] = useState<CommitInfo | null>(null);

  // Reflog & Reset State (Phase 3 Step 5)
  const [reflogEntries, setReflogEntries] = useState<ReflogEntry[]>([]);
  const [reflogLoading, setReflogLoading] = useState(false);
  const [resetTargetModal, setResetTargetModal] = useState<{ targetRef: string; subject?: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

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
        recordCommand(
          ['stash', 'list'],
          Math.round(performance.now() - stashStart)
        );
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
          recordCommand(
            ['remote', '-v'],
            Math.round(performance.now() - remotesStart)
          );
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
          if (newConflictState.in_merge || newConflictState.in_rebase || newConflictState.in_cherry_pick || newConflictState.in_revert) {
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

  const handleOpenPath = async (path: string) => {
    await openRepository(path);
    await loadRepositoryData(path);
  };

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

  const handleResetHard = async () => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = ['reset', '--hard', 'HEAD'];

    try {
      const res = await resetHard(repoPath);
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
    setUpstream = false
  ) => {
    if (!repoPath) return;
    const start = performance.now();
    const cmdTokens = [
      'push',
      ...(setUpstream ? ['-u'] : []),
      ...(forceWithLease ? ['--force-with-lease'] : []),
      remote,
      ...(branch ? [branch] : []),
    ];

    try {
      const res = await gitPush(repoPath, remote, branch, forceWithLease, setUpstream);
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
      recordCommand(cmdTokens, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(cmdTokens, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
      await loadRepositoryData(repoPath);
      if (selectedFile) {
        const diffStart = performance.now();
        const newDiff = await getFileDiff(repoPath, selectedFile);
        recordCommand(['diff', '--cached', '--', selectedFile], Math.round(performance.now() - diffStart));
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
      recordCommand(cmdTokens, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(cmdTokens, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(cmdTokens, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(res.command_run, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(res.command_run, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(res.command_run, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
      setSystemToast({
        message: 'Simulated merge conflict generated on src/index.js',
        commandSnippet: 'git merge feature/conflict-demo',
      });
      await loadRepositoryData(repoPath);
      setSelectedView('working-tree');
      setSelectedFile('src/index.js');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['merge', 'feature/conflict-demo'], Math.round(performance.now() - start), false, 1, msg);
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
      recordCommand(res.command_run, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(res.command_run, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(res.command_run, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(res.command_run, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
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
      recordCommand(res.command_run, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
      setSystemToast({
        message: 'Simulated revert conflict scenario prepared',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
      setSelectedView('working-tree');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['revert', 'demo-conflict'], Math.round(performance.now() - start), false, 1, msg);
      setError(msg);
      throw err;
    }
  };

  const handleCreateDemoCherryPickConflict = async () => {
    if (!repoPath) return;
    const start = performance.now();
    try {
      const res = await createDemoCherryPickConflict(repoPath);
      recordCommand(res.command_run, Math.round(performance.now() - start), res.success, res.exit_code, res.stderr);
      setSystemToast({
        message: 'Simulated cherry-pick conflict scenario prepared',
        commandSnippet: res.command_run.join(' '),
      });
      await loadRepositoryData(repoPath);
      setSelectedView('working-tree');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      recordCommand(['cherry-pick', 'demo-conflict'], Math.round(performance.now() - start), false, 1, msg);
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

  const handleConfirmReset = async (mode: ResetMode) => {
    if (!repoPath || !resetTargetModal) return;
    setResetLoading(true);
    const start = performance.now();
    try {
      const res = await resetToTarget(repoPath, resetTargetModal.targetRef, mode);
      recordCommand(res.command_run, res.duration_ms, res.success, res.exit_code, res.stderr);
      setSystemToast({
        message: `Successfully reset HEAD to ${resetTargetModal.targetRef} (--${mode})`,
        commandSnippet: `git reset --${mode} ${resetTargetModal.targetRef}`,
      });
      setResetTargetModal(null);
      await loadRepositoryData(repoPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Reset failed: ${msg}`);
      recordCommand(['reset', `--${mode}`, resetTargetModal.targetRef], Math.round(performance.now() - start), false, 1, msg);
    } finally {
      setResetLoading(false);
    }
  };

  const handleRescueBranch = (sha: string, refSelector: string) => {
    setCreateBranchStartSha(sha);
    const sanitized = refSelector.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
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
          <button
            type="button"
            onClick={() => setIsRepoModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 transition-colors truncate max-w-xs"
            title="Switch repository"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">
              {status ? status.root_path.split('/').pop() : 'Open Repository...'}
            </span>
          </button>

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
          selectedView={selectedView}
          onSelectView={setSelectedView}
          onOpenRepoDialog={() => setIsRepoModalOpen(true)}
          onSwitchBranch={handleSwitchBranch}
          onOpenCreateBranch={handleOpenCreateBranch}
          onOpenRenameBranch={handleOpenRenameBranch}
          onOpenDeleteBranch={handleOpenDeleteBranch}
          onOpenCreateStash={() => setIsCreateStashOpen(true)}
          onOpenResetHard={() => setIsResetHardOpen(true)}
          onOpenSync={() => setIsSyncModalOpen(true)}
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
                  onResetToCommit={(c) => setResetTargetModal({ targetRef: c.sha, subject: c.subject })}
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
