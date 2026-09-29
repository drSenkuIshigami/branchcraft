# Git Workbench — User-Controlled Safety Policy
# Warning, Informed Consent, and Full Git Capability

> **Status:** Active Standard  
> **Notice:** This document defines the User-Controlled Safety & Warning Model for Git Workbench.

---

## 1. Product Philosophy

> **“No feature restriction. Full Git capability with clear risk warnings, effect previews where feasible, explicit informed user consent, and complete local audit visibility.”**

The application must **not** block a technically valid Git operation solely because it is dangerous, destructive, uncommon, advanced, history-rewriting, remote-rewriting, or likely to affect collaborators.

**The user is the final decision-maker.**

The application must explain risks clearly and obtain confirmation, but after the required confirmation it must execute the **exact user-selected supported Git operation**.

Do not replace a requested operation with a safer alternative unless the user explicitly chooses that alternative:

- If the user selects `git push --force`, do not silently replace it with `--force-with-lease`.
- If the user selects `git push --mirror`, do not downgrade it to a normal push.
- If the user selects `git reset --hard`, do not convert it to soft/mixed reset.
- If the user selects a history rewrite, do not refuse solely because the branch appears shared or published.
- If the user selects removal of an untracked file, do not force a backup instead.
- If the user explicitly selects permanent deletion, perform permanent deletion after the appropriate warning and confirmation.

The UI distinguishes **“recommended safe option”** from **“requested exact option.”**

The application may recommend `--force-with-lease`, backup, mirror clone, bundle backup, or isolated rewrite workspace, but it must never make them the only possible path unless a technical constraint makes the requested operation impossible.

---

## 2. Absolute Capability Boundary

Git Workbench supports all planned Git operations, including advanced and destructive operations:

- `git reset --soft`
- `git reset --mixed`
- `git reset --hard`
- `git clean -f`
- `git clean -fd`
- `git clean -fdx`
- branch deletion with `git branch -D`
- branch movement with `git branch -f`
- amend (`git commit --amend`)
- interactive rebase
- rebase of previously pushed branches
- cherry-pick
- revert
- merge strategy selection (`-X ours`, `-X theirs`, `-s ours`)
- force push with:
  - normal push
  - `--force-with-lease` (Recommended safe option)
  - raw `--force`
  - `--mirror`
- remote branch and tag deletion (`git push <remote> --delete <ref>`)
- `git filter-repo` / history rewrite
- history-wide message rewrite
- history-wide author/email rewrite
- path removal from full Git history
- direct working-copy rewrite only if user explicitly selects it
- isolated mirror-clone rewrite workflow
- bundle backup creation or intentional operation without backup
- `git gc`
- `git gc --prune=now`
- `git gc --prune=now --aggressive`

The application must not hide these operations because they are risky.

### Safe Execution Invariants:
- Every operation remains typed and allowlisted.
- The frontend may never pass arbitrary shell strings.
- The backend may never use `sh -c`, `cmd.exe /c`, PowerShell command strings, or equivalent shell execution.
- Git arguments must still be passed as validated argument arrays.
- “No restrictions” does not mean “allow command injection.”

---

## 3. Warning Levels Model

Product language uses **Warning Level** instead of restrictive "Risk Level".
Warning levels do not deny functionality. They control:
- warning severity,
- preview detail,
- confirmation wording,
- whether one or two confirmations are requested,
- whether backup/recovery options are offered,
- audit-log detail,
- post-operation recovery guidance.

They do **NOT** determine whether an operation is allowed.

| Warning Level | Meaning | Product Behavior |
|:---:|---|---|
| **0** | **Read-only / informational** | Execute immediately; show in activity/command log. |
| **1** | **Normal state change** | Explain effect; normal confirmation where useful. |
| **2** | **Local history/state change** | Show effect preview; single explicit confirmation. Backup offered where applicable. |
| **3** | **Destructive or remote-impacting** | Strong warning; show preview/dry-run where available; explicit confirmation checkboxes. |
| **4** | **Repository-wide / history-rewrite / permanent** | Critical warning; detailed impact list; typed confirmation; separate remote publication confirmation if applicable. |

No warning level may produce an automatic “operation blocked” result merely due to risk classification.

### Valid Refusal Cases:
The only valid refusal cases are technical or authorization failures:
- Git executable is unavailable.
- Repository is invalid or inaccessible.
- Required user input is invalid.
- A requested Git subcommand is not yet implemented.
- A Git operation is already in progress and Git itself cannot safely proceed (e.g. merge/rebase in progress).
- Filesystem permission is denied.
- Required dependency is absent (e.g. `git-filter-repo`).
- The user cancelled confirmation.
- Git CLI itself rejects the operation (e.g. non-fast-forward push rejected by remote without force, or branch check-out constraint).
- Network/authentication is unavailable for a requested remote operation.

If the tool cannot perform an operation, state the concrete technical reason. Do not present a policy preference as a technical impossibility.

---

## 4. User Choice Model

For any operation with meaningful safety implications, the UI presents:

1. **Requested operation**: Exact Git operation selected by the user (e.g. `git push --force origin feature/login`, `git reset --hard 8a5e7d1`).
2. **Recommended safer alternative**: Displayed clearly if one exists (e.g. `Recommended: git push --force-with-lease origin feature/login`).
3. **Expected impact**: Affected local files, commits, refs, tags, remotes, or branches where impact can be determined.
4. **Recovery option**: Backup/ref/bundle/mirror option is offered. The user may accept or decline it. Declining backup must not block the requested action. The audit log records that backup was declined.
5. **Confirmation**: Confirms the exact requested operation, not a paraphrase.
6. **Execution**: Executes exactly the selected operation after confirmation without silent substitutions.

---

## 5. Warning UX Requirements

Every dangerous operation displays:
- Operation name.
- Exact Git command representation, with sensitive credentials redacted.
- Repository path.
- Current branch.
- Current HEAD SHA.
- Target SHA/ref/path/remote.
- Scope of affected files, commits, refs, tags, or remote refs if determinable.
- Whether working tree has uncommitted changes.
- Whether merge/rebase/cherry-pick/revert/bisect is already in progress.
- Whether the current branch has an upstream.
- Whether the operation may rewrite commit SHAs.
- Whether existing signatures may become invalid.
- Whether the operation may affect collaborators, open pull requests, tags, deployments, or forks.
- Whether rollback is possible and what recovery mechanisms exist.
- Whether an offered backup was accepted or declined.
- A short plain-language explanation.
- A “View technical details” expandable section.

---

## 6. Confirmation Rules

- **Warning Level 0:** No confirmation.
- **Warning Level 1:** Normal confirmation only when the action can overwrite a user-visible state.
- **Warning Level 2:** One explicit confirmation (e.g. amend, reset --soft/mixed). Backup is offered and can be unchecked.
- **Warning Level 3:** Strong warning plus explicit confirmation checkboxes (e.g. raw force push, branch -D, reset --hard, clean -fdx, tag deletion).
- **Warning Level 4:** Critical warning, detailed impact list, typed phrase confirmation (e.g. "REWRITE SELECTED HISTORY", "PUBLISH REWRITTEN HISTORY TO <REMOTE>").
