//! Safety Engine & Risk Classification Architecture
//!
//! # 5-Tier Risk Classification Model
//!
//! - **Level 0 (Read-Only):**
//!   Queries like `git status`, `git log`, `git diff`. Direct execution without prompt.
//!
//! - **Level 1 (Easily Reversible):**
//!   Operations like `git add`, `git restore --staged`, `git commit`. Confirmation or Undo where appropriate.
//!
//! - **Level 2 (Local History Rewrite):**
//!   Operations like `commit --amend`, `reset --soft/--mixed`, local unpublished rebase.
//!   Requires preview + explicit confirmation + lightweight restore point (`backup/pre-<op>-<timestamp>`).
//!   Does NOT require a full bundle backup by default.
//!
//! - **Level 3 (Destructive / Published):**
//!   Operations like `reset --hard`, `clean -fd`, rebase on published branches, force-push.
//!   Requires mandatory automatic backup + preview diff + two-step confirmation.
//!   Default push flag must always be `--force-with-lease` (never raw `--force`).
//!
//! - **Level 4 (Security & History Purge):**
//!   Operations like `git filter-repo`, secret removal, large file purges.
//!   Executed strictly in a separate mirror clone (`git clone --mirror`), with mandatory bundle backup,
//!   typed confirmation string, and a separate explicit push step.
//!
//! # Phase 0 Security Invariant
//!
//! All destructive operation logic, backup engines, and purge wizards remain dormant
//! until their planned activation in Phase 4.

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum RiskLevel {
    Level0ReadOnly,
    Level1Reversible,
    Level2LocalRewrite,
    Level3Destructive,
    Level4SecurityPurge,
}
