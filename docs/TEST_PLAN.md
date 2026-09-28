# Test Plan & Quality Assurance Strategy

> **Status:** Initial Draft (Phase 0)  
> **Notice:** This document defines the verification strategy for Git Workbench across all implementation phases. It begins as a manual test checklist in Phase 0 and expands into automated Rust and React integration tests through Phase 5.

---

## 1. Quality Strategy by Phase

| Phase | Test Scope | Verification Method |
|---|---|---|
| **Phase 0** | Shell scaffolding, theme toggling, Git availability check, code quality tooling | Manual checklist + `npm run check:all` + `cargo check` |
| **Phase 1** | Read-only repository explorer, topological graph layout, commit detail, diffs | Test repositories (small, medium, 500+ commits) + performance benchmarking (<200ms graph render) |
| **Phase 2** | Staging, committing, branch switching, safe push/pull, stash | Automated temporary Git repository fixtures + interactive conflict resolution checks |
| **Phase 3** | Interactive rebase sequencer, cherry-pick, reflog recovery, worktrees | Complex multi-branch conflict fixtures + undo/recovery validation |
| **Phase 4** | Automated backup engine, mirror clone isolation, filter-repo, AI-trace audit | Dedicated test sandbox containing intentional dummy secrets, large files, and trailer artifacts |
| **Phase 5** | Cross-platform desktop bundling, regression testing, binary launch verification | Clean environment installer tests on Linux, macOS, and Windows |

---

## 2. Phase 0 Test Checklist

### 2.1 Code Quality & Static Analysis
- [x] Run `npm run lint` — ESLint and TypeScript compilation pass with 0 errors.
- [x] Run `npm run format:check` — Prettier formatting check passes on all source files.
- [x] Run `npm run check:all` — Unified check succeeds.
- [x] Verify `src-tauri/Cargo.toml` and Rust source files (`main.rs`, `models.rs`, `commands/`, `git/`, `safety/`) are structurally valid and formatted according to `rustfmt.toml`.

### 2.2 Application Shell & Visual UI
- [x] Application displays title **"Git Workbench"** in the top navigation bar.
- [x] Professional empty-state card is centered, indicating **"Phase 0 — Application Shell Ready"**.
- [x] Subtitle explains: *"Repository features will be introduced in Phase 1."*
- [x] Theme toggle works between Dark and Light mode.
- [x] Theme selection persists in `localStorage` across page reloads.
- [x] UI respects responsive boundaries and touch/click ergonomics.

### 2.3 Safe Git Availability Check
- [x] Rust command `get_git_availability` executes strictly `git --version` without invoking a shell.
- [x] Returns a typed `GitAvailability` struct (`available: bool`, `version: Option<String>`, `error: Option<String>`).
- [x] Frontend status badge reflects detected version (e.g. `git version 2.43.0` or system equivalent).
- [x] Graceful fallback / guidance message displays if Git is absent from system PATH.
- [x] Zero other Git operations are executed in this phase.

---

## 3. Phase 4 Test Checklist (Automated Safety, Backups & History Purging)

### 3.1 Repository Integrity & Fsck
- [x] `runGitFsck` executes strict `git fsck --full`.
- [x] Accurately parses error counts, warnings, dangling blobs, and unreferenced commits.
- [x] Presents object store health status badge with raw output inspection.

### 3.2 Automated Backups & Offline Bundles
- [x] `createBackup` supports lightweight branch restore points (`backup/pre-<reason>-<timestamp>`).
- [x] `createBackup` supports full offline repository bundles (`git bundle create --all`).
- [x] Bundles and restore points listed in UI with one-click path copying and size metadata.

### 3.3 Security & Secret Audit
- [x] Automated scanning of commit diffs for high-risk tokens (OpenAI, Anthropic, GitHub PAT, AWS keys, Slack tokens, private keys).
- [x] Redacted match previews preventing secret disclosure in the UI.
- [x] Scan object store for large blobs (> 500 KB) bloating git history.
- [x] Detect verifiable AI commit trailers (`Co-authored-by: Claude/ChatGPT/Copilot`, `.cursorrules`).

### 3.4 Seven-Step Safe History Purge Wizard (Level 4)
- [x] Enforces strict isolation: rewrites take place exclusively in an isolated temporary mirror clone (`git clone --mirror`).
- [x] Automatically generates an offline `.bundle` backup before initiating any history purge.
- [x] Requires typed confirmation (`PERMANENTLY PURGE HISTORY`) to prevent accidental clicks.
- [x] Runs `git fsck --full` automatically post-rewrite to verify repository structural integrity.
- [x] Provides an independent, explicit, user-initiated push step with team coordination guidelines.

### 3.5 Proactive Guard Rails & Maintenance (Phase 4 Hardening)
- [x] Defense-in-depth `commit-msg` hook installation supporting auto-strip or strict reject of AI commit trailers.
- [x] Pre-commit hook installation preventing staged high-risk secrets and warning on &gt; 500 KB blobs.
- [x] `.gitignore` assistant adding `.cursor/`, `.cursorrules`, `.claude/`, `.cline/` to protect local workspace trees.
- [x] Isolated manual trigger for `git gc --prune=now --aggressive` with typed confirmation string `PRUNE NOW` (never automated per SAFETY_POLICY.md).

### 3.6 AI Artefact Cleanup & Controlled History Rewrite Verification
- [x] **Working-Tree Cleanup:** Line-level preview, minimal diff edits, and in-memory rollback undo.
- [x] **Human Attribution Protection:** Human `Co-authored-by:` and compliance licenses cannot be selected or deleted.
- [x] **HEAD Commit Amend:** AI trailer removal, new commit SHA creation, and backup ref creation (`refs/heads/backup/pre-ai-cleanup-amend/<timestamp>`).
- [x] **Isolated Mirror Rewrite:** History rewrite executes strictly in segregated mirror clone without touching active working repo.
- [x] **Bundle Backup Integrity:** Verified standard Git bundle backup created before filter application.
- [x] **Double Confirmation Guardrails:** First confirmation requires 5 checkboxes + typed `REWRITE SELECTED HISTORY`; second confirmation requires 6 checkboxes + typed `PUBLISH REWRITTEN HISTORY TO <REMOTE_NAME>`.
- [x] **Controlled Remote Publish:** Gated on validated mirror rewrite; strictly uses `git push --force-with-lease`.
- [x] **Post-Publish Checklist:** Interactive checklist with local Markdown export for collaborator coordination.

---

## 4. Phase 5 Test Checklist (Packaging, Hardening & Distribution)

### 4.1 Architecture Invariants & Local-First Verification
- [x] Zero external network telemetry calls or background automated remote network polling.
- [x] Process execution strictly uses tokenized child arguments (`std::process::Command` / `execFile`) with zero shell injection vectors.
- [x] Strict allowlist validation across all 5 risk tiers (Level 0 through Level 4).
- [x] System Audit modal displays real-time architecture compliance, runtime versions, and packaging readiness.

### 4.2 Application Packaging & Versioning
- [x] Semantic version bumped to `1.0.0` across `package.json`, `Cargo.toml`, and `tauri.conf.json`.
- [x] Multi-platform packaging targets configured for Windows (`.msi`, `.exe`), macOS (`.dmg`), and Linux (`.deb`, `.AppImage`).
- [x] User manual and operational guide documented in `/docs/USER_MANUAL.md`.
- [x] Build and lint validations (`npm run lint`, `compile_applet`) succeed cleanly with zero warnings or errors.
