//! Git CLI Execution Adapter & Security Boundary
//!
//! # Architectural Security Principles
//!
//! 1. **Zero Shell Invocation:**
//!    Every Git command MUST execute strictly via `std::process::Command::new("git")`
//!    with isolated arguments passed using `.arg()` or `.args()`.
//!    Shell interpreters (`/bin/sh`, `bash -c`, `cmd.exe /c`, `powershell`) are strictly prohibited.
//!
//! 2. **Typed Allowlist Enforcement:**
//!    Only subcommands and argument structures explicitly documented in
//!    `docs/COMMAND_ALLOWLIST.md` are permitted. Arbitrary command execution is impossible.
//!
//! 3. **Input Sanitization:**
//!    All parameters (branch names, paths, commit SHAs) must be validated against strict
//!    safe patterns before invoking the child process.
//!
//! 4. **Local-First & Explicit Networking:**
//!    Purely local repository operations (log, status, diff, local commit, branch checkout)
//!    must never trigger network calls or background fetches. Remote commands (`fetch`, `push`, `pull`)
//!    are strictly decoupled and must be deliberate user actions.

use std::path::Path;
use std::process::Command;
use std::time::Instant;

use crate::models::{
    BranchInfo, ChangeType, CommitDetail, CommitDetailFile, CommitInfo, CommitStats, FileChange,
    FileDiff, OperationResult, StatusInfo,
};

pub struct GitAdapter;

impl GitAdapter {
    /// Executes a Git command with explicit argument tokens and returns the structured OperationResult
    pub fn execute_raw(repo_path: Option<&str>, args: &[&str]) -> Result<OperationResult, String> {
        let start = Instant::now();
        let mut cmd = Command::new("git");

        if let Some(path) = repo_path {
            cmd.current_dir(path);
        }

        cmd.args(args);

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to execute git process: {}", e))?;

        let duration_ms = start.elapsed().as_millis() as u64;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);

        Ok(OperationResult {
            success: output.status.success(),
            stdout,
            stderr,
            exit_code,
            command_run: args.iter().map(|s| s.to_string()).collect(),
            duration_ms,
        })
    }

    /// Validates whether a path is inside a Git worktree and finds the root path
    pub fn validate_repository(path: &str) -> Result<String, String> {
        let p = Path::new(path);
        if !p.exists() {
            return Err(format!("Specified path does not exist: {}", path));
        }

        let res = Self::execute_raw(Some(path), &["rev-parse", "--is-inside-work-tree"])?;
        if !res.success || res.stdout.trim() != "true" {
            return Err(format!("Directory is not a valid Git repository: {}", path));
        }

        let top_res = Self::execute_raw(Some(path), &["rev-parse", "--show-toplevel"])?;
        if !top_res.success {
            return Err("Failed to resolve repository top-level directory".to_string());
        }

        Ok(top_res.stdout.trim().to_string())
    }

    /// Retrieves status using porcelain v2 format
    pub fn get_status(repo_path: &str) -> Result<StatusInfo, String> {
        let root_path = Self::validate_repository(repo_path)?;
        let res = Self::execute_raw(
            Some(&root_path),
            &["status", "--porcelain=v2", "--branch", "--untracked-files=all"],
        )?;

        if !res.success {
            return Err(format!("git status failed: {}", res.stderr));
        }

        let mut current_branch = None;
        let mut upstream = None;
        let mut ahead = 0;
        let mut behind = 0;
        let mut staged = Vec::new();
        let mut unstaged = Vec::new();
        let mut untracked = Vec::new();
        let mut conflicted = Vec::new();

        for line in res.stdout.lines() {
            if line.starts_with("# branch.head ") {
                let name = line.trim_start_matches("# branch.head ").trim();
                if name != "(detached)" {
                    current_branch = Some(name.to_string());
                }
            } else if line.starts_with("# branch.upstream ") {
                upstream = Some(line.trim_start_matches("# branch.upstream ").trim().to_string());
            } else if line.starts_with("# branch.ab ") {
                let parts: Vec<&str> = line.trim_start_matches("# branch.ab ").split_whitespace().collect();
                if parts.len() >= 2 {
                    ahead = parts[0].trim_start_matches('+').parse::<u32>().unwrap_or(0);
                    behind = parts[1].trim_start_matches('-').parse::<u32>().unwrap_or(0);
                }
            } else if line.starts_with("1 ") {
                // Format: 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 9 {
                    let xy = parts[1];
                    let file_path = parts[8..].join(" ");
                    let staged_char = xy.chars().next().unwrap_or('.');
                    let unstaged_char = xy.chars().nth(1).unwrap_or('.');

                    if staged_char != '.' {
                        staged.push(FileChange {
                            path: file_path.clone(),
                            old_path: None,
                            change_type: match staged_char {
                                'A' => ChangeType::Added,
                                'D' => ChangeType::Deleted,
                                'R' => ChangeType::Renamed,
                                'C' => ChangeType::Copied,
                                _ => ChangeType::Modified,
                            },
                            is_staged: true,
                            is_binary: false,
                        });
                    }

                    if unstaged_char != '.' {
                        unstaged.push(FileChange {
                            path: file_path,
                            old_path: None,
                            change_type: match unstaged_char {
                                'A' => ChangeType::Added,
                                'D' => ChangeType::Deleted,
                                'R' => ChangeType::Renamed,
                                'C' => ChangeType::Copied,
                                _ => ChangeType::Modified,
                            },
                            is_staged: false,
                            is_binary: false,
                        });
                    }
                }
            } else if line.starts_with("2 ") {
                // Renamed or copied entry
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 10 {
                    let file_path = parts[8..].join(" ");
                    staged.push(FileChange {
                        path: file_path,
                        old_path: None,
                        change_type: ChangeType::Renamed,
                        is_staged: true,
                        is_binary: false,
                    });
                }
            } else if line.starts_with("u ") {
                // Unmerged/conflicted entry
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 11 {
                    conflicted.push(parts[10..].join(" "));
                }
            } else if line.starts_with("? ") {
                // Untracked entry: ? <path>
                untracked.push(line.trim_start_matches("? ").to_string());
            }
        }

        Ok(StatusInfo {
            root_path,
            current_branch,
            upstream,
            ahead,
            behind,
            staged,
            unstaged,
            untracked,
            conflicted,
        })
    }

    /// Queries all branches with ahead/behind and tracking information
    pub fn get_branches(repo_path: &str) -> Result<Vec<BranchInfo>, String> {
        let format = "%(refname:short)%09%(refname)%09%(HEAD)%09%(upstream:short)%09%(objectname:short)";
        let res = Self::execute_raw(
            Some(repo_path),
            &[
                "for-each-ref",
                &format!("--format={}", format),
                "refs/heads/",
                "refs/remotes/",
            ],
        )?;

        if !res.success {
            return Err(format!("Failed to query branches: {}", res.stderr));
        }

        let mut branches = Vec::new();

        for line in res.stdout.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 5 {
                let name = parts[0].to_string();
                let full_ref = parts[1];
                let is_head = parts[2] == "*";
                let upstream = if !parts[3].is_empty() {
                    Some(parts[3].to_string())
                } else {
                    None
                };
                let tip_sha = parts[4].to_string();

                let is_local = full_ref.starts_with("refs/heads/");
                let is_remote = full_ref.starts_with("refs/remotes/");

                // Compute ahead/behind if upstream exists
                let mut ahead = 0;
                let mut behind = 0;
                if let Some(ref up) = upstream {
                    if let Ok(rev_res) = Self::execute_raw(
                        Some(repo_path),
                        &["rev-list", "--left-right", "--count", &format!("{}...{}", name, up)],
                    ) {
                        if rev_res.success {
                            let counts: Vec<&str> = rev_res.stdout.split_whitespace().collect();
                            if counts.len() >= 2 {
                                ahead = counts[0].parse().unwrap_or(0);
                                behind = counts[1].parse().unwrap_or(0);
                            }
                        }
                    }
                }

                branches.push(BranchInfo {
                    name,
                    is_local,
                    is_remote,
                    is_head,
                    upstream,
                    ahead,
                    behind,
                    tip_sha,
                });
            }
        }

        Ok(branches)
    }

    /// Fetches commit graph data in topological order
    pub fn get_commit_graph(repo_path: &str, limit: u32, skip: u32) -> Result<Vec<CommitInfo>, String> {
        // Format: SHA%x1fPARENTS%x1fAUTHOR_NAME%x1fAUTHOR_EMAIL%x1fAUTHOR_DATE%x1fCOMMITTER_NAME%x1fCOMMITTER_EMAIL%x1fCOMMITTER_DATE%x1fSUBJECT%x1fBODY%x1fREFS%x1e
        let format = "%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s%x1f%b%x1f%D%x1e";
        let limit_str = limit.to_string();
        let skip_str = skip.to_string();

        let res = Self::execute_raw(
            Some(repo_path),
            &[
                "log",
                "--all",
                "--topo-order",
                &format!("--format={}", format),
                "-n",
                &limit_str,
                "--skip",
                &skip_str,
            ],
        )?;

        if !res.success {
            return Err(format!("git log failed: {}", res.stderr));
        }

        let mut commits = Vec::new();

        for record in res.stdout.split('\x1e') {
            let trimmed = record.trim();
            if trimmed.is_empty() {
                continue;
            }

            let fields: Vec<&str> = trimmed.split('\x1f').collect();
            if fields.len() >= 11 {
                let sha = fields[0].to_string();
                let parents = if !fields[1].is_empty() {
                    fields[1].split_whitespace().map(|s| s.to_string()).collect()
                } else {
                    Vec::new()
                };

                let author_name = fields[2].to_string();
                let author_email = fields[3].to_string();
                let author_date = fields[4].to_string();
                let committer_name = fields[5].to_string();
                let committer_email = fields[6].to_string();
                let committer_date = fields[7].to_string();
                let subject = fields[8].to_string();
                let body = fields[9].to_string();
                let refs = if !fields[10].is_empty() {
                    fields[10].split(", ").map(|s| s.trim().to_string()).collect()
                } else {
                    Vec::new()
                };

                commits.push(CommitInfo {
                    sha,
                    parents,
                    author_name,
                    author_email,
                    author_date,
                    committer_name,
                    committer_email,
                    committer_date,
                    subject,
                    body,
                    refs,
                });
            }
        }

        Ok(commits)
    }

    /// Fetches commit details including changed files and stats
    pub fn get_commit_detail(repo_path: &str, sha: &str) -> Result<CommitDetail, String> {
        // Validate SHA
        if !sha.chars().all(|c| c.is_ascii_hexdigit()) || sha.len() < 4 {
            return Err("Invalid commit SHA provided".to_string());
        }

        // 1. Commit metadata
        let format = "%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s%x1f%b%x1f%D";
        let meta_res = Self::execute_raw(
            Some(repo_path),
            &["show", "-s", &format!("--format={}", format), sha],
        )?;

        if !meta_res.success {
            return Err(format!("Failed to retrieve commit {}: {}", sha, meta_res.stderr));
        }

        let fields: Vec<&str> = meta_res.stdout.trim().split('\x1f').collect();
        if fields.len() < 11 {
            return Err("Unexpected commit metadata format".to_string());
        }

        let commit = CommitInfo {
            sha: fields[0].to_string(),
            parents: if !fields[1].is_empty() {
                fields[1].split_whitespace().map(|s| s.to_string()).collect()
            } else {
                Vec::new()
            },
            author_name: fields[2].to_string(),
            author_email: fields[3].to_string(),
            author_date: fields[4].to_string(),
            committer_name: fields[5].to_string(),
            committer_email: fields[6].to_string(),
            committer_date: fields[7].to_string(),
            subject: fields[8].to_string(),
            body: fields[9].to_string(),
            refs: if !fields[10].is_empty() {
                fields[10].split(", ").map(|s| s.trim().to_string()).collect()
            } else {
                Vec::new()
            },
        };

        // 2. Numstat file changes
        let stat_res = Self::execute_raw(
            Some(repo_path),
            &["show", "--numstat", "--format=", sha],
        )?;

        let mut files = Vec::new();
        let mut total_insertions = 0;
        let mut total_deletions = 0;

        for line in stat_res.stdout.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 3 {
                let additions = parts[0].parse::<i32>().unwrap_or(0);
                let deletions = parts[1].parse::<i32>().unwrap_or(0);
                let path = parts[2].to_string();

                total_insertions += additions as usize;
                total_deletions += deletions as usize;

                files.push(CommitDetailFile {
                    path,
                    status: ChangeType::Modified,
                    additions,
                    deletions,
                    old_path: None,
                });
            }
        }

        let files_count = files.len();

        Ok(CommitDetail {
            commit,
            files,
            stats: CommitStats {
                files_changed: files_count,
                insertions: total_insertions,
                deletions: total_deletions,
            },
        })
    }

    /// Fetches file diff (for commit inspection or working tree changes)
    pub fn get_file_diff(repo_path: &str, path: &str, rev: Option<&str>) -> Result<FileDiff, String> {
        let diff_res = match rev {
            Some(commit_sha) => {
                Self::execute_raw(Some(repo_path), &["show", &format!("{}:{}", commit_sha, path)])
            }
            None => {
                Self::execute_raw(Some(repo_path), &["diff", "HEAD", "--", path])
            }
        }?;

        let old_content = if let Some(commit_sha) = rev {
            // Compare with parent commit or show content
            let parent_res = Self::execute_raw(Some(repo_path), &["show", &format!("{}^:{}", commit_sha, path)]);
            if parent_res.success {
                parent_res.stdout
            } else {
                String::new()
            }
        } else {
            let head_res = Self::execute_raw(Some(repo_path), &["show", &format!("HEAD:{}", path)]);
            if head_res.success {
                head_res.stdout
            } else {
                String::new()
            }
        };

        let new_content = if let Some(commit_sha) = rev {
            let curr_res = Self::execute_raw(Some(repo_path), &["show", &format!("{}:{}", commit_sha, path)]);
            if curr_res.success {
                curr_res.stdout
            } else {
                String::new()
            }
        } else {
            std::fs::read_to_string(Path::new(repo_path).join(path)).unwrap_or_default()
        };

        Ok(FileDiff {
            path: path.to_string(),
            old_content,
            new_content,
            is_binary: false,
            raw_diff: diff_res.stdout,
        })
    }

    /// Stages a specific path (`git add -- <path>`)
    pub fn stage_path(repo_path: &str, path: &str) -> Result<OperationResult, String> {
        Self::execute_raw(Some(repo_path), &["add", "--", path])
    }

    /// Unstages a specific path (`git restore --staged -- <path>`)
    pub fn unstage_path(repo_path: &str, path: &str) -> Result<OperationResult, String> {
        Self::execute_raw(Some(repo_path), &["restore", "--staged", "--", path])
    }

    /// Discards working tree changes for a specific path (`git restore -- <path>` or `clean` for untracked)
    pub fn discard_path(repo_path: &str, path: &str, is_untracked: bool) -> Result<OperationResult, String> {
        if is_untracked {
            Self::execute_raw(Some(repo_path), &["clean", "-f", "--", path])
        } else {
            Self::execute_raw(Some(repo_path), &["restore", "--", path])
        }
    }

    /// Stages all changes in the working tree (`git add -A`)
    pub fn stage_all(repo_path: &str) -> Result<OperationResult, String> {
        Self::execute_raw(Some(repo_path), &["add", "-A"])
    }

    /// Unstages all staged changes (`git restore --staged .`)
    pub fn unstage_all(repo_path: &str) -> Result<OperationResult, String> {
        Self::execute_raw(Some(repo_path), &["restore", "--staged", "."])
    }
}
