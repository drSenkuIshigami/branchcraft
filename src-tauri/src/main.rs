// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;
pub mod git;
pub mod models;
pub mod safety;

use commands::system::get_git_availability;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_git_availability
        ])
        .run(tauri::generate_context!())
        .expect("error while running Git Workbench desktop application");
}
