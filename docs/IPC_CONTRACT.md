# IPC Contract Specification

> **Status:** Active Standard  
> **Notice:** This document defines all Tauri IPC commands exposed via `@tauri-apps/api/core` invoke wrappers (`src/ipc/`). It is strictly version-controlled and adheres to the User-Controlled Safety Policy with Warning Levels (0–4).

---

## 1. Principles of IPC Design

1. **Strictly Typed Commands:** Every command has an explicit backend function signature and matching TypeScript wrapper.
2. **No Shell Execution:** No command accepts a raw shell string. Commands accept discrete, validated parameters.
3. **Structured Errors & Execution Records:** All actions return structured `OperationResult` or typed DTOs detailing exact command tokens and exit codes.
4. **Local-First & Explicit User Choice:** Purely local operations never require network access. All operations execute the exact user-selected flags without silent downgrading.

---

## 2. Command Index

| Command | Arguments | Return Type | Warning Level | Description |
|---|---|---|:---:|---|
| `get_git_availability` | *(none)* | `GitAvailability` | **0** | Checks if Git is present in PATH (`git --version`) |
| `pick_folder` | *(none)* | `Option<String>` | **0** | Opens native folder picker dialog |
| `open_repository` | `path: String` | `Result<StatusInfo, String>` | **0** | Validates `.git` and returns initial repository state |
| `get_status` | `repo_path: String` | `Result<StatusInfo, String>` | **0** | Queries current working tree and index status |
| `get_branches` | `repo_path: String` | `Result<Vec<BranchInfo>, String>` | **0** | Lists local and remote tracking branches |
| `get_commit_graph` | `repo_path: String, limit: u32, skip: u32` | `Result<Vec<CommitInfo>, String>` | **0** | Fetches topological commit graph data |
| `get_commit_detail` | `repo_path: String, sha: String` | `Result<CommitDetail, String>` | **0** | Fetches commit metadata and file changes |
| `get_file_diff` | `repo_path: String, path: String, rev: Option<String>` | `Result<FileDiff, String>` | **0** | Generates patch diff for Monaco editor |
| `stage_path` | `repo_path: String, path: String` | `Result<OperationResult, String>` | **1** | Stages a file path (`git add`) |
| `unstage_path` | `repo_path: String, path: String` | `Result<OperationResult, String>` | **1** | Unstages a file path (`git restore --staged`) |
| `discard_path` | `repo_path: String, path: String, is_untracked: bool` | `Result<OperationResult, String>` | **1–3** | Discards tracked file changes or removes untracked file |
| `clean_working_tree` | `repo_path: String, mode: CleanMode, dry_run: bool` | `Result<CleanResult, String>` | **0 (dry-run) / 2–3 (exec)** | Untracked/ignored file clean preview and execution (`git clean -f/-fd/-fdx`) |
| `commit` | `repo_path: String, message: String, amend: bool, create_backup: Option<bool>` | `Result<OperationResult, String>` | **1–2** | Creates a commit or amends HEAD (with optional backup ref) |
| `create_branch` | `repo_path: String, name: String, start_sha: Option<String>` | `Result<OperationResult, String>` | **1** | Creates and switches to a new branch |
| `delete_branch` | `repo_path: String, name: String, force: bool` | `Result<OperationResult, String>` | **1 (-d) / 3 (-D)** | Deletes branch (`git branch -d` or `git branch -D`) |
| `force_relocate_branch` | `repo_path: String, branch_name: String, new_sha: String, create_backup: bool` | `Result<OperationResult, String>` | **3** | Relocates branch pointer (`git branch -f`) with optional backup |
| `fetch` | `repo_path: String, prune: bool` | `Result<OperationResult, String>` | **0** | Explicit remote fetch |
| `push` | `repo_path: String, remote: String, branch: Option<String>, mode: PushMode, set_upstream: bool` | `Result<OperationResult, String>` | **1–3** | Pushes to upstream (`normal`, `force_with_lease`, `raw_force`, `mirror`) |
| `delete_remote_ref` | `repo_path: String, remote: String, ref_type: String, ref_name: String` | `Result<OperationResult, String>` | **3** | Deletes remote branch or tag (`git push <remote> --delete <ref>`) |
| `reset` | `repo_path: String, target: String, mode: ResetMode, create_backup: bool` | `Result<OperationResult, String>` | **2 (soft/mixed) / 3 (hard)** | Resets HEAD to target commit (`--soft`, `--mixed`, `--hard`), backup optional |
| `run_git_gc` | `repo_path: String, mode: GcMode` | `Result<OperationResult, String>` | **1 (standard) / 2 (prune) / 3 (aggressive)** | Runs garbage collection (`git gc`, `git gc --prune=now`, `--aggressive`) |
| `start_interactive_rebase` | `repo_path: String, base_sha: String` | `Result<OperationResult, String>` | **2–3** | Starts planned interactive rebase (unblocked on pushed branches) |
| `cherry_pick` | `repo_path: String, sha: String` | `Result<OperationResult, String>` | **1–2** | Applies specific commit to HEAD |
| `revert` | `repo_path: String, sha: String, mainline: Option<u32>` | `Result<OperationResult, String>` | **1–2** | Reverts commit with conflict sequencing |
| `get_reflog` | `repo_path: String, limit: u32` | `Result<Vec<ReflogEntry>, String>` | **0** | Queries reflog history for emergency recovery |
| `get_worktrees` | `repo_path: String` | `Result<Vec<WorktreeInfo>, String>` | **0** | Lists active git linked worktrees |
| `add_worktree` | `repo_path: String, options: AddWorktreeOptions` | `Result<OperationResult, String>` | **1** | Creates and links an isolated working tree |
| `remove_worktree` | `repo_path: String, worktree_path: String, force: bool` | `Result<OperationResult, String>` | **1–2** | Deletes linked worktree directory and administrative metadata |
| `create_backup` | `repo_path: String, reason: String` | `Result<BackupRef, String>` | **0** | Safety branch or bundle creation |
| `filter_repo_remove_paths` | `repo_path: String, paths: Vec<String>, isolated: bool, create_backup: bool` | `Result<OperationResult, String>` | **4** | Purges files across history (isolated mirror or direct working copy) |
| `publish_rewritten_history` | `repo_path: String, operation_id: String` | `Result<RemotePublishResult>, String>` | **4** | Pushes rewritten refs via user confirmed strategy |
