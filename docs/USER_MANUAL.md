# Git Workbench — User Manual & Operational Guide (v1.0.0)

Git Workbench is a **100% local-first desktop application** designed for developers, engineering leads, and security professionals who need high transparency, precision control, and defense-in-depth safety when interacting with Git repositories.

---

## 1. Core Architecture & Safety Principles

1. **Purely Local-First**: No telemetry, no third-party tracking, and no external cloud servers. All credentials and source code remain on your machine.
2. **Real Child Process Execution**: Every Git operation is executed as a tokenized `git` child process (`std::process::Command` in Rust / `execFile` in the server adapter). Shell strings and shell interpreters are strictly forbidden, eliminating command injection vulnerabilities.
3. **Five-Tier Risk Classification System**:
   - **Level 0 (Read-Only)**: `git log`, `git status`, `git diff`, commit graph layout. Runs automatically with zero risk.
   - **Level 1 (Easily Reversible)**: `git add`, `git restore --staged`, standard commits, branch switches. Easily undoable.
   - **Level 2 (Local History Rewrite)**: `commit --amend`, local interactive rebases, author date rewrites. Requires preview + confirmation + automatic pre-operation safety branch creation.
   - **Level 3 (Destructive / Published)**: `reset --hard`, `clean -fd`, force-push (`--force-with-lease`). Requires mandatory pre-op backup + two-step confirmation dialog.
   - **Level 4 (History Purge / Filter-Repo)**: Eradicating secrets, large blobs, or AI co-author trailers across entire repository history. Executed **strictly in an isolated temporary mirror clone** (`git clone --mirror`) with mandatory `.bundle` backup and typed confirmation string.

---

## 2. Navigating the Workbench Views

### A. Working Tree & Daily Operations
- **File Diffing**: Side-by-side Monaco diff viewer showing staged and unstaged working tree alterations.
- **Selective Staging**: Stage/unstage individual files, discard untracked or modified files, or stage all files in a single click.
- **Commit Composer**: Create conventional commits or amend HEAD with optional custom author, committer, and timestamps.
- **Stash Management**: Create named stashes, pop, apply, view stash diffs, or drop unwanted stashes.

### B. Topological Commit Graph
- High-performance visual commit graph showing multiple branch heads, merges, remotes, and tags.
- Direct commit inspection with stats (+/- lines), commit metadata, and per-file diff drilldown.
- Contextual power tools: Interactive Rebase from commit, Cherry-Pick, Revert, and Soft/Mixed/Hard Reset.

### C. Reflog & Emergency Recovery
- Browse `git reflog` entries across all branches and HEAD movements.
- Recover "lost" or orphaned commits caused by reset or rebase.
- One-click restore to any reflog state with automatic safety branch creation.

### D. Linked Worktrees
- Create, list, switch, and prune linked Git worktrees (`git worktree add`, `git worktree list`, `git worktree prune`).
- Work on multiple branches concurrently in separate directories without switching your main working directory.

### E. Safety Engine & History Purge Wizard
- **Git fsck Integrity**: Run full object store scans (`git fsck --full`) to detect corruptions, dangling blobs, and unreferenced commits.
- **Secret Leaks Scanner**: Scan commit histories for high-risk API keys (OpenAI, Anthropic, AWS, GitHub PATs, Slack, SSH keys) with redacted previews.
- **Large Blobs Scanner**: Detect objects > 500 KB bloating packfiles and history.
- **Verifiable AI-Trace Audit**: Identify verifiable commit trailers (`Co-authored-by: Claude`, `Claude-Session: <url>`) and AI configuration files.
- **7-Step Isolated Mirror Purge Wizard**: Safely eradicate files, secrets, or author identities without risking working tree corruption.
- **Proactive Guard Rails**: One-click installation of `commit-msg` hooks (strip or reject AI trailers), `pre-commit` secret scanners, and `.gitignore` rule assistants.
- **Isolated Aggressive GC**: Independent, manual trigger for `git gc --prune=now --aggressive` requiring explicit typed confirmation (`PRUNE NOW`).

---

## 3. Desktop Packaging & Distribution

Built with **Tauri 2**:
- **Windows**: Build `.msi` or `.exe` via `npm run tauri:build`.
- **macOS**: Build `.dmg` bundles with notarization support.
- **Linux**: Build `.deb` or `.AppImage` packages.
