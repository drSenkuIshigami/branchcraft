//! Safety & Backup Engine
//!
//! Enforces the 5-tier operation risk classification (Level 0 - 4).
//! - Level 0: Read-only (direct execution)
//! - Level 1: Easily reversible (confirmation or undo)
//! - Level 2: Local history rewrite (preview + confirmation + lightweight restore point)
//! - Level 3: Destructive/Published (mandatory automatic backup + preview + two-step confirmation)
//! - Level 4: Security/Comprehensive rewrite (dedicated wizard + mirror clone + mandatory bundle backup + typed confirmation)
//!
//! Note: In Phase 0, all destructive workflows remain dormant until Phase 4.

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum RiskLevel {
    Level0ReadOnly,
    Level1Reversible,
    Level2LocalRewrite,
    Level3Destructive,
    Level4SecurityPurge,
}
