/**
 * Git Workbench - Strongly Typed Tauri IPC Wrappers
 *
 * Every interaction between the frontend and the real Git backend is typed here.
 * Strictly respects the IPC contract defined in docs/IPC_CONTRACT.md.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  BranchInfo,
  CherryPickOptions,
  CommitDetail,
  CommitInfo,
  ConflictResolutionType,
  ConflictState,
  FileDiff,
  GitAvailability,
  GitUserConfig,
  ModifyCommitAuthorDateParams,
  OperationResult,
  RebaseAction,
  RebaseStatus,
  RebaseTodoItem,
  ReflogEntry,
  RemoteInfo,
  ResetMode,
  RevertOptions,
  StashDetail,
  StashInfo,
  StatusInfo,
  SyncStatus,
  SystemOpenResult,
  WorktreeInfo,
  AddWorktreeOptions,
  BackupRef,
  FsckResult,
  RepoAuditReport,
  MirrorCloneSetupResult,
  PurgePlanOptions,
  GitHooksStatus,
  TagInfo,
  CreateTagOptions,
  SubmoduleInfo,
  BisectStatus,
  RerereStatus,
  LfsDiagnostics,
  RangeDiffResult,
  MergeExecutionOptions,
  ForceRelocateBranchPreview,
  SearchQueryOptions,
  SearchResponse,
  ReplaceFileOptions,
  ReplaceResponse,
  CleanAITracesOptions,
  CleanAITracesResult,
  PushMode,
  CleanMode,
  CleanResult,
  GcMode,
  ClassifiedFinding,
  WorkingTreeEditPreview,
  WorkingTreeCleanupResult,
  HeadCommitAmendPreview,
  HeadCommitAmendResult,
  ConfigHookTarget,
  ConfigHookCleanupPreview,
  ConfigHookCleanupResult,
  HistoryRewriteScope,
  HistoryRewritePreview,
  HistoryRewriteResult,
  RemotePublishScope,
  RemotePublishResult,
  PostPublishChecklist,
  RewriteOperation,
} from '../types';

/**
 * Checks whether the native Tauri IPC runtime is available in the current window.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Phase 0: System check for Git executable availability
 */
export async function getGitAvailability(): Promise<GitAvailability> {
  if (isTauriEnvironment()) {
    return await invoke<GitAvailability>('get_git_availability');
  }

  try {
    const res = await fetch('/api/git-availability');
    if (res.ok) {
      return (await res.json()) as GitAvailability;
    }
  } catch {
    // ignore
  }

  return {
    available: true,
    version: 'git version 2.34.1',
    error: null,
  };
}

/**
 * Phase 1: Validates repository path and fetches initial status
 */
export async function openRepository(path: string): Promise<StatusInfo> {
  if (isTauriEnvironment()) {
    return await invoke<StatusInfo>('open_repository', { path });
  }

  const res = await fetch('/api/git/open_repository', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to open repository' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as StatusInfo;
}

/**
 * Phase 1: Queries working tree and index status
 */
export async function getStatus(repoPath: string): Promise<StatusInfo> {
  if (isTauriEnvironment()) {
    return await invoke<StatusInfo>('get_status', { repoPath });
  }

  const res = await fetch(`/api/git/status?path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get status' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as StatusInfo;
}

/**
 * Phase 1: Lists local and remote branches
 */
export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  if (isTauriEnvironment()) {
    return await invoke<BranchInfo[]>('get_branches', { repoPath });
  }

  const res = await fetch(`/api/git/branches?path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get branches' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as BranchInfo[];
}

/**
 * Phase 1: Fetches topological commit graph data
 */
export async function getCommitGraph(
  repoPath: string,
  limit = 100,
  skip = 0
): Promise<CommitInfo[]> {
  if (isTauriEnvironment()) {
    return await invoke<CommitInfo[]>('get_commit_graph', { repoPath, limit, skip });
  }

  const res = await fetch(
    `/api/git/commit_graph?path=${encodeURIComponent(repoPath)}&limit=${limit}&skip=${skip}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get commits' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as CommitInfo[];
}

/**
 * Phase 1: Fetches commit detail with changed files and statistics
 */
export async function getCommitDetail(repoPath: string, sha: string): Promise<CommitDetail> {
  if (isTauriEnvironment()) {
    return await invoke<CommitDetail>('get_commit_detail', { repoPath, sha });
  }

  const res = await fetch(
    `/api/git/commit_detail?path=${encodeURIComponent(repoPath)}&sha=${encodeURIComponent(sha)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get commit detail' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as CommitDetail;
}

/**
 * Phase 1: Fetches file diff (working tree vs HEAD or commit vs parent)
 */
export async function getFileDiff(
  repoPath: string,
  path: string,
  rev?: string | null
): Promise<FileDiff> {
  if (isTauriEnvironment()) {
    return await invoke<FileDiff>('get_file_diff', { repoPath, path, rev });
  }

  let url = `/api/git/file_diff?path=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(path)}`;
  if (rev) {
    url += `&rev=${encodeURIComponent(rev)}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get diff' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as FileDiff;
}

/**
 * Phase 1: Opens native folder picker dialog (OS dialog or browser API)
 */
export async function pickFolder(): Promise<string | null> {
  if (isTauriEnvironment()) {
    return await invoke<string | null>('pick_folder');
  }

  try {
    const res = await fetch('/api/git/pick_folder');
    if (res.ok) {
      const data = (await res.json()) as { path: string | null; cancelled: boolean; error?: string };
      if (data && data.path) {
        return data.path;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Phase 2: Stages a single file (git add -- <path>)
 */
export async function stagePath(repoPath: string, path: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('stage_path', { repoPath, path });
  }

  const res = await fetch('/api/git/stage_path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, path }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to stage path' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Unstages a single file (git restore --staged -- <path>)
 */
export async function unstagePath(repoPath: string, path: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('unstage_path', { repoPath, path });
  }

  const res = await fetch('/api/git/unstage_path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, path }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to unstage path' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Discards working tree changes (git restore -- <path> or git clean -f)
 */
export async function discardPath(
  repoPath: string,
  path: string,
  isUntracked = false
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('discard_path', { repoPath, path, isUntracked });
  }

  const res = await fetch('/api/git/discard_path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, path, is_untracked: isUntracked }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to discard changes' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Stages all working tree changes (git add -A)
 */
export async function stageAll(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('stage_all', { repoPath });
  }

  const res = await fetch('/api/git/stage_all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to stage all' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Unstages all staged changes (git restore --staged .)
 */
export async function unstageAll(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('unstage_all', { repoPath });
  }

  const res = await fetch('/api/git/unstage_all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to unstage all' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Creates a commit with the provided commit message (git commit -m <msg>)
 */
export async function createCommit(
  repoPath: string,
  message: string,
  options?: {
    authorName?: string;
    authorEmail?: string;
    authorDate?: string;
    committerDate?: string;
  }
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('create_commit', {
      repoPath,
      message,
      authorName: options?.authorName,
      authorEmail: options?.authorEmail,
      authorDate: options?.authorDate,
      committerDate: options?.committerDate,
    });
  }

  const res = await fetch('/api/git/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      message,
      author_name: options?.authorName,
      author_email: options?.authorEmail,
      author_date: options?.authorDate,
      committer_date: options?.committerDate,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create commit' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Amends the latest commit with the provided commit message (git commit --amend -m <msg>)
 */
export async function amendCommit(repoPath: string, message: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('amend_commit', { repoPath, message });
  }

  const res = await fetch('/api/git/commit_amend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to amend commit' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Creates and switches to a new branch (git switch -c <name> [<start_sha>])
 */
export async function createBranch(
  repoPath: string,
  name: string,
  startSha?: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('create_branch', { repoPath, name, startSha });
  }

  const res = await fetch('/api/git/create_branch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, name, start_sha: startSha }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create branch' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Switches to an existing branch (git switch <name>)
 */
export async function switchBranch(repoPath: string, name: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('switch_branch', { repoPath, name });
  }

  const res = await fetch('/api/git/switch_branch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to switch branch' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Renames a branch (git branch -m <old_name> <new_name>)
 */
export async function renameBranch(
  repoPath: string,
  oldName: string,
  newName: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('rename_branch', { repoPath, oldName, newName });
  }

  const res = await fetch('/api/git/rename_branch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, old_name: oldName, new_name: newName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to rename branch' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Deletes a branch (git branch -d <name> or -D if forced)
 */
export async function deleteBranch(
  repoPath: string,
  name: string,
  force = false
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('delete_branch', { repoPath, name, force });
  }

  const res = await fetch('/api/git/delete_branch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, name, force }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete branch' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Stash Operations
 */
export async function getStashes(repoPath: string): Promise<StashInfo[]> {
  if (isTauriEnvironment()) {
    return await invoke<StashInfo[]>('get_stashes', { repoPath });
  }

  const res = await fetch(`/api/git/stashes?path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch stashes' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as StashInfo[];
}

export async function getStashDetail(repoPath: string, stashRef: string): Promise<StashDetail> {
  if (isTauriEnvironment()) {
    return await invoke<StashDetail>('get_stash_detail', { repoPath, stashRef });
  }

  const res = await fetch(
    `/api/git/stash_detail?path=${encodeURIComponent(repoPath)}&stash_ref=${encodeURIComponent(stashRef)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch stash details' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as StashDetail;
}

export async function createStash(
  repoPath: string,
  message?: string,
  includeUntracked = false,
  keepIndex = false
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('create_stash', {
      repoPath,
      message,
      includeUntracked,
      keepIndex,
    });
  }

  const res = await fetch('/api/git/stash_push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      message,
      include_untracked: includeUntracked,
      keep_index: keepIndex,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create stash' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function applyStash(
  repoPath: string,
  stashRef: string,
  reinstateIndex = false
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('apply_stash', {
      repoPath,
      stashRef,
      reinstateIndex,
    });
  }

  const res = await fetch('/api/git/stash_apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      stash_ref: stashRef,
      reinstate_index: reinstateIndex,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to apply stash' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function popStash(
  repoPath: string,
  stashRef: string,
  reinstateIndex = false
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('pop_stash', {
      repoPath,
      stashRef,
      reinstateIndex,
    });
  }

  const res = await fetch('/api/git/stash_pop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      stash_ref: stashRef,
      reinstate_index: reinstateIndex,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to pop stash' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function dropStash(repoPath: string, stashRef: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('drop_stash', { repoPath, stashRef });
  }

  const res = await fetch('/api/git/stash_drop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, stash_ref: stashRef }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to drop stash' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function clearStashes(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('clear_stashes', { repoPath });
  }

  const res = await fetch('/api/git/stash_clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to clear stashes' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function branchFromStash(
  repoPath: string,
  branchName: string,
  stashRef: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('branch_from_stash', {
      repoPath,
      branchName,
      stashRef,
    });
  }

  const res = await fetch('/api/git/stash_branch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      branch_name: branchName,
      stash_ref: stashRef,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to branch from stash' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function resetHard(repoPath: string, createBackup = true): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('reset_hard', { repoPath, createBackup });
  }

  const res = await fetch('/api/git/reset_hard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, create_backup: createBackup }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to reset working tree' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function getRemotes(repoPath: string): Promise<RemoteInfo[]> {
  if (isTauriEnvironment()) {
    return await invoke<RemoteInfo[]>('get_remotes', { repoPath });
  }

  const res = await fetch(`/api/git/remotes?path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get remotes' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as RemoteInfo[];
}

export async function getSyncStatus(repoPath: string): Promise<SyncStatus> {
  if (isTauriEnvironment()) {
    return await invoke<SyncStatus>('get_sync_status', { repoPath });
  }

  const res = await fetch(`/api/git/sync_status?path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get sync status' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as SyncStatus;
}

export async function gitFetch(
  repoPath: string,
  remote = 'origin',
  prune = true
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('fetch', { repoPath, remote, prune });
  }

  const res = await fetch('/api/git/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, remote, prune }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function gitPull(
  repoPath: string,
  remote = 'origin',
  branch?: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('pull', { repoPath, remote, branch });
  }

  const res = await fetch('/api/git/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, remote, branch }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to pull' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function gitPush(
  repoPath: string,
  remote = 'origin',
  branch?: string,
  forceWithLease = false,
  setUpstream = false,
  mode?: PushMode
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('push', {
      repoPath,
      remote,
      branch,
      forceWithLease,
      setUpstream,
      mode,
    });
  }

  const res = await fetch('/api/git/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      remote,
      branch,
      force_with_lease: forceWithLease,
      set_upstream: setUpstream,
      mode,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to push' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function deleteRemoteRef(
  repoPath: string,
  remote = 'origin',
  refType: 'branch' | 'tag',
  refName: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('delete_remote_ref', {
      repoPath,
      remote,
      refType,
      refName,
    });
  }

  const res = await fetch('/api/git/delete_remote_ref', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      remote,
      ref_type: refType,
      ref_name: refName,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete remote reference' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function cleanWorkingTree(
  repoPath: string,
  mode: CleanMode = 'fd',
  dryRun = false,
  targetPath?: string
): Promise<CleanResult> {
  if (isTauriEnvironment()) {
    return await invoke<CleanResult>('clean_working_tree', {
      repoPath,
      mode,
      dryRun,
      targetPath,
    });
  }

  const res = await fetch('/api/git/clean', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      mode,
      dry_run: dryRun,
      target_path: targetPath,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to clean working tree' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as CleanResult;
}

export async function runGitGC(
  repoPath: string,
  mode: GcMode = 'standard'
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('run_git_gc', { repoPath, mode });
  }

  const res = await fetch('/api/git/gc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      mode,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to run garbage collection' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Restores a file from a historical commit into the working tree and index
 * (git checkout <sha> -- <filePath>)
 */
export async function restoreFileFromCommit(
  repoPath: string,
  sha: string,
  filePath: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('restore_from_commit', {
      repoPath,
      sha,
      filePath,
    });
  }

  const res = await fetch('/api/git/restore_from_commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      sha,
      file_path: filePath,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to restore file from commit' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Opens system terminal or native file explorer at repository root
 */
export async function openSystemLocation(
  repoPath: string,
  target: 'terminal' | 'file_manager'
): Promise<SystemOpenResult> {
  if (isTauriEnvironment()) {
    return await invoke<SystemOpenResult>('open_system', { repoPath, target });
  }

  const res = await fetch('/api/git/open_system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      target,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to open system location' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as SystemOpenResult;
}

/**
 * Testing & Evaluation Helper:
 * Prepares and opens an isolated realistic sandbox Git repo with branches and changes
 */
export async function openSampleRepository(): Promise<{ path: string; status: StatusInfo }> {
  const res = await fetch('/api/git/sample_repo', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create sample repository' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as { path: string; status: StatusInfo };
}

/**
 * Phase 2: Stage a specific unified diff hunk via git apply --cached
 */
export async function stageHunk(repoPath: string, patch: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('stage_hunk', { repoPath, patch });
  }

  const res = await fetch('/api/git/hunk/stage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, patch }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to stage hunk' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Unstage a specific unified diff hunk via git apply --cached --reverse
 */
export async function unstageHunk(repoPath: string, patch: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('unstage_hunk', { repoPath, patch });
  }

  const res = await fetch('/api/git/hunk/unstage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, patch }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to unstage hunk' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Discard a specific unified diff hunk via git apply --reverse
 */
export async function discardHunk(repoPath: string, patch: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('discard_hunk', { repoPath, patch });
  }

  const res = await fetch('/api/git/hunk/discard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, patch }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to discard hunk' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Queries merge/rebase conflict status and unmerged files
 */
export async function getConflictState(repoPath: string): Promise<ConflictState> {
  if (isTauriEnvironment()) {
    return await invoke<ConflictState>('get_conflict_state', { repoPath });
  }

  const res = await fetch(`/api/git/conflict/state?repo_path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get conflict state' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as ConflictState;
}

/**
 * Phase 2: Resolves a conflicted file by choosing ours, theirs, or marking as resolved
 */
export async function resolveConflict(
  repoPath: string,
  filePath: string,
  resolution: ConflictResolutionType
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('resolve_conflict', { repoPath, filePath, resolution });
  }

  const res = await fetch('/api/git/conflict/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      file_path: filePath,
      resolution,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to resolve conflict' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Launches configured external mergetool (git mergetool)
 */
export async function launchMergetool(
  repoPath: string,
  filePath?: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('launch_mergetool', { repoPath, filePath });
  }

  const res = await fetch('/api/git/conflict/mergetool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      file_path: filePath,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to launch mergetool' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Continues active merge/rebase operation
 */
export async function continueConflictOperation(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('continue_conflict_operation', { repoPath });
  }

  const res = await fetch('/api/git/conflict/continue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to continue operation' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2: Aborts active merge/rebase operation safely
 */
export async function abortConflictOperation(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('abort_conflict_operation', { repoPath });
  }

  const res = await fetch('/api/git/conflict/abort', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to abort operation' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 2 Demo: Intentionally triggers a merge conflict in sandbox repo
 */
export async function createDemoConflict(repoPath: string): Promise<OperationResult> {
  const res = await fetch('/api/git/conflict/create_demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create demo conflict' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 1: Fetches commits between baseSha and HEAD for interactive rebase plan
 */
export async function getRebaseCandidates(
  repoPath: string,
  baseSha: string,
  isRoot?: boolean
): Promise<RebaseTodoItem[]> {
  if (isTauriEnvironment()) {
    return await invoke<RebaseTodoItem[]>('get_rebase_candidates', { repoPath, baseSha, isRoot });
  }

  const rootParam = isRoot || baseSha === '--root' ? '&is_root=true' : '';
  const res = await fetch(
    `/api/git/rebase/candidates?repo_path=${encodeURIComponent(repoPath)}&base_sha=${encodeURIComponent(baseSha)}${rootParam}`
  );
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: 'Failed to fetch rebase candidate commits' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as RebaseTodoItem[];
}

/**
 * Phase 3 Step 1: Queries active rebase status including paused commit, onto commit, and todo items
 */
export async function getDetailedRebaseStatus(repoPath: string): Promise<RebaseStatus> {
  if (isTauriEnvironment()) {
    return await invoke<RebaseStatus>('get_detailed_rebase_status', { repoPath });
  }

  const res = await fetch(`/api/git/rebase/status?repo_path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get rebase status' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as RebaseStatus;
}

/**
 * Phase 3 Step 1: Launches interactive rebase execution with ordered todo items
 */
export async function executeInteractiveRebase(
  repoPath: string,
  baseSha: string,
  items: RebaseTodoItem[],
  isRoot?: boolean
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('execute_interactive_rebase', {
      repoPath,
      baseSha,
      items,
      isRoot,
    });
  }

  const res = await fetch('/api/git/rebase/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      base_sha: baseSha,
      items,
      is_root: Boolean(isRoot || baseSha === '--root'),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to execute interactive rebase' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 1: Skips the currently paused/conflicted commit during active rebase
 */
export async function rebaseSkip(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('rebase_skip', { repoPath });
  }

  const res = await fetch('/api/git/rebase/skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to skip rebase commit' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 2: Fetch Git user config (name & email)
 */
export async function getGitUserConfig(repoPath: string): Promise<GitUserConfig> {
  if (isTauriEnvironment()) {
    return await invoke<GitUserConfig>('get_git_user_config', { repoPath });
  }

  const res = await fetch(`/api/git/config/user?repo_path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch git user config' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as GitUserConfig;
}

/**
 * Phase 3 Step 2: Modifies commit author, author date, committer date, and message
 */
export async function modifyCommitAuthorDate(
  repoPath: string,
  params: ModifyCommitAuthorDateParams
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('modify_commit_author_date', { repoPath, ...params });
  }

  const res = await fetch('/api/git/commit/modify_author_date', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      ...params,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to modify commit author / date' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 3: Cherry-Pick a commit with optional flags
 */
export async function cherryPickCommit(
  repoPath: string,
  sha: string,
  options?: CherryPickOptions
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('cherry_pick_commit', { repoPath, sha, options });
  }

  const res = await fetch('/api/git/cherry_pick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      sha,
      options,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to cherry-pick commit' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 3: Continue cherry-pick operation after conflicts resolved
 */
export async function cherryPickContinue(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('cherry_pick_continue', { repoPath });
  }

  const res = await fetch('/api/git/cherry_pick/continue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to continue cherry-pick' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 3: Skip current cherry-pick commit
 */
export async function cherryPickSkip(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('cherry_pick_skip', { repoPath });
  }

  const res = await fetch('/api/git/cherry_pick/skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to skip cherry-pick' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 3: Abort active cherry-pick operation
 */
export async function cherryPickAbort(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('cherry_pick_abort', { repoPath });
  }

  const res = await fetch('/api/git/cherry_pick/abort', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to abort cherry-pick' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 3: Create intentional cherry-pick conflict for testing & demonstration
 */
export async function createDemoCherryPickConflict(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('create_demo_cherry_pick_conflict', { repoPath });
  }

  const res = await fetch('/api/git/cherry_pick/create_demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: 'Failed to create demo cherry-pick conflict' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 4: Revert a commit with optional mainline parent selection & flags
 */
export async function revertCommit(
  repoPath: string,
  sha: string,
  options?: RevertOptions
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('revert_commit', { repoPath, sha, options });
  }

  const res = await fetch('/api/git/revert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      sha,
      options,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to revert commit' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 4: Continue revert operation after conflicts resolved
 */
export async function revertContinue(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('revert_continue', { repoPath });
  }

  const res = await fetch('/api/git/revert/continue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to continue revert' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 4: Skip current revert commit
 */
export async function revertSkip(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('revert_skip', { repoPath });
  }

  const res = await fetch('/api/git/revert/skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to skip revert' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 4: Abort active revert operation
 */
export async function revertAbort(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('revert_abort', { repoPath });
  }

  const res = await fetch('/api/git/revert/abort', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to abort revert' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 4: Create intentional revert conflict for testing & demonstration
 */
export async function createDemoRevertConflict(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('create_demo_revert_conflict', { repoPath });
  }

  const res = await fetch('/api/git/revert/create_demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create demo revert conflict' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 5: Get Reflog entries for emergency recovery & audit
 */
export async function getReflog(repoPath: string, limit = 100): Promise<ReflogEntry[]> {
  if (isTauriEnvironment()) {
    return await invoke<ReflogEntry[]>('get_reflog', { repoPath, limit });
  }

  const res = await fetch('/api/git/reflog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, limit }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to query reflog' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as ReflogEntry[];
}

/**
 * Phase 3 Step 5: Reset HEAD to a target reference (reflog selector, SHA, or branch)
 * Follows Level 3 Safety Policy: when mode is 'hard', creates an automatic backup branch.
 */
export async function resetToTarget(
  repoPath: string,
  target: string,
  mode: ResetMode = 'mixed',
  createBackup = true
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('reset_to_target', { repoPath, target, mode, createBackup });
  }

  const res = await fetch('/api/git/reflog/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, target, mode, create_backup: createBackup }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to reset HEAD' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Step 6: Git Worktrees Management
 */
export async function getWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  if (isTauriEnvironment()) {
    return await invoke<WorktreeInfo[]>('get_worktrees', { repoPath });
  }

  const res = await fetch('/api/git/worktrees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch worktrees' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as WorktreeInfo[];
}

export async function addWorktree(
  repoPath: string,
  options: AddWorktreeOptions
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('add_worktree', { repoPath, options });
  }

  const res = await fetch('/api/git/worktrees/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, ...options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to add worktree' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force = false
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('remove_worktree', { repoPath, worktreePath, force });
  }

  const res = await fetch('/api/git/worktrees/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, worktree_path: worktreePath, force }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to remove worktree' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function lockWorktree(
  repoPath: string,
  worktreePath: string,
  reason?: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('lock_worktree', { repoPath, worktreePath, reason });
  }

  const res = await fetch('/api/git/worktrees/lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, worktree_path: worktreePath, reason }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to lock worktree' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function unlockWorktree(
  repoPath: string,
  worktreePath: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('unlock_worktree', { repoPath, worktreePath });
  }

  const res = await fetch('/api/git/worktrees/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, worktree_path: worktreePath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to unlock worktree' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function pruneWorktrees(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('prune_worktrees', { repoPath });
  }

  const res = await fetch('/api/git/worktrees/prune', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to prune worktrees' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

// =========================================================================
// PHASE 4: Automated Backups, Integrity (Fsck), Audit & History Purging
// =========================================================================

/**
 * Creates an automatic safety backup before risky operations (Level 2/3/4).
 */
export async function createBackup(
  repoPath: string,
  reason: string,
  kind: 'branch' | 'bundle' = 'branch'
): Promise<BackupRef> {
  if (isTauriEnvironment()) {
    return await invoke<BackupRef>('create_backup', { repoPath, reason, kind });
  }

  const res = await fetch('/api/git/backups/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, reason, kind }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create backup' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as BackupRef;
}

/**
 * Lists existing backup branches and bundle files recorded for this repository.
 */
export async function getBackups(repoPath: string): Promise<BackupRef[]> {
  if (isTauriEnvironment()) {
    return await invoke<BackupRef[]>('get_backups', { repoPath });
  }

  const res = await fetch('/api/git/backups/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get backups' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as BackupRef[];
}

/**
 * Runs git fsck --full on the repository to verify object store integrity.
 */
export async function runGitFsck(repoPath: string): Promise<FsckResult> {
  if (isTauriEnvironment()) {
    return await invoke<FsckResult>('run_git_fsck', { repoPath });
  }

  const res = await fetch('/api/git/fsck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to run git fsck' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as FsckResult;
}

/**
 * Scans repository history for secrets, large files, and AI trace metadata.
 */
export async function auditRepositoryHistory(
  repoPath: string,
  limit = 100
): Promise<RepoAuditReport> {
  if (isTauriEnvironment()) {
    return await invoke<RepoAuditReport>('audit_repository_history', { repoPath, limit });
  }

  const res = await fetch('/api/git/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, limit }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to audit repository history' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as RepoAuditReport;
}

/**
 * Sets up an isolated mirror clone for safe Level 4 history rewrites.
 */
export async function setupIsolatedMirrorClone(
  sourceRepoPath: string
): Promise<MirrorCloneSetupResult> {
  if (isTauriEnvironment()) {
    return await invoke<MirrorCloneSetupResult>('setup_isolated_mirror_clone', { sourceRepoPath });
  }

  const res = await fetch('/api/git/purge/setup-mirror', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: sourceRepoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to set up mirror clone' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as MirrorCloneSetupResult;
}

/**
 * Executes the history purge plan inside the isolated mirror repository.
 */
export async function executeHistoryPurge(
  mirrorPath: string,
  options: PurgePlanOptions
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('execute_history_purge', { mirrorPath, options });
  }

  const res = await fetch('/api/git/purge/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mirror_path: mirrorPath, options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to execute history purge' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Pushes the verified mirror repository back to remote origin.
 */
export async function pushMirrorToRemote(
  mirrorPath: string,
  remoteUrl: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('push_mirror_to_remote', { mirrorPath, remoteUrl });
  }

  const res = await fetch('/api/git/purge/push-remote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mirror_path: mirrorPath, remote_url: remoteUrl }),
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: 'Failed to push mirror repository to remote' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 4 Additional Hardening:
 * Standalone manual execution of `git gc --prune=now --aggressive`.
 * As specified in SAFETY_POLICY.md:
 * Must never run automatically inside any wizard or cleanup loop.
 * It is always an independent, explicitly labeled action warning that unreferenced commits become unrecoverable.
 */
export async function runManualAggressiveGC(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('run_manual_aggressive_gc', { repoPath });
  }

  const res = await fetch('/api/git/maintenance/gc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to run git gc' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 4 Additional Hardening:
 * Fetches current configuration and installation status of local hooks and .gitignore AI directory rules.
 */
export async function getGitHooksStatus(repoPath: string): Promise<GitHooksStatus> {
  if (isTauriEnvironment()) {
    return await invoke<GitHooksStatus>('get_git_hooks_status', { repoPath });
  }

  const res = await fetch('/api/git/hooks/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get git hooks status' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as GitHooksStatus;
}

/**
 * Phase 4: Installs a local defense-in-depth commit-msg hook that automatically strips
 * or rejects unwanted AI attribution trailers (e.g. Co-authored-by: Claude, Claude-Session).
 */
export async function installCommitMsgHook(
  repoPath: string,
  mode: 'strip' | 'reject' = 'strip'
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('install_commit_msg_hook', { repoPath, mode });
  }

  const res = await fetch('/api/git/hooks/install-commit-msg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, mode }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to install commit-msg hook' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 4: Installs a local pre-commit hook that scans staged files for uncommitted secrets
 * and flags large files (> 500 KB) with a Git LFS recommendation.
 */
export async function installPreCommitHook(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('install_pre_commit_hook', { repoPath });
  }

  const res = await fetch('/api/git/hooks/install-pre-commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to install pre-commit hook' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 4: Adds common AI development directories (.cursor, .claude, etc.) to .gitignore.
 */
export async function updateGitignoreAIDirectories(repoPath: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('update_gitignore_ai_directories', { repoPath });
  }

  const res = await fetch('/api/git/gitignore/add-ai-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update .gitignore' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

/**
 * Phase 3 Power Tools Extensions: Tags, Submodules, Bisect, Rerere, and LFS
 */

export async function getTags(repoPath: string): Promise<TagInfo[]> {
  if (isTauriEnvironment()) {
    return await invoke<TagInfo[]>('get_tags', { repoPath });
  }

  const res = await fetch(`/api/git/tags?repo_path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) return [];
  return (await res.json()) as TagInfo[];
}

export async function createTag(
  repoPath: string,
  options: CreateTagOptions
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('create_tag', { repoPath, options });
  }

  const res = await fetch('/api/git/tags/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, ...options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create tag' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function deleteTag(repoPath: string, tagName: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('delete_tag', { repoPath, tagName });
  }

  const res = await fetch('/api/git/tags/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, tag_name: tagName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete tag' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function getSubmodules(repoPath: string): Promise<SubmoduleInfo[]> {
  if (isTauriEnvironment()) {
    return await invoke<SubmoduleInfo[]>('get_submodules', { repoPath });
  }

  const res = await fetch(`/api/git/submodules?repo_path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) return [];
  return (await res.json()) as SubmoduleInfo[];
}

export async function updateSubmodules(
  repoPath: string,
  recursive = true
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('update_submodules', { repoPath, recursive });
  }

  const res = await fetch('/api/git/submodules/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, recursive }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update submodules' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function getBisectStatus(repoPath: string): Promise<BisectStatus> {
  if (isTauriEnvironment()) {
    return await invoke<BisectStatus>('get_bisect_status', { repoPath });
  }

  const res = await fetch(`/api/git/bisect/status?repo_path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) return { in_bisect: false };
  return (await res.json()) as BisectStatus;
}

export async function runBisectCommand(
  repoPath: string,
  action: 'start' | 'good' | 'bad' | 'reset' | 'skip',
  commitSha?: string
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('run_bisect_command', { repoPath, action, commitSha });
  }

  const res = await fetch('/api/git/bisect/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, action, commit_sha: commitSha }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to execute bisect command' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function getRerereStatus(repoPath: string): Promise<RerereStatus> {
  if (isTauriEnvironment()) {
    return await invoke<RerereStatus>('get_rerere_status', { repoPath });
  }

  const res = await fetch(`/api/git/rerere/status?repo_path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) return { enabled: false, resolved_recorded: 0 };
  return (await res.json()) as RerereStatus;
}

export async function toggleRerere(repoPath: string, enable: boolean): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('toggle_rerere', { repoPath, enable });
  }

  const res = await fetch('/api/git/rerere/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, enable }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update rerere' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function getLfsDiagnostics(repoPath: string): Promise<LfsDiagnostics> {
  if (isTauriEnvironment()) {
    return await invoke<LfsDiagnostics>('get_lfs_diagnostics', { repoPath });
  }

  const res = await fetch(`/api/git/lfs/diagnostics?repo_path=${encodeURIComponent(repoPath)}`);
  if (!res.ok) return { is_installed: false, tracked_patterns: [], locked_files: [] };
  return (await res.json()) as LfsDiagnostics;
}

export async function getRangeDiff(
  repoPath: string,
  baseSha: string,
  oldSha: string,
  newSha: string,
  creationFactor?: number
): Promise<RangeDiffResult> {
  if (isTauriEnvironment()) {
    return await invoke<RangeDiffResult>('get_range_diff', {
      repoPath,
      baseSha,
      oldSha,
      newSha,
      creationFactor,
    });
  }

  const params = new URLSearchParams({
    repo_path: repoPath,
    base_sha: baseSha,
    old_sha: oldSha,
    new_sha: newSha,
  });
  if (creationFactor !== undefined) {
    params.set('creation_factor', String(creationFactor));
  }
  const res = await fetch(`/api/git/range_diff?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to get range-diff`);
  return (await res.json()) as RangeDiffResult;
}

export async function mergeWithOptions(
  repoPath: string,
  options: MergeExecutionOptions
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('merge_with_options', { repoPath, options });
  }

  const res = await fetch('/api/git/merge_with_options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      branch_name: options.branchName,
      strategy: options.strategy,
      message: options.message,
      fast_forward: options.fastForward,
      squash: options.squash,
      no_commit: options.noCommit,
      allow_unrelated_histories: options.allowUnrelatedHistories,
      autostash: options.autostash,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Merge failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function previewForceRelocateBranch(
  repoPath: string,
  branchName: string,
  newSha: string
): Promise<ForceRelocateBranchPreview> {
  if (isTauriEnvironment()) {
    return await invoke<ForceRelocateBranchPreview>('preview_force_relocate_branch', {
      repoPath,
      branchName,
      newSha,
    });
  }

  const res = await fetch('/api/git/branch_force_relocate/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, branch_name: branchName, new_sha: newSha }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Preview failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as ForceRelocateBranchPreview;
}

export async function executeForceRelocateBranch(
  repoPath: string,
  branchName: string,
  newSha: string,
  createBackup = true
): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('execute_force_relocate_branch', {
      repoPath,
      branchName,
      newSha,
      createBackup,
    });
  }

  const res = await fetch('/api/git/branch_force_relocate/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      branch_name: branchName,
      new_sha: newSha,
      create_backup: createBackup,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Relocate failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as OperationResult;
}

export async function searchRepository(
  repoPath: string,
  options: SearchQueryOptions
): Promise<SearchResponse> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<SearchResponse>('search_repository', { repoPath, options });
    } catch {
      // fallback to http if not in rust command table
    }
  }

  const res = await fetch('/api/git/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath, options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as SearchResponse;
}

export async function replaceInFiles(
  repoPath: string,
  options: ReplaceFileOptions
): Promise<ReplaceResponse> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<ReplaceResponse>('replace_in_files', { repoPath, options });
    } catch {
      // fallback to http
    }
  }

  const res = await fetch('/api/git/replace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath, options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Replace failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as ReplaceResponse;
}

export async function cleanAITraces(
  repoPath: string,
  options: CleanAITracesOptions
): Promise<CleanAITracesResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<CleanAITracesResult>('clean_ai_traces', { repoPath, options });
    } catch {
      // fallback to http
    }
  }

  const res = await fetch('/api/git/clean_ai_traces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath, options }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Clean AI traces failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return (await res.json()) as CleanAITracesResult;
}

// =========================================================================
// AI Artefact Cleanup & Controlled History Rewrite IPC Commands
// =========================================================================

export async function getCleanupEligibility(
  repoPath: string,
  findings: any[]
): Promise<ClassifiedFinding[]> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<ClassifiedFinding[]>('get_cleanup_eligibility', { repoPath, findings });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/eligibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, findings }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Eligibility check failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as ClassifiedFinding[];
}

export async function buildWorkingTreeCleanupPreview(
  repoPath: string,
  selectedFindingIds: string[]
): Promise<WorkingTreeEditPreview[]> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<WorkingTreeEditPreview[]>('build_working_tree_cleanup_preview', {
        repoPath,
        selectedFindingIds,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/working_tree/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, selected_finding_ids: selectedFindingIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Preview failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as WorkingTreeEditPreview[];
}

export async function applyWorkingTreeCleanup(
  repoPath: string,
  selectedFindingIds: string[],
  confirmationToken: string
): Promise<WorkingTreeCleanupResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<WorkingTreeCleanupResult>('apply_working_tree_cleanup', {
        repoPath,
        selectedFindingIds,
        confirmationToken,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/working_tree/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      selected_finding_ids: selectedFindingIds,
      confirmation_token: confirmationToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Working tree cleanup failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as WorkingTreeCleanupResult;
}

export async function undoWorkingTreeCleanup(
  repoPath: string,
  operationId: string
): Promise<WorkingTreeCleanupResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<WorkingTreeCleanupResult>('undo_working_tree_cleanup', {
        repoPath,
        operationId,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/working_tree/undo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Undo cleanup failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as WorkingTreeCleanupResult;
}

export async function buildHeadCommitCleanupPreview(
  repoPath: string,
  selectedFindingIds: string[]
): Promise<HeadCommitAmendPreview> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<HeadCommitAmendPreview>('build_head_commit_cleanup_preview', {
        repoPath,
        selectedFindingIds,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/head/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, selected_finding_ids: selectedFindingIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'HEAD preview failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as HeadCommitAmendPreview;
}

export async function amendHeadCommitCleanup(
  repoPath: string,
  selectedFindingIds: string[],
  confirmationToken: string
): Promise<HeadCommitAmendResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<HeadCommitAmendResult>('amend_head_commit_cleanup', {
        repoPath,
        selectedFindingIds,
        confirmationToken,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/head/amend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      selected_finding_ids: selectedFindingIds,
      confirmation_token: confirmationToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Amend HEAD failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as HeadCommitAmendResult;
}

export async function getConfigHookCleanupPreview(
  repoPath: string,
  targets: ConfigHookTarget[]
): Promise<ConfigHookCleanupPreview> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<ConfigHookCleanupPreview>('get_config_hook_cleanup_preview', {
        repoPath,
        targets,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/config_hooks/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, targets }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Config preview failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as ConfigHookCleanupPreview;
}

export async function applyConfigHookCleanup(
  repoPath: string,
  targets: ConfigHookTarget[],
  confirmationToken: string
): Promise<ConfigHookCleanupResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<ConfigHookCleanupResult>('apply_config_hook_cleanup', {
        repoPath,
        targets,
        confirmationToken,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/config_hooks/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, targets, confirmation_token: confirmationToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Config cleanup failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as ConfigHookCleanupResult;
}

export async function restoreConfigHookBackup(
  repoPath: string,
  backupId: string
): Promise<ConfigHookCleanupResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<ConfigHookCleanupResult>('restore_config_hook_backup', {
        repoPath,
        backupId,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/config_hooks/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, backup_id: backupId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Restore backup failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as ConfigHookCleanupResult;
}

export async function buildHistoryRewriteScope(
  repoPath: string,
  selectedFindingIds: string[],
  selectedRefs: string[]
): Promise<HistoryRewriteScope> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<HistoryRewriteScope>('build_history_rewrite_scope', {
        repoPath,
        selectedFindingIds,
        selectedRefs,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/history/scope', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      selected_finding_ids: selectedFindingIds,
      selected_refs: selectedRefs,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to build rewrite scope' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as HistoryRewriteScope;
}

export async function acknowledgeHistoryRewrite(
  repoPath: string,
  operationId: string,
  checkboxState: {
    understand_new_shas: boolean;
    understand_signature_loss: boolean;
    understand_collaborator_impact: boolean;
    understand_external_copies: boolean;
    reviewed_scope: boolean;
  },
  typedPhrase: string
): Promise<{ success: boolean; error?: string }> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<{ success: boolean; error?: string }>('acknowledge_history_rewrite', {
        repoPath,
        operationId,
        checkboxState,
        typedPhrase,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/history/acknowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      operation_id: operationId,
      checkbox_state: checkboxState,
      typed_phrase: typedPhrase,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Acknowledgement failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as { success: boolean; error?: string };
}

export async function createIsolatedRewriteWorkspace(
  repoPath: string,
  operationId: string
): Promise<RewriteOperation> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<RewriteOperation>('create_isolated_rewrite_workspace', {
        repoPath,
        operationId,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/history/create_workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Workspace creation failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as RewriteOperation;
}

export async function createRewriteBackup(
  repoPath: string,
  operationId: string
): Promise<RewriteOperation> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<RewriteOperation>('create_rewrite_backup', { repoPath, operationId });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/history/create_backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Backup creation failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as RewriteOperation;
}

export async function verifyRewriteBackup(
  repoPath: string,
  operationId: string
): Promise<RewriteOperation> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<RewriteOperation>('verify_rewrite_backup', { repoPath, operationId });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/history/verify_backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Backup verification failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as RewriteOperation;
}

export async function buildHistoryRewritePreview(
  repoPath: string,
  operationId: string
): Promise<HistoryRewritePreview> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<HistoryRewritePreview>('build_history_rewrite_preview', {
        repoPath,
        operationId,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/history/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Preview failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as HistoryRewritePreview;
}

export async function applyHistoryRewrite(
  repoPath: string,
  operationId: string
): Promise<HistoryRewriteResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<HistoryRewriteResult>('apply_history_rewrite', { repoPath, operationId });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/history/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Rewrite execution failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as HistoryRewriteResult;
}

export async function validateHistoryRewrite(
  repoPath: string,
  operationId: string
): Promise<HistoryRewriteResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<HistoryRewriteResult>('validate_history_rewrite', {
        repoPath,
        operationId,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/history/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Validation failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as HistoryRewriteResult;
}

export async function getHistoryRewriteResult(
  repoPath: string,
  operationId: string
): Promise<HistoryRewriteResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<HistoryRewriteResult>('get_history_rewrite_result', {
        repoPath,
        operationId,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/history/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to get rewrite result' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as HistoryRewriteResult;
}

export async function buildRemotePublishScope(
  repoPath: string,
  operationId: string,
  selectedRemote: string,
  selectedPushStrategy: 'selected_branch_force_with_lease' | 'mirror_update'
): Promise<RemotePublishScope> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<RemotePublishScope>('build_remote_publish_scope', {
        repoPath,
        operationId,
        selectedRemote,
        selectedPushStrategy,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/publish/scope', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      operation_id: operationId,
      selected_remote: selectedRemote,
      selected_push_strategy: selectedPushStrategy,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Publish scope failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as RemotePublishScope;
}

export async function acknowledgeRemotePublish(
  repoPath: string,
  operationId: string,
  checkboxState: {
    verified_remote_url: boolean;
    reviewed_refs: boolean;
    notify_collaborators: boolean;
    understand_old_clones: boolean;
    secret_rotation_acknowledged: boolean;
    cannot_remove_external: boolean;
  },
  typedPhrase: string
): Promise<{ success: boolean; error?: string }> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<{ success: boolean; error?: string }>('acknowledge_remote_publish', {
        repoPath,
        operationId,
        checkboxState,
        typedPhrase,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/publish/acknowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_path: repoPath,
      operation_id: operationId,
      checkbox_state: checkboxState,
      typed_phrase: typedPhrase,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Acknowledgement failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as { success: boolean; error?: string };
}

export async function publishRewrittenHistory(
  repoPath: string,
  operationId: string
): Promise<RemotePublishResult> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<RemotePublishResult>('publish_rewritten_history', {
        repoPath,
        operationId,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/publish/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Publish execution failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as RemotePublishResult;
}

export async function getPostPublishChecklist(
  repoPath: string,
  operationId: string
): Promise<PostPublishChecklist> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<PostPublishChecklist>('get_post_publish_checklist', {
        repoPath,
        operationId,
      });
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/publish/checklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Checklist failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as PostPublishChecklist;
}

export async function exportPostPublishChecklist(
  repoPath: string,
  operationId: string
): Promise<{ export_path: string; markdown: string }> {
  if (isTauriEnvironment()) {
    try {
      return await invoke<{ export_path: string; markdown: string }>(
        'export_post_publish_checklist',
        { repoPath, operationId }
      );
    } catch {
      // fallback to http
    }
  }
  const res = await fetch('/api/git/ai_cleanup/publish/checklist/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, operation_id: operationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as { export_path: string; markdown: string };
}




