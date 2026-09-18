// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;
pub mod git;
pub mod models;
pub mod safety;

use commands::repository::{
    amend_commit, create_branch, create_commit, delete_branch, discard_path, get_branches,
    get_commit_detail, get_commit_graph, get_file_diff, get_status, open_repository, pick_folder,
    rename_branch, stage_all, stage_path, switch_branch, unstage_all, unstage_path,
};
use commands::system::get_git_availability;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_git_availability,
            open_repository,
            get_status,
            get_branches,
            get_commit_graph,
            get_commit_detail,
            get_file_diff,
            pick_folder,
            stage_path,
            unstage_path,
            discard_path,
            stage_all,
            unstage_all,
            create_commit,
            amend_commit,
            create_branch,
            switch_branch,
            rename_branch,
            delete_branch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Git Workbench desktop application");
}
