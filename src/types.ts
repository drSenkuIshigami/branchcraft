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
  current_branch?: string | null;
  upstream?: string | null;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  conflicted: string[];
}

export interface OperationResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
  command_run: string[];
  duration_ms: number;
}
