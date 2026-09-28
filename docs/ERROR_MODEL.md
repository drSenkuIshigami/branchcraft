# Error Model Specification

> **Status:** Active Standard  
> **Notice:** Defines structured error handling, safety rejection codes, and recovery guidance for Git Workbench and AI Artefact Cleanup workflows.

---

## 1. Principles of Error Handling

1. **No Silent Rejections:** Every operation that fails or is blocked by safety checks returns an explicit, structured error with recovery instructions.
2. **Rejection at the Gateway:** Untyped commands, shell metacharacters, unauthorized finding selections, or mismatched confirmation phrases are rejected before invoking Git.
3. **Audit Logged:** Rejections are preserved in the command history log with redacted sensitive tokens.

---

## 2. Safety Error Classifications

| Error Code | Classification | Trigger Condition | Mitigation & User Guidance |
|---|---|---|---|
| `ERR_PROTECTED_ATTRIBUTION` | Hard Safety Boundary | Attempting to delete human `Co-authored-by`, `Signed-off-by`, licenses, or copyright notices | Selection is disabled and preserved; human attribution cannot be altered. |
| `ERR_UNCONFIRMED_REWRITE` | Confirmation Missing | Attempting history rewrite without all 5 checkboxes or exact phrase `REWRITE SELECTED HISTORY` | Complete all checkboxes and enter exact authorization phrase. |
| `ERR_UNCONFIRMED_PUBLISH` | Confirmation Missing | Attempting remote publish without all 6 checkboxes or exact phrase `PUBLISH REWRITTEN HISTORY TO <REMOTE>` | Verify remote URL and refs; confirm all publication disclosures. |
| `ERR_ACTIVE_WORKTREE_REWRITE` | Safety Isolation | Attempting history rewrite inside active working clone | Rewrites are strictly executed in segregated disposable mirror clone workspaces. |
| `ERR_BUNDLE_VERIFY_FAILED` | Integrity Failure | Git bundle backup fails `git bundle verify` check | Operation aborted immediately before any filter is executed. |
| `ERR_REMOTE_LEASE_MISMATCH` | Remote Race Condition | Remote ref tip changed since mirror rewrite was created | Pull/inspect remote changes; force-with-lease prevents overwriting unseen upstream work. |
| `ERR_UNDO_EXPIRED` | Working Tree Rollback | In-memory rollback snapshot expired or repository changed externally | Working tree changes must be inspected via `git diff` or restored via Git stash/checkout. |

---

## 3. Recovery Workflows

- **HEAD Amend Recovery:** Automatic backup branch created at `refs/heads/backup/pre-ai-cleanup-amend/<timestamp>`. Restore via:
  ```bash
  git reset --hard backup/pre-ai-cleanup-amend/<timestamp>
  ```
- **Isolated History Recovery:** Original repository remains untouched in place. If rewritten mirror clone is published and needs reverting, restore from verified bundle:
  ```bash
  git clone pre-rewrite.bundle restored-repo
  ```
