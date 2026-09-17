//! System & environment inspection commands

use crate::models::GitAvailability;
use std::process::Command;

/// Checks if Git is installed and available in the system PATH.
/// Security guarantee: Only executes `git --version` with strictly isolated arguments.
/// Never invokes a shell (sh, bash, cmd, powershell).
#[tauri::command]
pub fn get_git_availability() -> GitAvailability {
    match Command::new("git").arg("--version").output() {
        Ok(output) => {
            if output.status.success() {
                let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                GitAvailability {
                    available: true,
                    version: Some(version_str),
                    error: None,
                }
            } else {
                let err_str = String::from_utf8_lossy(&output.stderr).trim().to_string();
                GitAvailability {
                    available: false,
                    version: None,
                    error: Some(if err_str.is_empty() {
                        "Git process exited with an error status".to_string()
                    } else {
                        err_str
                    }),
                }
            }
        }
        Err(err) => GitAvailability {
            available: false,
            version: None,
            error: Some(format!(
                "Git executable not found in system PATH: {}",
                err
            )),
        },
    }
}
