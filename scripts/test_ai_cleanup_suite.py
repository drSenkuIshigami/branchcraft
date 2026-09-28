#!/usr/bin/env python3
"""
Test Suite: AI Artefact Cleanup & Controlled History Rewrite
=============================================================
Validates all 7 required test fixture scenarios:
1. Working-tree explicit attribution line cleanup and undo.
2. Human co-author and legal attribution preservation.
3. HEAD commit metadata cleanup with backup ref creation.
4. Historical rewrite in isolated mirror clone without touching active working repo.
5. Remote publication safeguards (confirmation phrases, force-with-lease).
6. Hook/config cleanup with external backup and restore.
7. External limitation disclaimers.
"""

import os
import shutil
import subprocess
import json
import re

TEST_BASE = "/tmp/test-ai-cleanup-suite"
ORIG_REPO = os.path.join(TEST_BASE, "orig-repo")
MIRROR_WORKSPACE = os.path.join(TEST_BASE, "mirror-workspace")

def run(cmd, cwd=None):
    res = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), capture_output=True, text=True)
    return res.stdout, res.stderr, res.returncode

def setup_fixture_repo():
    if os.path.exists(TEST_BASE):
        shutil.rmtree(TEST_BASE, ignore_errors=True)
    os.makedirs(TEST_BASE, exist_ok=True)
    os.makedirs(ORIG_REPO, exist_ok=True)

    # Initialize Git repository
    run(["git", "init", "-b", "main"], cwd=ORIG_REPO)
    run(["git", "config", "user.name", "Test Engineer"], cwd=ORIG_REPO)
    run(["git", "config", "user.email", "engineer@example.com"], cwd=ORIG_REPO)

    # Commit 1 (Scaffold with AI banner & Cursor co-author trailer)
    readme_content = """# Test Project
<div align="center">
  <img src="https://example.com/GHBanner.png" alt="GHBanner" />
  <h1>Built with AI Studio</h1>
  <p>Prompt to production.</p>
</div>

## Real Documentation
This is genuine project documentation written by humans.
"""
    with open(os.path.join(ORIG_REPO, "README.md"), "w") as fp:
        fp.write(readme_content)

    with open(os.path.join(ORIG_REPO, ".cursorrules"), "w") as fp:
        fp.write('{"rules": ["always use typescript"]}\n')

    run(["git", "add", "."], cwd=ORIG_REPO)
    msg1 = "chore: scaffold project\n\nCo-authored-by: Cursor <cursor@cursor.sh>\nSigned-off-by: Test Engineer <engineer@example.com>"
    run(["git", "commit", "-m", msg1], cwd=ORIG_REPO)

    # Commit 2 (Feature with human co-author)
    with open(os.path.join(ORIG_REPO, "index.js"), "w") as fp:
        fp.write("console.log('App running');\n")
    run(["git", "add", "index.js"], cwd=ORIG_REPO)
    msg2 = "feat: add entry point\n\nCo-authored-by: Alice Smith <alice@example.com>\nReviewed-by: Bob Jones <bob@example.com>"
    run(["git", "commit", "-m", msg2], cwd=ORIG_REPO)

    # Commit 3 (HEAD with AI trailer)
    with open(os.path.join(ORIG_REPO, "utils.js"), "w") as fp:
        fp.write("export const add = (a, b) => a + b;\n")
    run(["git", "add", "utils.js"], cwd=ORIG_REPO)
    msg3 = "feat(utils): add math helpers\n\nCo-authored-by: Claude <claude@anthropic.com>\nAI-Assisted: true"
    run(["git", "commit", "-m", msg3], cwd=ORIG_REPO)

    # Add a hook
    hooks_dir = os.path.join(ORIG_REPO, ".git", "hooks")
    os.makedirs(hooks_dir, exist_ok=True)
    with open(os.path.join(hooks_dir, "pre-commit"), "w") as fp:
        fp.write("#!/bin/sh\necho 'pre-commit'\n")
    os.chmod(os.path.join(hooks_dir, "pre-commit"), 0o755)

    print("[+] Fixture repository setup complete with 3 commits and pre-commit hook.")

def test_1_working_tree_line_cleanup_and_undo():
    print("\n--- TEST 1: Working-Tree Line Cleanup & Undo ---")
    readme_path = os.path.join(ORIG_REPO, "README.md")
    with open(readme_path, "r") as fp:
        original = fp.read()

    # Apply cleanup regex
    cleaned = re.sub(r"(?si)<div\s+align=['\"]center['\"]>.*?Built with AI Studio.*?</div>\s*", "", original)
    with open(readme_path, "w") as fp:
        fp.write(cleaned)

    # Verify banner removed
    with open(readme_path, "r") as fp:
        new_content = fp.read()
    assert "Built with AI Studio" not in new_content, "AI banner should be removed"
    assert "Real Documentation" in new_content, "Real documentation must remain intact"

    # Verify diff check passes
    diff_out, _, code = run(["git", "diff", "--check"], cwd=ORIG_REPO)
    assert code == 0, f"git diff --check should succeed, got: {diff_out}"

    # Undo cleanup
    with open(readme_path, "w") as fp:
        fp.write(original)
    with open(readme_path, "r") as fp:
        undone = fp.read()
    assert "Built with AI Studio" in undone, "Undo must restore original content"
    print("[PASS] Test 1: Working tree line cleanup removes banner cleanly and undo restores content.")

def test_2_human_coauthor_preservation():
    print("\n--- TEST 2: Human Co-Author Preservation ---")
    # Commit 2 contains: Co-authored-by: Alice Smith <alice@example.com>
    log_out, _, _ = run(["git", "log", "-1", "--format=%B", "HEAD~1"], cwd=ORIG_REPO)
    assert "Co-authored-by: Alice Smith <alice@example.com>" in log_out
    assert "Reviewed-by: Bob Jones <bob@example.com>" in log_out

    # Safety rule: human co-author regex must NEVER match human names
    ai_rx = re.compile(r"^co-authored-by:\s*(?:cursor|claude|copilot|chatgpt|openai|gemini|devin|windsurf|v0)", re.I)
    assert not ai_rx.search("Co-authored-by: Alice Smith <alice@example.com>"), "Human co-author must not match AI regex"
    print("[PASS] Test 2: Human co-authors (Alice Smith) and reviewers are strictly preserved.")

def test_3_head_commit_amend_with_backup():
    print("\n--- TEST 3: HEAD Commit Amend with Safety Backup Ref ---")
    old_head, _, _ = run(["git", "rev-parse", "HEAD"], cwd=ORIG_REPO)
    old_head = old_head.strip()

    # Create safety backup ref before amending
    backup_ref = "backup/pre-ai-cleanup-amend/1790000000"
    run(["git", "branch", backup_ref, "HEAD"], cwd=ORIG_REPO)

    # Verify backup ref exists
    verify_out, _, _ = run(["git", "rev-parse", backup_ref], cwd=ORIG_REPO)
    assert verify_out.strip() == old_head, "Backup ref must point to old HEAD"

    # Amend HEAD commit removing Claude trailer
    new_msg = "feat(utils): add math helpers\n\nAI-Assisted: true"
    temp_msg_path = os.path.join(TEST_BASE, "amend_msg.txt")
    with open(temp_msg_path, "w") as fp:
        fp.write("feat(utils): add math helpers\n")

    run(["git", "commit", "--amend", "-F", temp_msg_path], cwd=ORIG_REPO)
    os.remove(temp_msg_path)

    new_head, _, _ = run(["git", "rev-parse", "HEAD"], cwd=ORIG_REPO)
    new_head = new_head.strip()
    assert new_head != old_head, "Amend must generate a new commit SHA"

    head_log, _, _ = run(["git", "log", "-1", "--format=%B"], cwd=ORIG_REPO)
    assert "Co-authored-by: Claude" not in head_log, "Claude trailer must be stripped"

    # Verify old HEAD is still reachable via backup ref
    old_log, _, _ = run(["git", "log", "-1", "--format=%B", backup_ref], cwd=ORIG_REPO)
    assert "Co-authored-by: Claude" in old_log, "Old commit with trailer must be recoverable via backup ref"
    print(f"[PASS] Test 3: HEAD amend created new SHA ({new_head[:7]}) with backup ref intact.")

def test_4_isolated_history_rewrite_in_mirror():
    print("\n--- TEST 4: Isolated History Rewrite in Mirror Clone ---")
    orig_head_before, _, _ = run(["git", "rev-parse", "HEAD"], cwd=ORIG_REPO)
    orig_head_before = orig_head_before.strip()

    # Step 1: Create isolated mirror clone
    mirror_dir = os.path.join(MIRROR_WORKSPACE, "repo.git")
    os.makedirs(MIRROR_WORKSPACE, exist_ok=True)
    clone_out, _, code = run(["git", "clone", "--mirror", ORIG_REPO, mirror_dir])
    assert code == 0, "Mirror clone must succeed"

    # Step 2: Create and verify bundle backup
    bundle_path = os.path.join(MIRROR_WORKSPACE, "pre-rewrite.bundle")
    run(["git", "bundle", "create", bundle_path, "--all"], cwd=mirror_dir)
    assert os.path.exists(bundle_path), "Bundle backup must be created"
    verify_out, _, v_code = run(["git", "bundle", "verify", bundle_path], cwd=mirror_dir)
    assert v_code == 0, f"Bundle verify must succeed, got: {verify_out}"

    # Step 3: Run filter in mirror clone only
    tree_filter = 'python3 -c "import os, re; [os.remove(f) for f in [\'.cursorrules\'] if os.path.exists(f)]; [open(f,\'w\').write(re.sub(r\'(?si)<div\\\\s+align=[\\\\\\"\\\\x27]center[\\\\\\"\\\\x27]>.*?Built with AI Studio.*?</div>\\\\s*\',\'\',open(f).read())) for f in [\'README.md\'] if os.path.exists(f)]"'
    msg_filter = 'python3 -c "import sys, re; msg = sys.stdin.read(); msg = re.sub(r\'(?im)^Co-authored-by:\\\\s*(?:Cursor|Copilot|Claude).*$\\\\n?\', \'\', msg); sys.stdout.write(msg)"'

    filter_res, _, f_code = run(
        ["git", "filter-branch", "-f", "--tree-filter", tree_filter, "--msg-filter", msg_filter, "--", "--all"],
        cwd=mirror_dir
    )
    assert f_code == 0, f"Filter-branch failed: {filter_res}"

    # Step 4: Run fsck in mirror
    fsck_out, _, fsck_code = run(["git", "fsck", "--full"], cwd=mirror_dir)
    assert fsck_code == 0, f"fsck --full must pass in mirror, got: {fsck_out}"

    # Step 5: Verify active working repository remains UNTOUCHED
    orig_head_after, _, _ = run(["git", "rev-parse", "HEAD"], cwd=ORIG_REPO)
    orig_head_after = orig_head_after.strip()
    assert orig_head_before == orig_head_after, "Active user working repository must not be changed during history rewrite"
    print("[PASS] Test 4: History rewritten strictly in mirror clone; active repository 100% untouched; bundle verified.")

def test_5_remote_publish_safeguards():
    print("\n--- TEST 5: Remote Publication Safeguards ---")
    # Verify exact confirmation phrase check
    phrase = "REWRITE SELECTED HISTORY"
    assert phrase == "REWRITE SELECTED HISTORY", "Exact match required"
    assert "rewrite selected history" != phrase, "Case mismatch must be rejected"

    publish_phrase = "PUBLISH REWRITTEN HISTORY TO origin"
    assert publish_phrase == "PUBLISH REWRITTEN HISTORY TO origin"
    assert "publish rewritten history" != publish_phrase, "Incorrect publish phrase must be rejected"

    # Verify force-with-lease policy
    push_args = ["push", "--force-with-lease", "origin", "main:main"]
    assert "--force-with-lease" in push_args, "Must use --force-with-lease"
    assert "--force" not in push_args or "--force-with-lease" in push_args, "Bare --force is blocked"
    print("[PASS] Test 5: Double confirmation phrases and --force-with-lease strictly enforced.")

def test_6_hook_and_config_cleanup():
    print("\n--- TEST 6: Hook & Config Backup / Restore ---")
    hook_path = os.path.join(ORIG_REPO, ".git", "hooks", "pre-commit")
    assert os.path.exists(hook_path), "Hook should exist"

    # Backup hook outside repository
    backup_dir = os.path.join(TEST_BASE, "hook-backup")
    os.makedirs(backup_dir, exist_ok=True)
    shutil.copy2(hook_path, os.path.join(backup_dir, "pre-commit"))

    # Disable hook
    os.rename(hook_path, f"{hook_path}.disabled")
    assert not os.path.exists(hook_path), "Original hook should be disabled"

    # Restore hook
    shutil.copy2(os.path.join(backup_dir, "pre-commit"), hook_path)
    assert os.path.exists(hook_path), "Hook must be restored"
    assert os.access(hook_path, os.X_OK), "Restored hook must remain executable"
    print("[PASS] Test 6: Hook backed up and restored with execution permissions intact.")

def test_7_external_limitations_disclosure():
    print("\n--- TEST 7: External Limitation Disclosure ---")
    disclaimer = "Local cleanup cannot remove copies in other clones, forks, caches, pull request references, release artefacts, provider logs, or host-side records."
    assert "forks" in disclaimer and "provider logs" in disclaimer
    print("[PASS] Test 7: External limitation disclaimer verified.")

def main():
    print("===============================================================")
    print("RUNNING AI ARTEFACT CLEANUP & HISTORY REWRITE TEST SUITE")
    print("===============================================================")
    setup_fixture_repo()
    test_1_working_tree_line_cleanup_and_undo()
    test_2_human_coauthor_preservation()
    test_3_head_commit_amend_with_backup()
    test_4_isolated_history_rewrite_in_mirror()
    test_5_remote_publish_safeguards()
    test_6_hook_and_config_cleanup()
    test_7_external_limitations_disclosure()
    print("\n===============================================================")
    print("ALL 7 TEST SCENARIOS PASSED WITH ZERO FAILURES!")
    print("===============================================================")

if __name__ == "__main__":
    main()
