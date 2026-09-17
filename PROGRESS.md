# Git Workbench — Implementation Progress

> **Primary Source of Truth:** `./git-workbench-implementation-plan.md`  
> **Status:** Phase 0 in progress. All later phases remain locked until Phase 0 acceptance.

---

## Progress Overview

| Phase | Description | Risk Level | Status |
|:---:|---|:---:|:---:|
| **Phase 0** | Project Setup & Design Documentation | Level 0 | **In Progress** |
| **Phase 1** | Repository Explorer (Read-only) | Level 0 | Pending Phase 0 Approval |
| **Phase 2** | Daily Operations | Level 0–1 | Pending Phase 1 |
| **Phase 3** | Power Tools (Rebase, Bisect, Worktree, Reflog) | Level 1–2 | Pending Phase 2 |
| **Phase 4** | Safety Engine, History Rewriting & AI-Trace Cleanup | Level 2–4 | Pending Phase 3 |
| **Phase 5** | Packaging, Integration Testing & Distribution | — | Pending Phase 4 |

---

## Phase 0 — Project Setup & Design Documentation

- [x] **Scaffold Tauri 2 Application**
  - [x] Configure Tauri 2 desktop shell (`src-tauri/Cargo.toml`, `build.rs`, `tauri.conf.json`, `capabilities/default.json`).
  - [x] Set project package name to `git-workbench` in `package.json`.
  - [x] Synchronize application title and metadata across `metadata.json` and `index.html`.
  - [x] Install `@tauri-apps/api` and `@tauri-apps/cli`.
- [x] **Folder Structure Scaffolding**
  - [x] `src-tauri/src/commands/` (modular IPC handlers).
  - [x] `src-tauri/src/git/` (Git CLI execution adapter).
  - [x] `src-tauri/src/safety/` (Risk classification and backup engine).
  - [x] `src/components/` (Reusable React components).
  - [x] `src/views/` (High-level application views).
  - [x] `src/ipc/` (Strongly typed Tauri invoke wrappers).
  - [x] `src/state/` (Application state & theme management).
  - [x] `docs/` (Core architectural specifications).
- [x] **Code Quality & Tooling Setup**
  - [x] ESLint configuration (`eslint.config.js`) supporting TypeScript and React.
  - [x] Prettier configuration (`.prettierrc`, `.prettierignore`) and code formatting.
  - [x] Rust code quality readiness (`src-tauri/rustfmt.toml`, `src-tauri/clippy.toml`).
  - [x] Useful npm quality scripts (`lint`, `lint:fix`, `format`, `format:check`, `check:all`, `cargo:check`, `cargo:clippy`, `cargo:fmt`).
- [x] **Design Documentation (`docs/`)**
  - [x] `docs/DATA_MODEL.md` (Core shared entities and serialization rules).
  - [x] `docs/IPC_CONTRACT.md` (Tauri IPC commands, typing, parameters, return values, risk levels).
  - [x] `docs/COMMAND_ALLOWLIST.md` (Permitted Git subcommands, tokenized arguments, regex validation).
  - [x] `docs/SAFETY_POLICY.md` (5-tier risk model, automatic backups, runbook, network explicitness).
  - [x] `docs/TEST_PLAN.md` (Quality assurance matrix, manual checklists, automated test strategy).
- [x] **Progress Tracking**
  - [x] Create `PROGRESS.md` in root with comprehensive phase checklists.
- [x] **Minimal Clean Application Shell** (Step 6)
  - [x] App header with title `Git Workbench` and local desktop badge.
  - [x] Dark/Light theme toggle persisted in `localStorage`.
  - [x] Professional empty-state screen ("Phase 0 — Application shell is ready", "Repository features will be introduced in Phase 1.").
  - [x] Strict absence of fake Git data, mock repositories, or command log UI.
- [ ] **Safe Git Installation Check** (Step 7)
  - [ ] Rust IPC command `get_git_availability` executing strictly `git --version` via `std::process::Command`.
  - [ ] Never invoke a shell (`sh`, `bash`, `cmd`).
  - [ ] Return typed `GitAvailability` (`available: bool`, `version: Option<String>`, `error: Option<String>`).
  - [ ] Frontend non-blocking status badge showing detected version or installation notice.
  - [ ] Zero execution of any other Git command in Phase 0.
- [ ] **Secure Architecture Conventions** (Step 8)
  - [ ] Minimal Rust module placeholders for `commands`, `git`, and `safety`.
  - [ ] Explicit documentation that all future Git operations must route through typed allowlisted adapter.
  - [ ] No generic shell execution or arbitrary execution privileges.
  - [ ] All destructive-operation logic strictly deferred to Phase 4.

---

## Phase 1 — Repository Explorer (Read-Only, Level 0)

- [ ] Native folder picker dialog (`pick_folder`).
- [ ] Repository validation (`git rev-parse --is-inside-work-tree`).
- [ ] Summary repository status (current branch, upstream, ahead/behind, modified count).
- [ ] Branch listing (local and remote tracking branches) and remotes (`git for-each-ref`, `git remote -v`).
- [ ] Custom topological commit graph:
  - [ ] Parse `git log --all --topo-order --pretty=format:...`.
  - [ ] Dedicated lane assignment algorithm.
  - [ ] Canvas rendering with virtualized rows (`@tanstack/react-virtual`).
- [ ] Commit history list with author, date, message, and ref tags.
- [ ] Commit inspection: modified file list and file diffs using Monaco Diff Editor.
- [ ] File history and blame view (`git blame -w`, `git log --follow`).
- [ ] Commit search (by message, author, SHA, file path).
- [ ] Read-only working tree and staging area visualization.

---

## Phase 2 — Daily Operations (Level 0–1)

- [ ] Interactive staging/unstaging of individual files (`git add`, `git restore --staged`).
- [ ] Interactive hunk staging and discarding (`git apply --cached`).
- [ ] Discard file/hunk with mandatory pre-execution preview.
- [ ] Commit creation with commit message validation (length warnings, format checks).
- [ ] Amend latest commit (`git commit --amend`).
- [ ] Branch management: create from any commit, switch, rename, safe delete (`git branch -d`).
- [ ] Remote synchronization:
  - [ ] Fetch with prune (`git fetch --prune`).
  - [ ] Pull with status comparison.
  - [ ] Push with safe default `--force-with-lease` (never raw `--force`).
- [ ] Stash management: list, create with message/file selection, apply, pop, drop.
- [ ] Standard merge/rebase conflict resolution workflow (conflicted files list, external editor/mergetool trigger, continue/abort).
- [ ] File restoration from historical commit (`checkout <sha> -- <path>`).
- [ ] Working tree hard reset to HEAD with explicit confirmation warning.
- [ ] Open system terminal or file manager at repository root.
- [ ] Explicit sync status indicator comparing local and upstream tracking branches.

---

## 3 — Power Tools (Level 1–2)

- [ ] Visual interactive rebase:
  - [ ] Interactive commit list with reordering and action selection (`pick`, `reword`, `edit`, `squash`, `fixup`, `drop`, `exec`).
  - [ ] Automatic pause on conflicts with continue/abort/skip controls.
- [ ] Commit author date/timestamp modification.
- [ ] Cherry-pick workflow with conflict guidance.
- [ ] Revert workflow (including mainline selection `-m 1` for merge commits).
- [ ] Reset dialog with soft, mixed, and hard modes + precise explanatory impact preview.
- [ ] Annotated tag creation, remote push, and deletion.
- [ ] Worktree manager (list, add, remove).
- [ ] Submodule dashboard (status, sync, recursive update).
- [ ] Interactive Git bisect wizard (start, mark good/bad, pinpoint culprit commit, reset).
- [ ] Reflog viewer with historical recovery wizard (restore dropped commits or branches).
- [ ] `rerere` activation and state inspection.
- [ ] `range-diff` viewer for before/after rebase comparisons.
- [ ] Strict UI differentiation between `merge -X ours/theirs` and `merge -s ours`.
- [ ] Branch pointer force relocation (`branch -f`) with lost-commit preview.
- [ ] Git LFS diagnostics (tracked files, lock status).

---

## Phase 4 — Safety Engine, History Rewriting & Sensitive Data Purge (Level 2–4)

- [ ] **Safety & Backup Core Engine:**
  - [ ] Automated pre-operation backup ref creation (`backup/pre-<op>-<timestamp>`).
  - [ ] Offline Git bundle backup generation (`git bundle create --all`).
  - [ ] Comprehensive audit log tracking every executed command token, timestamp, and result.
  - [ ] Mandatory dry-run previews for `clean`, `filter-repo`, and large rebases.
  - [ ] Two-step confirmation for Level 3; typed confirmation string for Level 4.
- [ ] **Dedicated Wizards:**
  - [ ] **File & Directory History Purge Wizard:** Executed strictly in an isolated mirror clone (`git clone --mirror`); explicit decoupled push step.
  - [ ] **Author / Committer History Rewrite Wizard:** `rebase -i` for recent commits (Level 2); `filter-repo` with mapping table for entire history (Level 4).
  - [ ] **Secret Removal Wizard:**
    - Mandatory Step 1: "Revoke and rotate credentials immediately" checklist.
    - Identification of secret introduction points.
    - Purge via `git filter-repo`.
    - Controlled push with team coordination checklist.
  - [ ] **AI-Trace Defensible Cleanup Wizard:**
    - Identifiable artifact search (commit trailers, known tool config files, generated strings).
    - User review and item-by-item selection before any modification.
    - Local `commit-msg` hook installation for proactive prevention.
    - `.gitignore` assistant for development environment directories (`.cursor/`, `.claude/`, etc.).
  - [ ] **Pre-Commit Secret & Large File Scanner:** Configurable pattern scanner with Git LFS recommendation.
  - [ ] **Isolated `git gc --prune=now --aggressive` Action:** Distinct, standalone manual trigger with irreversible operation warning (never automated).

---

## Phase 5 — Packaging, Integration Testing & Distribution

- [ ] Cross-platform integration tests across real repositories (small, 500+ commits, submodule, LFS).
- [ ] Comprehensive automated test suites (`cargo test` on Git adapter, React component unit tests).
- [ ] Tauri application bundles:
  - [ ] Windows installer (`.msi`, `.exe`).
  - [ ] macOS bundle (`.dmg` with notarization readiness).
  - [ ] Linux packages (`.deb`, `.AppImage`).
- [ ] End-user documentation and screenshot manual.
- [ ] Final security audit (strictly local process bindings, zero telemetry, no embedded secrets).
- [ ] Semantic versioning release (`v1.0.0`).
