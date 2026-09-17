//! IPC Command handlers for Git Workbench
//!
//! Security policy:
//! - All commands are strongly typed and explicitly exposed via Tauri command registration.
//! - No generic shell execution is ever exposed to the frontend.
//! - Destructive commands require safety guards, backups, and preview verification.

pub mod system;
