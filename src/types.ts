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

// Phase 4: Automated Safety, Backups, History Purging & Repository Health

export type RiskLevel = 0 | 1 | 2 | 3 | 4;

export interface BackupRef {
  id: string;
  kind: 'branch' | 'tag' | 'bundle';
  identifier: string; // e.g. "backup/pre-purge-20260923-143000" or file path
  created_at: string;
  reason: string;
  sha?: string;
  file_size?: number;
}

export interface SecretFinding {
  rule_id: string;
  rule_name: string;
  file_path: string;
  commit_sha: string;
  commit_subject: string;
  author: string;
  date: string;
  line_number?: number;
  match_preview: string; // Redacted match preview
  entropy?: number;
  severity: 'high' | 'critical' | 'medium' | 'low';
}

export interface LargeFileFinding {
  path: string;
  oid: string;
  size_bytes: number;
  formatted_size: string;
  commit_sha: string;
  commit_subject: string;
  author: string;
  date: string;
}

export interface AITraceFinding {
  type: 'trailer' | 'metadata' | 'file_marker';
  marker: string; // e.g., 'Co-authored-by: Claude', 'Generated-by: Cursor', '.cursorrules'
  file_path?: string;
  commit_sha?: string;
  commit_subject?: string;
  date?: string;
  details: string;
}

export interface RepoAuditReport {
  scanned_at: string;
  total_commits_scanned: number;
  secrets: SecretFinding[];
  large_files: LargeFileFinding[];
  ai_traces: AITraceFinding[];
  duration_ms: number;
}

export interface PurgePlanOptions {
  paths_to_remove?: string[];
  patterns_to_remove?: string[];
  secrets_to_scrub?: string[]; // strings or regex patterns to replace/remove
  remove_ai_trailers?: boolean;
  rewrite_authors?: {
    from_email?: string;
    from_name?: string;
    to_name: string;
    to_email: string;
  }[];
}

export interface MirrorCloneSetupResult {
  source_repo_path: string;
  mirror_path: string;
  bundle_backup_path: string;
  backup_ref: BackupRef;
  remote_url?: string;
}

export interface FsckResult {
  is_healthy: boolean;
  errors: string[];
  warnings: string[];
  dangling_blobs: number;
  dangling_commits: number;
  raw_output: string;
}

export interface GitHooksStatus {
  commit_msg_installed: boolean;
  pre_commit_installed: boolean;
  commit_msg_blocks_ai_trailers: boolean;
  pre_commit_blocks_secrets: boolean;
  gitignore_has_ai_dirs: boolean;
  missing_ai_dirs: string[];
}

export interface TagInfo {
  name: string;
  sha: string;
  short_sha: string;
  is_annotated: boolean;
  message?: string | null;
  tagger_name?: string | null;
  tagger_email?: string | null;
  tagger_date?: string | null;
}

export interface CreateTagOptions {
  name: string;
  target_sha?: string;
  message?: string;
  force?: boolean;
}

export interface SubmoduleInfo {
  name: string;
  path: string;
  head_sha: string;
  short_head: string;
  url: string;
  status: 'clean' | 'modified' | 'uninitialized' | 'conflict';
}

export interface BisectStatus {
  in_bisect: boolean;
  current_commit?: string | null;
  steps_remaining?: number;
  output?: string;
  culprit?: CommitInfo | null;
}

export interface RerereStatus {
  enabled: boolean;
  resolved_recorded: number;
}

export interface LfsDiagnostics {
  is_installed: boolean;
  tracked_patterns: string[];
  locked_files: string[];
}

export interface RangeDiffResult {
  output: string;
  diff_entries: Array<{
    status: 'matched' | 'modified' | 'added' | 'removed';
    summary: string;
    details?: string;
  }>;
}

export type MergeStrategyType = 'recursive-ours' | 'recursive-theirs' | 'strategy-ours';

export interface MergeExecutionOptions {
  branchName: string;
  strategy?: MergeStrategyType; // -X ours vs -X theirs vs -s ours
  message?: string;
  fastForward?: 'default' | 'no-ff' | 'ff-only';
  squash?: boolean;
  noCommit?: boolean;
  allowUnrelatedHistories?: boolean;
  autostash?: boolean;
}

export interface ForceRelocateBranchPreview {
  targetBranch: string;
  currentSha: string;
  newSha: string;
  lostCommits: CommitInfo[];
}
