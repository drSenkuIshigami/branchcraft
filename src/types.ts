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

export type AITraceType = 'banner' | 'trailer' | 'metadata' | 'file_marker' | 'comment';

export interface AITraceFinding {
  id?: string;
  type: AITraceType;
  category?: 'banner' | 'commit_trailer' | 'config_file' | 'code_watermark';
  marker: string; // e.g., 'Built with AI Studio banner', 'Co-authored-by: Cursor', '.cursorrules'
  file_path?: string;
  line_number?: number;
  commit_sha?: string;
  commit_subject?: string;
  date?: string;
  details: string;
  snippet?: string;
  can_auto_clean?: boolean;
}

export interface CleanAITracesOptions {
  repoPath: string;
  cleanBanners?: boolean;
  cleanTrailersInHistory?: boolean;
  cleanCommentWatermarks?: boolean;
  removeConfigFiles?: boolean;
  cleanHistoryBanners?: boolean;
  createSafetyBackup?: boolean;
}

export interface CleanAITracesResult {
  success: boolean;
  cleaned_files: string[];
  cleaned_commits_count: number;
  total_traces_removed: number;
  backup_ref?: string;
  error?: string;
  duration_ms: number;
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

export interface SearchMatch {
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
  replaced_content?: string;
}

export interface SearchFileResult {
  file_path: string;
  matches: SearchMatch[];
  branch_or_commit?: string;
}

export interface SearchCommitMatch {
  sha: string;
  short_sha: string;
  subject: string;
  author_name: string;
  author_date: string;
  file_path?: string;
  matching_line?: string;
}

export interface SearchQueryOptions {
  query: string;
  replaceText?: string;
  isRegex?: boolean;
  isCaseSensitive?: boolean;
  isWholeWord?: boolean;
  searchScope: 'working_tree' | 'all_commits' | 'selected_branches';
  branches?: string[];
  branchPattern?: string;
  fileFilter?: string;
  pathPrefix?: string;
  maxResults?: number;
}

export interface SearchResponse {
  query: string;
  total_matches: number;
  files_matched: number;
  results: SearchFileResult[];
  commit_results?: SearchCommitMatch[];
  duration_ms: number;
}

export interface ReplaceFileOptions {
  repoPath: string;
  filePaths: string[];
  query: string;
  replaceText: string;
  isRegex?: boolean;
  isCaseSensitive?: boolean;
  isWholeWord?: boolean;
  lineNumbers?: number[];
}

export interface ReplaceResponse {
  success: boolean;
  replaced_files_count: number;
  total_replacements_count: number;
  modified_files: string[];
  error?: string;
}

// =========================================================================
// AI Artefact Cleanup & Controlled History Rewrite Data Models
// =========================================================================

export type CleanupTargetKind =
  | 'WorkingTreeTextOccurrence'
  | 'HeadCommitMessageLine'
  | 'RepositoryConfigPath'
  | 'RepositoryHook'
  | 'HistoricalCommitMessage'
  | 'HistoricalTagMessage'
  | 'HistoricalGitNote'
  | 'HistoricalIdentityMapping';

export type CleanupRiskLevel =
  | 'Risk1WorkingTreeEdit'
  | 'Risk2LocalHeadAmend'
  | 'Risk3PublishedHeadAmend'
  | 'Risk2ConfigurationUntrack'
  | 'Risk3DestructiveLocalRemoval'
  | 'Risk4HistoryRewrite'
  | 'Risk4RemoteRewritePublication';

export type RewriteOperationStatus =
  | 'Draft'
  | 'ScopeReviewed'
  | 'FirstConfirmationPassed'
  | 'MirrorCreated'
  | 'BackupCreated'
  | 'BackupVerified'
  | 'PreviewReady'
  | 'RewriteRunning'
  | 'RewriteValidated'
  | 'RewriteCompletedLocally'
  | 'PushScopeReviewed'
  | 'SecondConfirmationPassed'
  | 'Publishing'
  | 'Published'
  | 'Failed'
  | 'Cancelled';

export type FindingClassification =
  | 'explicit_tool_attribution_file'
  | 'explicit_ai_trailer_head'
  | 'explicit_ai_trailer_history'
  | 'explicit_ai_bot_identity'
  | 'tool_configuration_file'
  | 'ai_agent_instruction_file'
  | 'human_attribution' // Disabled from removal
  | 'legal_compliance_material' // Disabled from removal
  | 'ambiguous_generic_reference' // Disabled by default
  | 'external_provider_record' // Disabled from local modification
  | 'signed_commit_metadata'; // Warning flag

export interface ClassifiedFinding {
  id: string;
  kind: CleanupTargetKind;
  classification: FindingClassification;
  risk_level: CleanupRiskLevel;
  selectable: boolean;
  selected_by_default: boolean;
  file_path?: string;
  line_number?: number;
  commit_sha?: string;
  commit_subject?: string;
  matched_text: string;
  proposed_edit?: string;
  author_identity?: string;
  committer_identity?: string;
  is_signed?: boolean;
  is_head?: boolean;
  branches?: string[];
  tags?: string[];
  explanation: string;
}

export interface WorkingTreeEditPreview {
  file_path: string;
  line_range: [number, number];
  matched_text: string;
  surrounding_context: string;
  proposed_diff: string;
  proposed_edit: string;
  selectable: boolean;
  is_binary: boolean;
  is_protected: boolean;
}

export interface WorkingTreeCleanupResult {
  operation_id: string;
  success: boolean;
  changed_files: string[];
  diff_check_stdout: string;
  status_short_stdout: string;
  undo_available: boolean;
  error?: string;
  duration_ms: number;
}

export interface HeadCommitAmendPreview {
  commit_sha: string;
  subject: string;
  author: string;
  committer: string;
  is_signed: boolean;
  has_upstream: boolean;
  risk_level: CleanupRiskLevel;
  original_message: string;
  proposed_message: string;
  removed_lines: string[];
  backup_ref: string;
}

export interface HeadCommitAmendResult {
  success: boolean;
  old_commit_sha: string;
  new_commit_sha: string;
  backup_ref: string;
  signature_invalidated: boolean;
  recovery_instructions: string;
  error?: string;
}

export interface ConfigHookTarget {
  id: string;
  path: string;
  kind: 'config_file' | 'hook';
  status: 'tracked' | 'untracked' | 'ignored';
  action: 'keep' | 'gitignore' | 'git_rm_cached' | 'remove_untracked' | 'disable_hook';
  backup_path?: string;
  is_agent_instruction: boolean; // e.g. CLAUDE.md, never default remove
}

export interface ConfigHookCleanupPreview {
  targets: ConfigHookTarget[];
  estimated_risk: CleanupRiskLevel;
}

export interface ConfigHookCleanupResult {
  success: boolean;
  actions_taken: { path: string; action: string; backup_id?: string }[];
  backup_id?: string;
  error?: string;
}

export interface HistoryRewriteScope {
  operation_id: string;
  selected_finding_ids: string[];
  affected_commits: {
    sha: string;
    short_sha: string;
    subject: string;
    is_signed: boolean;
    author: string;
    date: string;
  }[];
  affected_refs: string[];
  affected_branches: string[];
  affected_tags: string[];
  descendant_commits_count: number;
  has_remotes: boolean;
  remotes: string[];
  lines_to_remove: string[];
  paths_to_remove: string[];
  identity_mappings: { old_identity: string; new_identity: string }[];
  signature_warning: boolean;
  disclaimer: string;
}

export interface HistoryRewritePreview {
  operation_id: string;
  affected_commits_count: number;
  sample_message_transformations: {
    sha: string;
    before: string;
    after: string;
  }[];
  paths_to_remove: string[];
  identity_mappings: { old_identity: string; new_identity: string }[];
}

export interface RewriteOperation {
  operation_id: string;
  source_repository_path: string;
  isolated_workspace_path: string;
  backup_bundle_path: string;
  selected_finding_ids: string[];
  selected_refs: string[];
  selected_remote?: string;
  status: RewriteOperationStatus;
  created_at: string;
  updated_at: string;
  rewritten_commits_count?: number;
  rewritten_refs_count?: number;
  bundle_verified?: boolean;
  fsck_passed?: boolean;
  error?: string;
}

export interface HistoryRewriteResult {
  operation_id: string;
  status: RewriteOperationStatus;
  backup_bundle_path: string;
  bundle_verified: boolean;
  isolated_workspace_path: string;
  rewritten_refs: string[];
  rewritten_commits_count: number;
  fsck_valid: boolean;
  signature_warning: string;
  remaining_findings_count: number;
  clear_status_message: string;
  error?: string;
}

export interface RemotePublishScope {
  operation_id: string;
  remote_name: string;
  sanitized_remote_url: string;
  current_mirror_refs: string[];
  remote_refs_to_change: string[];
  strategy: 'selected_branch_force_with_lease' | 'mirror_update';
  requires_second_confirmation: boolean;
  confirmation_phrase: string;
}

export interface RemotePublishResult {
  operation_id: string;
  success: boolean;
  remote_name: string;
  updated_refs: string[];
  stdout: string;
  stderr: string;
  error?: string;
}

export interface PostPublishChecklist {
  operation_id: string;
  completed_at: string;
  items: { task: string; completed: boolean; recommendation: string }[];
  export_markdown: string;
}


