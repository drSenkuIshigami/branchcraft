# IPC Contract Specification

> **Status:** Initial Draft (Phase 0)  
> **Notice:** This document defines all Tauri IPC commands exposed via `@tauri-apps/api/core` invoke wrappers (`src/ipc/`). It is strictly version-controlled and evolves by phase.

---

## 1. Principles of IPC Design

1. **Strictly Typed Commands:** Every command has an explicit Rust function signature and matching TypeScript wrapper.
2. **No Shell Execution:** No command accepts a raw shell string. Commands accept discrete, typed parameters.
3. **Structured Errors:** Failures return typed error representations or structured `OperationResult` objects, avoiding unhandled promise rejections.
4. **Local-First & Offline:** Purely local operations never require network access. Remote sync is an explicit, intentional action.

---

## 2. Command Index by Phase

| Phase | Tauri Command | Arguments | Return Type | Risk Level | Description |
|---|---|---|---|:---:|---|
| **0** | `get_git_availability` | *(none)* | `GitAvailability` | **0** | Checks if Git is present in system PATH via `git --version` |
| **1** | `pick_folder` | *(none)* | `Option<String>` | **0** | Opens native folder picker dialog |
| **1** | `open_repository` | `path: String` | `Result<StatusInfo, String>` | **0** | Validates `.git` and returns initial repository state |
| **1** | `get_status` | `repo_path: String` | `Result<StatusInfo, String>` | **0** | Queries current working tree and index status |
| **1** | `get_branches` | `repo_path: String` | `Result<Vec<BranchInfo>, String>` | **0** | Lists local and remote tracking branches |
| **1** | `get_commit_graph` | `repo_path: String, limit: u32, skip: u32` | `Result<Vec<CommitInfo>, String>` | **0** | Fetches topological commit graph data |
| **1** | `get_commit_detail` | `repo_path: String, sha: String` | `Result<CommitDetail, String>` | **0** | Fetches commit metadata and file changes |
| **1** | `get_file_diff` | `repo_path: String, path: String, rev: Option<String>` | `Result<FileDiff, String>` | **0** | Generates patch diff for Monaco editor |
| **2** | `stage_path` | `repo_path: String, path: String` | `Result<OperationResult, String>` | **1** | Stages a file path (`git add`) |
| **2** | `unstage_path` | `repo_path: String, path: String` | `Result<OperationResult, String>` | **1** | Unstages a file path (`git restore --staged`) |
| **2** | `commit` | `repo_path: String, message: String, amend: bool` | `Result<OperationResult, String>` | **1** | Creates a commit or amends HEAD |
| **2** | `create_branch` | `repo_path: String, name: String, start_sha: Option<String>` | `Result<OperationResult, String>` | **1** | Creates and switches to a new branch |
| **2** | `fetch` | `repo_path: String, prune: bool` | `Result<OperationResult, String>` | **0** | Explicit remote fetch |
| **2** | `push` | `repo_path: String, force_with_lease: bool` | `Result<OperationResult, String>` | **1–3** | Pushes to upstream (safe force default) |
| **3** | `start_interactive_rebase` | `repo_path: String, base_sha: String` | `Result<OperationResult, String>` | **2** | Starts planned interactive rebase |
| **3** | `cherry_pick` | `repo_path: String, sha: String` | `Result<OperationResult, String>` | **1–2** | Applies specific commit to HEAD |
| **3** | `reset` | `repo_path: String, target: String, mode: ResetMode` | `Result<OperationResult, String>` | **2–3** | Resets HEAD to target commit |
| **4** | `create_backup` | `repo_path: String, reason: String` | `Result<BackupRef, String>` | **0** | Automatic safety branch or bundle |
| **4** | `filter_repo_remove_paths` | `mirror_path: String, paths: Vec<String>` | `Result<OperationResult, String>` | **4** | Purges files across history in mirror clone |

---

## 3. Phase 0 IPC Definition

### `get_git_availability`
- **Signature:** `get_git_availability() -> GitAvailability`
- **Frontend Wrapper:** `getGitAvailability(): Promise<GitAvailability>`
- **Execution:** Invokes `git --version` through `std::process::Command` without shell interpretation.
- **Safety Level:** Level 0 (Read-only, completely non-destructive).
