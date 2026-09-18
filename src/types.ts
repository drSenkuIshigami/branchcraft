/**
 * Git Workbench - TypeScript Type Definitions
 * Typed contracts matching Rust models and IPC interfaces.
 */

export interface GitAvailability {
  available: boolean;
  version?: string | null;
  error?: string | null;
}

export type Theme = 'dark' | 'light';

export interface CommitInfo {
  sha: string;
  parents: string[];
  author_name: string;
  author_email: string;
  author_date: string;
  committer_name: string;
  committer_email: string;
  committer_date: string;
  subject: string;
  body: string;
  refs: string[];
}

export interface BranchInfo {
  name: string;
  is_local: boolean;
  is_remote: boolean;
  is_head: boolean;
  upstream?: string | null;
  ahead: number;
  behind: number;
  tip_sha: string;
}

export type ChangeType = 'Added' | 'Modified' | 'Deleted' | 'Renamed' | 'Copied' | 'TypeChange';

export interface FileChange {
  path: string;
  old_path?: string | null;
  change_type: ChangeType;
  is_staged: boolean;
  is_binary: boolean;
}

export interface StatusInfo {
  root_path: string;
  current_branch?: string | null;
  upstream?: string | null;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  conflicted: string[];
}

export interface CommitDetailFile {
  path: string;
  status: ChangeType;
  additions: number;
  deletions: number;
  old_path?: string | null;
}

export interface CommitStats {
  files_changed: number;
  insertions: number;
  deletions: number;
}

export interface CommitDetail {
  commit: CommitInfo;
  files: CommitDetailFile[];
  stats: CommitStats;
}

export interface FileDiff {
  path: string;
  old_content: string;
  new_content: string;
  is_binary: boolean;
  raw_diff: string;
}

export interface OperationResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
  command_run: string[];
  duration_ms: number;
}

export interface BackupRef {
  kind: string;
  identifier: string;
  created_at: string;
  reason: string;
}

export interface StashInfo {
  index: number;
  ref: string;
  hash: string;
  branch: string;
  relative_time: string;
  date: string;
  message: string;
}

export interface StashDetail {
  stash: StashInfo;
  files: CommitDetailFile[];
  stats: CommitStats;
}

export interface RemoteInfo {
  name: string;
  fetch_url?: string | null;
  push_url?: string | null;
}

export interface SyncStatus {
  has_upstream: boolean;
  upstream_name?: string | null;
  ahead: number;
  behind: number;
  current_branch?: string | null;
  remote_name?: string | null;
}

export interface SystemOpenResult {
  success: boolean;
  target: 'terminal' | 'file_manager';
  message: string;
  command_snippet?: string;
}

