//! Git Workbench - Models
//! Shared data structures between Rust backend and TypeScript frontend via serde.

use serde::{Deserialize, Serialize};

/// Basic information about a Git commit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub sha: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub author_date: String, // ISO 8601
    pub committer_name: String,
    pub committer_email: String,
    pub committer_date: String,
    pub subject: String,
    pub body: String,
    pub refs: Vec<String>,
}

/// Git branch information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_local: bool,
    pub is_remote: bool,
    pub is_head: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub tip_sha: String,
}

/// File modification classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChangeType {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChange,
}

/// Status of an individual file in the worktree or index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub change_type: ChangeType,
    pub is_staged: bool,
    pub is_binary: bool,
}

/// Overall repository status summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusInfo {
    pub root_path: String,
    pub current_branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<String>,
    pub conflicted: Vec<String>,
}

/// Detailed file change entry for a specific commit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitDetailFile {
    pub path: String,
    pub status: ChangeType,
    pub additions: i32,
    pub deletions: i32,
    pub old_path: Option<String>,
}

/// Commit summary statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitStats {
    pub files_changed: usize,
    pub insertions: usize,
    pub deletions: usize,
}

/// Detailed commit metadata and file changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitDetail {
    pub commit: CommitInfo,
    pub files: Vec<CommitDetailFile>,
    pub stats: CommitStats,
}

/// File diff comparison for Monaco editor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub path: String,
    pub old_content: String,
    pub new_content: String,
    pub is_binary: bool,
    pub raw_diff: String,
}

/// Typed result of a controlled Git or system execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub command_run: Vec<String>,
    pub duration_ms: u64,
}

/// Git availability status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitAvailability {
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

/// Reference point for safety backups
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupRef {
    pub kind: String, // "branch" | "tag" | "bundle"
    pub identifier: String,
    pub created_at: String,
    pub reason: String,
}
