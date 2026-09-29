# Command Allowlist & Execution Policy

> **Status:** Active Standard  
> **Notice:** This document defines the exhaustive list of Git subcommands and argument validation patterns permitted in Git Workbench under the User-Controlled Safety Policy.

---

## 1. Architectural Rules of Execution

1. **Zero Shell Usage:** Every Git command is invoked directly via process execution (`execFile` / `Command::new("git")`) with arguments passed as separate token arrays (`args: string[]`). Never use `/bin/sh`, `bash -c`, or `cmd.exe /c`.
2. **Strict Argument Validation:** Parameters such as branch names, paths, and commit hashes are sanitized and validated against safe regex patterns before process invocation.
3. **No Shell Injections:** "No feature restrictions" does not mean allowing command injection. Arbitrary shell strings, pipes (`|`), shell metacharacters (`&&`, `;`, `>`), and untyped raw shell commands are strictly forbidden. All operations remain strongly typed and routed through validated argument arrays.
4. **Tokenized Logging:** The executed token vector is recorded in the `OperationResult` structure to provide complete transparency in the audit log without exposing sensitive credential tokens.
5. **No Downgrades:** Operations selected by the user are executed exactly as confirmed (e.g. `--force` executes `--force`, not downgraded to `--force-with-lease`).

---

## 2. Argument Validation Standards

- **Commit SHAs:** `^[0-9a-fA-F]{4,64}$`
- **Branch / Ref Names:** Must comply with `git check-ref-format` rules; disallows leading dashes, null bytes, `..`, `~`, `^`, `:`, `?`, `*`, `[`, `\`, and trailing `.lock`.
- **File Paths:** Relative to repository root; path traversal patterns (`..`) outside worktree bounds are rejected.

---

## 3. Allowed Git Subcommands

| Subcommand | Tokenized Arguments Pattern | Warning Level | Purpose |
|---|---|:---:|---|
| `version` | `["--version"]` | 0 | System PATH availability check |
| `status` | `["status", "--porcelain=v2", "--branch", "--untracked-files=all"]` | 0 | Query index & tree state |
| `log` | `["log", "--all", "--topo-order", ...]` | 0 | Fetch graph data |
| `show` | `["show", "--stat", "--patch", "<sha>"]` | 0 | Inspect commit details |
| `diff` | `["diff", "--", "<path>"]` | 0 | Working tree vs index diff |
| `blame` | `["blame", "-w", "-L", "<range>", "--", "<path>"]` | 0 | File line attribution |
| `add` | `["add", "--", "<path>"]` or `["add", "-A"]` | 1 | Stage changes |
| `restore` | `["restore", "--staged", "--", "<path>"]` | 1 | Unstage file |
| `restore` | `["restore", "--", "<path>"]` | 1 | Discard tracked file changes |
| `commit` | `["commit", "-m", "<message>"]` | 1 | Create new commit |
| `commit --amend`| `["commit", "--amend", ...]` | 2 | Amend latest commit (backup optional) |
| `switch` | `["switch", "<branch>"]` / `["switch", "-c", "<branch>"]` | 1 | Switch or create branch |
| `branch -m` | `["branch", "-m", "<old>", "<new>"]` | 1 | Rename branch |
| `branch -d` | `["branch", "-d", "<branch>"]` | 1 | Delete merged branch |
| `branch -D` | `["branch", "-D", "<branch>"]` | 3 | Force delete unmerged branch |
| `branch -f` | `["branch", "-f", "<branch>", "<target>"]` | 3 | Force relocate branch to target SHA |
| `fetch` | `["fetch", "--prune", "<remote>"]` | 0 | Fetch upstream changes |
| `push` | `["push", "<remote>", "<branch>"]` | 1 | Normal upstream push |
| `push --force-with-lease` | `["push", "--force-with-lease", "<remote>", "<branch>"]` | 2 | Safe force push (Recommended) |
| `push --force` | `["push", "--force", "<remote>", "<branch>"]` | 3 | Raw force push (Exact user choice) |
| `push --mirror` | `["push", "--mirror", "<remote>"]` | 3/4 | Mirror push to remote |
| `push --delete` | `["push", "<remote>", "--delete", "<ref>"]` | 3 | Delete remote branch or tag |
| `stash` | `["stash", "push", ...]` / `["stash", "pop"]` | 1 | Stash management |
| `reset --soft` | `["reset", "--soft", "<target>"]` | 2 | Soft reset |
| `reset --mixed`| `["reset", "--mixed", "<target>"]` | 2 | Mixed reset (preserve working files) |
| `reset --hard` | `["reset", "--hard", "<target>"]` | 3 | Hard reset (backup ref optional) |
| `clean -n` | `["clean", "-n", "-f", "-d", "-x"]` | 0 | Dry-run untracked clean preview |
| `clean -f` | `["clean", "-f", ...]` | 2 | Clean untracked files |
| `clean -fd` | `["clean", "-fd", ...]` | 3 | Clean untracked files & directories |
| `clean -fdx`| `["clean", "-fdx", ...]` | 3 | Clean untracked and ignored files |
| `cherry-pick` | `["cherry-pick", "<sha>"]` | 2 | Apply specific commit |
| `revert` | `["revert", "<sha>"]` | 2 | Revert commit |
| `rebase` | `["rebase", "-i", ...]` / sequencer | 2/3 | Rebase (including pushed branches) |
| `merge` | `["merge", "-X", "ours"\|"theirs", ...]` | 2 | Merge branch with strategy |
| `merge -s` | `["merge", "-s", "ours", ...]` | 2 | Discarding merge strategy |
| `gc` | `["gc"]` | 1 | Standard repository cleanup |
| `gc --prune=now` | `["gc", "--prune=now"]` | 2 | Aggressive pruning of loose objects |
| `gc --prune=now --aggressive` | `["gc", "--prune=now", "--aggressive"]` | 3 | Deep repack & permanent purge |
| `bundle` | `["bundle", "create"\|"verify", ...]` | 1 | Offline bundle backup |
| `filter-repo` | Via isolated mirror OR direct working copy | 4 | Complete history rewrite |
| `fsck` | `["fsck", "--full"]` | 0 | Cryptographic repository verification |

---

## 4. Forbidden Operations & Invariants

The following remain forbidden:
- Passing unvalidated strings to a shell command interpreter (`sh -c`, `bash -c`, `cmd.exe /c`, PowerShell strings).
- Allowing arbitrary user-supplied CLI injection flags (e.g. `--exec`, `--upload-pack`).
- Command injection vectors; all arguments must strictly match allowlisted token formats.
