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
| **3** | `revert` | `repo_path: String, sha: String, mainline: Option<u32>` | `Result<OperationResult, String>` | **1–2** | Reverts commit with conflict sequencing |
| **3** | `reset` | `repo_path: String, target: String, mode: ResetMode` | `Result<OperationResult, String>` | **2–3** | Resets HEAD to target commit (auto backup on hard) |
| **3** | `get_reflog` | `repo_path: String, limit: u32` | `Result<Vec<ReflogEntry>, String>` | **0** | Queries reflog history for emergency recovery |
| **3** | `get_worktrees` | `repo_path: String` | `Result<Vec<WorktreeInfo>, String>` | **0** | Lists active git linked worktrees |
| **3** | `add_worktree` | `repo_path: String, options: AddWorktreeOptions` | `Result<OperationResult, String>` | **1** | Creates and links an isolated working tree |
| **3** | `remove_worktree` | `repo_path: String, worktree_path: String, force: bool` | `Result<OperationResult, String>` | **1–2** | Deletes linked worktree directory and administrative metadata |
| **3** | `lock_worktree` | `repo_path: String, worktree_path: String, reason: Option<String>` | `Result<OperationResult, String>` | **0** | Locks worktree against pruning or accidental deletion |
| **3** | `unlock_worktree` | `repo_path: String, worktree_path: String` | `Result<OperationResult, String>` | **0** | Unlocks worktree |
| **3** | `prune_worktrees` | `repo_path: String` | `Result<OperationResult, String>` | **1** | Prunes stale administrative records |
| **4** | `create_backup` | `repo_path: String, reason: String` | `Result<BackupRef, String>` | **0** | Automatic safety branch or bundle |
| **4** | `filter_repo_remove_paths` | `mirror_path: String, paths: Vec<String>` | `Result<OperationResult, String>` | **4** | Purges files across history in mirror clone |
| **4** | `get_cleanup_eligibility` | `repo_path: String, findings: Vec<Finding>` | `Result<Vec<ClassifiedFinding>, String>` | **0** | Revalidates and classifies AI artefacts against safety boundaries |
| **4** | `build_working_tree_cleanup_preview` | `repo_path: String, selected_finding_ids: Vec<String>` | `Result<Vec<WorkingTreeEditPreview>, String>` | **0** | Unified line-level diff preview for working tree files |
| **4** | `apply_working_tree_cleanup` | `repo_path: String, selected_finding_ids: Vec<String>, token: String` | `Result<WorkingTreeCleanupResult>, String>` | **1** | Applies line edits with in-memory undo buffer snapshot |
| **4** | `undo_working_tree_cleanup` | `repo_path: String, operation_id: String` | `Result<WorkingTreeCleanupResult>, String>` | **1** | Restores original file content from memory snapshot |
| **4** | `build_head_commit_cleanup_preview` | `repo_path: String, selected_finding_ids: Vec<String>` | `Result<HeadCommitAmendPreview>, String>` | **0** | Previews sanitized HEAD message and backup ref |
| **4** | `amend_head_commit_cleanup` | `repo_path: String, selected_finding_ids: Vec<String>, token: String` | `Result<HeadCommitAmendResult>, String>` | **2–3** | Amends HEAD commit via temporary message file |
| **4** | `build_history_rewrite_scope` | `repo_path: String, selected_finding_ids: Vec<String>, selected_refs: Vec<String>` | `Result<HistoryRewriteScope>, String>` | **0** | Calculates exact affected commits, tags, and descendant count |
| **4** | `acknowledge_history_rewrite` | `repo_path: String, operation_id: String, checkbox_state, typed_phrase: String` | `Result<{ success: bool }, String>` | **4** | Enforces 5 mandatory checkboxes & exact phrase verification |
| **4** | `create_isolated_rewrite_workspace` | `repo_path: String, operation_id: String` | `Result<RewriteOperation>, String>` | **0** | Creates disposable mirror clone in segregated temporary directory |
| **4** | `create_rewrite_backup` | `repo_path: String, operation_id: String` | `Result<RewriteOperation>, String>` | **0** | Generates offline Git bundle backup (`pre-rewrite.bundle`) |
| **4** | `verify_rewrite_backup` | `repo_path: String, operation_id: String` | `Result<RewriteOperation>, String>` | **0** | Verifies cryptographic integrity of Git bundle backup |
| **4** | `apply_history_rewrite` | `repo_path: String, operation_id: String` | `Result<HistoryRewriteResult>, String>` | **4** | Filters mirror clone strictly without touching active working repo |
| **4** | `validate_history_rewrite` | `repo_path: String, operation_id: String` | `Result<HistoryRewriteResult>, String>` | **0** | Runs `git fsck --full` on rewritten mirror clone |
| **4** | `build_remote_publish_scope` | `repo_path: String, operation_id: String, remote: String, strategy: String` | `Result<RemotePublishScope>, String>` | **0** | Previews force-with-lease remote update scope |
| **4** | `acknowledge_remote_publish` | `repo_path: String, operation_id: String, checkbox_state, typed_phrase: String` | `Result<{ success: bool }, String>` | **4** | Enforces 6 mandatory publication checkboxes & typed remote phrase |
| **4** | `publish_rewritten_history` | `repo_path: String, operation_id: String` | `Result<RemotePublishResult>, String>` | **4** | Pushes rewritten refs via `--force-with-lease` |
| **4** | `get_post_publish_checklist` | `repo_path: String, operation_id: String` | `Result<PostPublishChecklist>, String>` | **0** | Generates team coordination checklist |
| **4** | `export_post_publish_checklist` | `repo_path: String, operation_id: String` | `Result<{ export_path: String, markdown: String }, String>` | **0** | Exports checklist as Markdown file |

---

## 3. Phase 0 IPC Definition

### `get_git_availability`
- **Signature:** `get_git_availability() -> GitAvailability`
- **Frontend Wrapper:** `getGitAvailability(): Promise<GitAvailability>`
- **Execution:** Invokes `git --version` through `std::process::Command` without shell interpretation.
- **Safety Level:** Level 0 (Read-only, completely non-destructive).
