# Data Model Specification

> **Status:** Initial Draft (Phase 0)  
> **Notice:** This document defines the core data contracts between the Rust backend (`src-tauri/src/models.rs`) and the TypeScript frontend (`src/types.ts`). This model evolves incrementally across phases.

---

## 1. Overview & Serialization Policy

- All models are defined in Rust with `serde::Serialize` and `serde::Deserialize`.
- All JSON field names are camelCase in IPC responses where appropriate, or direct 1:1 snake_case matching for straightforward deserialization.
- No dynamic `any` or untyped JSON blobs are accepted across the IPC boundary.
- Timestamps are formatted as ISO 8601 strings (UTC or local with timezone offset).

---

## 2. Core Entities

### 2.1 GitAvailability (Phase 0)
Represents the system availability and version of the host `git` executable.

```rust
pub struct GitAvailability {
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}
```

```typescript
export interface GitAvailability {
  available: boolean;
  version?: string | null;
  error?: string | null;
}
```

---

### 2.2 CommitInfo (Phase 1)
Represents a Git commit for graph rendering, inspection, and log browsing.

```rust
pub struct CommitInfo {
    pub sha: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub author_date: String,   // ISO 8601
    pub committer_name: String,
    pub committer_email: String,
    pub committer_date: String,
    pub subject: String,
    pub body: String,
    pub refs: Vec<String>,     // ["HEAD -> main", "origin/main", "tag: v1.0.0"]
}
```

---

### 2.3 BranchInfo (Phase 1)
Represents local and remote tracking branches.

```rust
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
```

---

### 2.4 FileChange & StatusInfo (Phase 1 & 2)
Describes working tree and index status without invoking complex shell parsing.

```rust
pub enum ChangeType {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChange,
}

pub struct FileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub change_type: ChangeType,
    pub is_staged: bool,
    pub is_binary: bool,
}

pub struct StatusInfo {
    pub current_branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<String>,
    pub conflicted: Vec<String>,
}
```

---

### 2.5 OperationResult (Phase 1–5)
Structured output of every executed Git command for display in the audit/command log.

```rust
pub struct OperationResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub command_run: Vec<String>,  // Tokenized arguments actually executed
    pub duration_ms: u64,
}
```

---

### 2.6 BackupRef (Phase 4 Safety Engine)
Tracks automatic safety snapshots and restore points.

```rust
pub struct BackupRef {
    pub kind: String,        // "branch" | "tag" | "bundle"
    pub identifier: String,  // e.g. "backup/pre-rebase-20260917-133000"
    pub created_at: String,
    pub reason: String,
}
```

---

### 2.7 AI Cleanup & Controlled History Rewrite (Phase 4 Extension)

```rust
pub enum CleanupTargetKind {
    WorkingTreeTextOccurrence,
    HeadCommitMessageLine,
    RepositoryConfigPath,
    RepositoryHook,
    HistoricalCommitMessage,
    HistoricalTagMessage,
    HistoricalGitNote,
    HistoricalIdentityMapping,
}

pub enum CleanupRiskLevel {
    Risk1WorkingTreeEdit,
    Risk2LocalHeadAmend,
    Risk3PublishedHeadAmend,
    Risk2ConfigurationUntrack,
    Risk3DestructiveLocalRemoval,
    Risk4HistoryRewrite,
    Risk4RemoteRewritePublication,
}

pub enum RewriteOperationStatus {
    Draft,
    ScopeReviewed,
    FirstConfirmationPassed,
    MirrorCreated,
    BackupCreated,
    BackupVerified,
    PreviewReady,
    RewriteRunning,
    RewriteValidated,
    RewriteCompletedLocally,
    PushScopeReviewed,
    SecondConfirmationPassed,
    Publishing,
    Published,
    Failed,
    Cancelled,
}

pub struct RewriteOperation {
    pub operation_id: String,
    pub source_repository_path: String,
    pub isolated_workspace_path: String,
    pub backup_bundle_path: String,
    pub selected_finding_ids: Vec<String>,
    pub selected_refs: Vec<String>,
    pub selected_remote: Option<String>,
    pub status: RewriteOperationStatus,
    pub created_at: String,
    pub updated_at: String,
    pub rewritten_commits_count: Option<usize>,
    pub rewritten_refs_count: Option<usize>,
    pub bundle_verified: Option<bool>,
    pub fsck_passed: Option<bool>,
    pub error: Option<String>,
}
```

---

## 3. Phase Evolution Roadmap
- **Phase 0:** `GitAvailability` active; placeholders established.
- **Phase 1:** `CommitInfo`, `BranchInfo`, `StatusInfo`, `FileChange` activated.
- **Phase 2:** Hunk and staging patch models added (`DiffHunk`, `StagedHunk`).
- **Phase 3:** Interactive rebase plan models (`RebaseTodoItem`, `ReflogEntry`, `WorktreeInfo`).
- **Phase 4:** Secret scan reports, large file manifests, AI-trace audit findings, controlled history rewrite models.
