//! Repository inspection commands for Tauri
//! Read-only operations (Risk Level 0)

use crate::git::GitAdapter;
use crate::models::{BranchInfo, CommitDetail, CommitInfo, FileDiff, StatusInfo};

/// Validates repository and returns current status
#[tauri::command]
pub async fn open_repository(path: String) -> Result<StatusInfo, String> {
    GitAdapter::get_status(&path)
}

/// Retrieves latest status for the opened repository
#[tauri::command]
pub async fn get_status(repo_path: String) -> Result<StatusInfo, String> {
    GitAdapter::get_status(&repo_path)
}

/// Lists all local and remote branches
#[tauri::command]
pub async fn get_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    GitAdapter::get_branches(&repo_path)
}

/// Fetches topological commit graph
#[tauri::command]
pub async fn get_commit_graph(
    repo_path: String,
    limit: u32,
    skip: u32,
) -> Result<Vec<CommitInfo>, String> {
    GitAdapter::get_commit_graph(&repo_path, limit, skip)
}

/// Fetches commit detail including files changed and stats
#[tauri::command]
pub async fn get_commit_detail(repo_path: String, sha: String) -> Result<CommitDetail, String> {
    GitAdapter::get_commit_detail(&repo_path, &sha)
}

/// Fetches diff for a file
#[tauri::command]
pub async fn get_file_diff(
    repo_path: String,
    path: String,
    rev: Option<String>,
) -> Result<FileDiff, String> {
    GitAdapter::get_file_diff(&repo_path, &path, rev.as_deref())
}

/// Placeholder for native folder picker
#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    // In Tauri 2 desktop, native dialog plugin handles this.
    // Return None if canceled or prompt via frontend fallback.
    Ok(None)
}
