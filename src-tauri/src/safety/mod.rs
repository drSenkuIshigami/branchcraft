//! Safety Engine & Warning Level Classification Architecture
//!
//! # User-Controlled Safety Policy & Warning Levels (0–4)
//!
//! Philosophy:
//! “No feature restriction. Full Git capability with clear risk warnings,
//! effect previews where feasible, explicit informed user consent, and complete
//! local audit visibility.”
//!
//! - **Level 0 (Read-Only / Informational):**
//!   Queries like `git status`, `git log`, `git diff`. Direct execution.
//!
//! - **Level 1 (Normal State Change):**
//!   Operations like `git add`, `git restore --staged`, `git commit`. Confirmation where useful.
//!
//! - **Level 2 (Local History / State Change):**
//!   Operations like `commit --amend`, `reset --soft/--mixed`. Single confirmation; backup offered.
//!
//! - **Level 3 (Destructive or Remote-Impacting):**
//!   Operations like `reset --hard`, `clean -fdx`, `branch -D`, `branch -f`, `git push --force`.
//!   Strong warning, preview, explicit confirmation checkboxes. User chooses whether to create backup ref.
//!
//! - **Level 4 (Repository-wide / History-Rewrite / Permanent):**
//!   Operations like `git filter-repo`, history-wide message/author rewrites.
//!   Critical warning, detailed impact list, typed confirmation, isolated mirror clone or direct working copy by user choice.

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum WarningLevel {
    Level0ReadOnly,
    Level1NormalStateChange,
    Level2LocalHistoryChange,
    Level3DestructiveOrRemote,
    Level4RepositoryWideRewrite,
}

pub type RiskLevel = WarningLevel;
