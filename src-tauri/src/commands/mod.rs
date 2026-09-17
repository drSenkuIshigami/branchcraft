//! IPC Command handlers for Git Workbench
//!
//! Security policy:
//! - All commands are strongly typed and explicitly exposed via Tauri command registration.
//! - No generic shell execution is ever exposed to the frontend.
//! - Read-only commands (Risk Level 0) execute directly with structured output.

pub mod repository;
pub mod system;
