# Safety & Risk Policy

> **Status:** Active Standard (Phase 0)  
> **Notice:** This document establishes the 5-tier operation risk classification and safety protocol for Git Workbench.

---

## 1. Core Safety Principles

1. **Safety Over Speed:** Operations that rewrite or delete uncommitted or published history must default to the safest possible mechanism.
2. **Local-First & Explicit Networking:** Purely local repository actions (log, status, diff, branch, local commit) must **never require network access or mandatory background fetches**. All remote operations (`fetch`, `pull`, `push`, `clone`) must be explicit, deliberate user actions.
3. **Transparent Execution:** All executed Git operations are recorded in an audit log showing exact arguments and exit codes.
4. **No Destructive Action in Phase 0:** Phase 0 contains only the non-destructive `git --version` check. All destructive operations and risk policies described below are documented here and will be implemented in subsequent phases.

---

## 2. Five-Tier Risk Classification Model

| Level | Classification | Examples | Enforced Behavior |
|:---:|---|---|---|
| **0** | **Read-Only** | `log`, `diff`, `graph`, `blame`, `status`, `search` | **Direct execution**. No confirmation modal required. |
| **1** | **Easily Reversible** | `stage`, `unstage`, `commit`, `branch create`, `stash` | **Normal confirmation or Undo action** where applicable. |
| **2** | **Local History Rewrite** | `amend`, `reset --soft`, `reset --mixed`, local unpublished `rebase` | **Preview diff/impact + explicit confirmation + lightweight restore point** where useful; does **NOT** require a full bundle backup by default. |
| **3** | **Destructive / Published** | `reset --hard`, `clean -fd`, rebase on published branch, branch deletion, force-push | **Mandatory automatic backup** (`backup/pre-<op>-<timestamp>`) + **preview** + **two-step confirmation**. Default push is `--force-with-lease`. |
| **4** | **Security & History Purge** | `git filter-repo`, secret purging, global author rewrite, large file purge | **Dedicated wizard**, executed **strictly in a separate mirror clone**, **mandatory bundle backup**, **typed confirmation** (e.g. typing branch name), and a **separate explicit push step**. |

---

## 3. Seven-Step Safe Runbook for High-Risk Operations (Level 2+)

Future risk workflows (Phase 3 & 4) must follow this verified runbook:

1. **Stop & Assess:** Check `git status`, current branch, recent commits, and remote status before initiating changes.
2. **Create Restore Point:**
   - Level 2: Lightweight branch point (`backup/pre-<op>-<timestamp>`).
   - Level 3 & 4: Automatic branch tag and verified offline bundle (`git bundle create`).
3. **Isolate High-Risk Scope:** Perform global history rewrites (Level 4) only in an isolated mirror clone (`git clone --mirror`), never on the user's primary working tree.
4. **Minimal Scope Execution:** Use the most targeted tool appropriate for the task (`restore` over `reset`, `revert` over `rebase` for shared branches).
5. **Pre-Push Validation:** Run `git fsck --full`, inspect refs, and verify repository integrity before presenting the push step.
6. **Controlled Push:** Never push automatically after a rewrite. The user must explicitly initiate push with `--force-with-lease` (or `--mirror` in Level 4 wizard).
7. **Post-Rewrite Coordination:** Display clear checklists reminding the user to coordinate with teammates (re-cloning, checking PRs, rotating leaked credentials).

---

## 4. Specific Clarifications & Constraints

- **`git gc --prune=now --aggressive`:** Must **never** run automatically inside any wizard or cleanup loop. It must always be an independent, explicitly labeled action warning that unreferenced commits become unrecoverable.
- **`git merge -X ours/theirs` vs `git merge -s ours`:** The UI must clearly differentiate these: `-X` sets a conflict-resolution preference while merging history; `-s ours` discards the other branch's changes entirely while recording a merge.
- **AI-Trace Cleanup Policy:** Detection is strictly based on identifiable, verifiable artifacts (commit trailers, explicit tool directories, configured strings). It must never claim probabilistic code generation detection.

---

## 5. AI Artefact Cleanup & Controlled History Rewrite Policy

### 5.1 Hard Safety Boundaries
- **Authorship Non-Inference:** The system never infers AI authorship from code style, formatting, whitespace, or naming.
- **Human Attribution Protection:** Human `Co-authored-by:`, `Signed-off-by:`, `Reviewed-by:`, `Acked-by:`, licenses, copyright, `NOTICE`, `SECURITY.md`, and compliance records are strictly preserved and disabled from deletion.
- **Zero Identity Forgery:** Never forge or replace human author/committer identities.
- **No Signature Fabrication:** Never alter Git signatures or pretend rewritten commits remain signed.
- **External Record Limitations:** UI explicitly informs users that local cleanups cannot remove copies held in forks, remote caches, PR histories, or host provider audit logs.
- **No Automatic GC:** Never run `git gc --prune=now --aggressive` automatically.

### 5.2 Confirmation & Verification Workflow
1. **Working Tree Cleanup (Risk 1):** Line-level minimal edits with unified diff preview, `git diff --check`, and immediate in-memory undo buffer.
2. **HEAD Commit Amend (Risk 2 / Risk 3):** Generates `refs/heads/backup/pre-ai-cleanup-amend/<timestamp>` ref, checks for published/upstream state, and amends via validated temporary message file.
3. **Isolated History Rewrite (Risk 4):**
   - Active working clone is **never** touched during history filtering.
   - Requires First Confirmation dialog with 5 mandatory checkboxes and exact typed phrase: `REWRITE SELECTED HISTORY`.
   - Executes inside disposable mirror clone (`rewrite-workspaces/<operation-id>/repo.git`).
   - Generates and verifies offline bundle backup (`pre-rewrite.bundle`) before applying filter.
   - Runs `git fsck --full` in the mirror clone after rewrite.
4. **Remote Rewrite Publication (Risk 4):**
   - Gated on validated mirror rewrite.
   - Requires Second Confirmation dialog with 6 mandatory checkboxes and exact typed phrase: `PUBLISH REWRITTEN HISTORY TO <REMOTE_NAME>`.
   - Enforces `git push --force-with-lease` for selected branches.
   - Generates interactive post-publish coordination checklist with Markdown export.

