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

## 3. Future Automated Test Plan (Phase 5 Readiness)

### Rust Backend Tests (`cargo test`)
- Unit tests for command argument validation against allowlist regexes.
- Unit tests for porcelain output parsers (`git status --porcelain=v2`, `git log`).
- Fixture-based tests generating isolated temporary repositories in temp directories.

### Frontend Component Tests
- Virtualized commit graph row rendering benchmarks.
- Theme switching state tests.
- Form validation tests for branch creation and commit message length warnings.
