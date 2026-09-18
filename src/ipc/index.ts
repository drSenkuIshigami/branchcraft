/**
 * Git Workbench - Strongly Typed Tauri IPC Wrappers
 *
 * Every interaction between the frontend and the real Git backend is typed here.
 * Strictly respects the IPC contract defined in docs/IPC_CONTRACT.md.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  BranchInfo,
  CommitDetail,
  CommitInfo,
  FileDiff,
  GitAvailability,
  OperationResult,
  StatusInfo,
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
 * Phase 1: Opens native folder picker dialog
 */
export async function pickFolder(): Promise<string | null> {
  if (isTauriEnvironment()) {
    return await invoke<string | null>('pick_folder');
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
export async function createCommit(repoPath: string, message: string): Promise<OperationResult> {
  if (isTauriEnvironment()) {
    return await invoke<OperationResult>('create_commit', { repoPath, message });
  }

  const res = await fetch('/api/git/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, message }),
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
