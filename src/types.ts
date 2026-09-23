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

export type ConflictResolutionType = 'ours' | 'theirs' | 'mark_resolved';

export interface ConflictState {
  in_merge: boolean;
  in_rebase: boolean;
  in_cherry_pick: boolean;
  in_revert: boolean;
  conflicted_files: string[];
  cherry_pick_head?: string | null;
  cherry_pick_subject?: string | null;
  revert_head?: string | null;
  revert_subject?: string | null;
}

export interface CherryPickOptions {
  noCommit?: boolean;
  recordOrigin?: boolean;
  signoff?: boolean;
  edit?: boolean;
  mainline?: number;
}

export interface RevertOptions {
  noCommit?: boolean;
  edit?: boolean;
  signoff?: boolean;
  mainline?: number;
}

export interface DiffHunk {
  id: string;
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  content: string;
  patch: string;
}

export type RebaseAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop' | 'exec';

export interface RebaseTodoItem {
  id: string;
  sha: string;
  short_sha: string;
  author: string;
  summary: string;
  action: RebaseAction;
  exec_command?: string;
  new_message?: string;
}

export interface RebaseStatus {
  in_progress: boolean;
  current_commit?: string;
  onto_commit?: string;
  head_name?: string;
  remaining_steps?: number;
  total_steps?: number;
  done_steps?: string[];
  todo_steps?: string[];
}

export interface GitUserConfig {
  name: string;
  email: string;
}

export interface ModifyCommitAuthorDateParams {
  target_sha?: string;
  author_name?: string;
  author_email?: string;
  reset_author?: boolean;
  author_date?: string;
  committer_date?: string;
  committer_name?: string;
  committer_email?: string;
  sync_committer_date_to_author?: boolean;
  new_message?: string;
}

export type ResetMode = 'soft' | 'mixed' | 'hard';

export interface ReflogEntry {
  selector: string;
  index: number;
  sha: string;
  short_sha: string;
  action: string;
  subject: string;
  author_name: string;
  author_email: string;
  date: string;
}

export interface WorktreeInfo {
  path: string;
  head: string;
  short_head: string;
  branch: string | null;
  is_main: boolean;
  is_bare: boolean;
  is_locked: boolean;
  lock_reason?: string | null;
  is_detached: boolean;
}

export interface AddWorktreeOptions {
  path: string;
  branch?: string;
  new_branch?: string;
  commit_ish?: string;
  lock?: boolean;
  lock_reason?: string;
}


