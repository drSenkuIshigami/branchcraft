# Command Allowlist & Execution Policy

> **Status:** Active Standard (Phase 0)  
> **Notice:** This document defines the exhaustive list of Git subcommands and argument validation patterns permitted in Git Workbench. Any command not explicitly listed here is prohibited by the Rust Git adapter.

---

## 1. Architectural Rules of Execution

1. **Zero Shell Usage:** Every Git command is invoked via `std::process::Command::new("git")` with arguments passed as separate strings (`.arg()` or `.args()`). Never use `/bin/sh`, `bash -c`, or `cmd.exe /c`.
2. **Strict Argument Validation:** Parameters such as branch names, paths, and commit hashes are sanitized and validated against safe regex patterns before process invocation.
3. **No Dynamic CLI String Construction:** The frontend can never send an arbitrary command line to be executed. The frontend invokes a specific Rust IPC function which maps strictly to an allowlisted command pattern.
4. **Tokenized Logging:** The executed token vector is recorded in the `OperationResult` structure to provide complete transparency in the audit log without exposing sensitive credential tokens.

---

## 2. Argument Validation Standards

- **Commit SHAs:** `^[0-9a-fA-F]{4,64}$`
- **Branch / Ref Names:** Must comply with `git check-ref-format` rules; disallows leading dashes, null bytes, `..`, `~`, `^`, `:`, `?`, `*`, `[`, `\`, and trailing `.lock`.
- **File Paths:** Relative to repository root; path traversal patterns (`..`) outside worktree bounds are rejected.

---

## 3. Allowed Git Subcommands by Phase

### Phase 0
| Subcommand | Pattern | Purpose |
|---|---|---|
| `version` | `["--version"]` | System PATH availability check |

### Phase 1 (Repository Explorer)
| Subcommand | Pattern | Purpose |
|---|---|---|
| `rev-parse` | `["rev-parse", "--is-inside-work-tree"]` | Validate repository root |
| `status` | `["status", "--porcelain=v2", "--branch", "--untracked-files=all"]` | Query index & tree state |
| `for-each-ref` | `["for-each-ref", "--format=...", "refs/heads/", "refs/remotes/"]` | List all branches |
| `remote` | `["remote", "-v"]` | List configured remotes |
| `log` | `["log", "--all", "--topo-order", "--pretty=format:..."]` | Fetch graph data |
| `show` | `["show", "--stat", "--patch", "<sha>"]` | Inspect commit details |
| `diff` | `["diff", "--", "<path>"]` | Working tree vs index diff |
| `diff-tree` | `["diff-tree", "-r", "--no-commit-id", "--name-status", "<sha>"]` | Files modified in commit |
| `blame` | `["blame", "-w", "-L", "<range>", "--", "<path>"]` | File line attribution |

### Phase 2 (Daily Operations)
| Subcommand | Pattern | Purpose |
|---|---|---|
| `add` | `["add", "--", "<path>"]` | Stage file |
| `restore` | `["restore", "--staged", "--", "<path>"]` | Unstage file |
| `restore` | `["restore", "--", "<path>"]` | Discard working tree changes (preview required) |
| `commit` | `["commit", "-m", "<message>"]` | Create new commit |
| `commit --amend` | `["commit", "--amend", "-m", "<message>"]` | Amend HEAD message |
| `switch` | `["switch", "<branch>"]` / `["switch", "-c", "<branch>"]` | Switch or create branch |
| `branch -m` | `["branch", "-m", "<old>", "<new>"]` | Rename branch |
| `branch -d` | `["branch", "-d", "<branch>"]` | Delete merged branch |
| `fetch` | `["fetch", "--prune", "<remote>"]` | Fetch upstream changes |
| `push` | `["push", "--force-with-lease", "<remote>", "<branch>"]` | Safe upstream push |
| `stash` | `["stash", "push", "-m", "<message>"]`, `["stash", "pop"]`, `["stash", "list"]` | Stash management |

### Phase 3 (Power Tools)
| Subcommand | Pattern | Purpose |
|---|---|---|
| `rebase -i` | Controlled via sequencer todo script | Visual interactive rebase |
| `cherry-pick` | `["cherry-pick", "<sha>"]` | Apply specific commit |
| `revert` | `["revert", "<sha>"]` / `["revert", "-m", "1", "<sha>"]` | Revert commit |
| `reset` | `["reset", "--soft"\|"--mixed"\|"--hard", "<target>"]` | Reset HEAD pointer |
| `worktree` | `["worktree", "add"\|"list"\|"remove", ...]` | Worktree management |
| `bisect` | `["bisect", "start"\|"good"\|"bad"\|"reset"]` | Binary search regression |
| `reflog` | `["reflog", "show", "-n", "<limit>"]` | Audit and recovery |

### Phase 4 (History Rewrites & Safety)
| Subcommand | Pattern | Purpose |
|---|---|---|
| `bundle` | `["bundle", "create", "<file>", "--all"]` | Full repository offline backup |
| `clean` | `["clean", "-nd"]` (dry-run) / `["clean", "-fd"]` (confirmed) | Clean untracked files |
| `filter-repo` | Via separate process in mirror clone only | Secret and path purging |

---

## 4. Forbidden Commands & Flags

The following are strictly blocked by the adapter architecture:
- Arbitrary shell piping (`|`, `&&`, `;`, `>`).
- Raw `git push --force` without explicit multi-step override (default is `--force-with-lease`).
- Automated background `git gc --prune=now --aggressive` without dedicated explicit user confirmation.
- Modifying hooks or config outside defined local safety hooks (`commit-msg`).
