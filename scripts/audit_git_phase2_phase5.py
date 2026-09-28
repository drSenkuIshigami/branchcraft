#!/usr/bin/env python3
"""
Forensic Audit Script: Phase 2 (Git Commit Metadata) & Phase 5 (Author / Committer Identity)
============================================================================================
Performs a deep forensic inspection of accessible local Git commits, author metadata,
committer metadata, signatures, trailers, and commit message bodies for AI-generated artifacts,
bot-related identities, and tool-specific signatures.
"""

import os
import sys
import subprocess
import json
import re
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# AI Search Patterns & Known Bot Signatures
# ---------------------------------------------------------------------------

AI_TOOL_KEYWORDS = [
    "copilot", "github copilot", "cursor", "claude", "anthropic",
    "gemini", "codeium", "windsurf", "cody", "sourcegraph", "tabnine",
    "amazon q", "amazon-q", "aider", "continue", "cline", "roo", "roo code",
    "devin", "openai", "chatgpt", "codex", "v0", "replit", "jetbrains ai"
]

AI_TRAILER_PREFIXES = [
    "co-authored-by", "coauthored-by", "coauthor", "co-author",
    "assisted-by", "generated-by", "created-by", "authored-by",
    "signed-off-by", "reviewed-by", "ai", "ai-generated", "ai-assisted",
    "claude-session", "cursor-session"
]

AI_IDENTITY_PATTERNS = [
    re.compile(r"\bcursor\b", re.I),
    re.compile(r"\bcopilot\b", re.I),
    re.compile(r"\bgithub[- ]?copilot\b", re.I),
    re.compile(r"\bclaude\b", re.I),
    re.compile(r"\banthropic\b", re.I),
    re.compile(r"\bopenai\b", re.I),
    re.compile(r"\bchatgpt\b", re.I),
    re.compile(r"\bcodex\b", re.I),
    re.compile(r"\bgemini\b", re.I),
    re.compile(r"\bcodeium\b", re.I),
    re.compile(r"\bwindsurf\b", re.I),
    re.compile(r"\bamazon[- ]?q\b", re.I),
    re.compile(r"\bsourcegraph\b", re.I),
    re.compile(r"\baider\b", re.I),
    re.compile(r"\bcline\b", re.I),
    re.compile(r"\broo[- ]?code\b", re.I),
    re.compile(r"\bdevin\b", re.I),
    re.compile(r"\b\[bot\]\b", re.I),
    re.compile(r"@(?:cursor\.sh|anthropic\.com|openai\.com|github\.com|users\.noreply\.github\.com)", re.I),
]

# Patterns for explicit commit message statements
AI_BODY_PATTERNS = [
    re.compile(r"\b(?:built|made|generated|written|assisted)\s+(?:with|by)\s+(?:ai|cursor|copilot|claude|chatgpt|openai|gemini|devin|windsurf)\b", re.I),
    re.compile(r"\b(?:ai[- ]generated|ai[- ]assisted)\b", re.I),
    re.compile(r"\b(?:claude|copilot|cursor|chatgpt)\s+(?:recommends|suggests|generated)\b", re.I),
    re.compile(r"https?://(?:cursor\.com|cursor\.sh|chatgpt\.com|chat\.openai\.com|claude\.ai|copilot\.github\.com)", re.I),
]

def run_git(repo_dir, args):
    try:
        res = subprocess.run(
            ["git", "-C", repo_dir] + args,
            capture_output=True,
            text=True,
            errors="replace"
        )
        return res.stdout, res.stderr, res.returncode
    except Exception as e:
        return "", str(e), 1

def find_all_repos():
    repos = []
    # Search common locations
    search_roots = ["/tmp", "/app/applet", "/home", "/root", "/var", "/opt"]
    for s_root in search_roots:
        if not os.path.exists(s_root):
            continue
        for root, dirs, files in os.walk(s_root):
            if ".git" in dirs:
                repos.append(root)
                dirs.remove(".git")
    # De-duplicate while preserving order
    unique_repos = []
    for r in repos:
        normalized = os.path.abspath(r)
        if normalized not in unique_repos:
            unique_repos.append(normalized)
    return unique_repos

def parse_raw_commit(raw_str):
    """Parses a git cat-file / format=raw commit block into fields."""
    lines = raw_str.strip().split("\n")
    data = {
        "tree": None,
        "parents": [],
        "author": {},
        "committer": {},
        "gpgsig": None,
        "message": ""
    }
    
    idx = 0
    in_gpgsig = False
    gpgsig_lines = []
    
    while idx < len(lines):
        line = lines[idx]
        if in_gpgsig:
            if line.startswith(" "):
                gpgsig_lines.append(line[1:])
                idx += 1
                continue
            else:
                in_gpgsig = False
                data["gpgsig"] = "\n".join(gpgsig_lines)
        
        if line == "":
            data["message"] = "\n".join(lines[idx + 1:])
            break
        elif line.startswith("tree "):
            data["tree"] = line[5:].strip()
        elif line.startswith("parent "):
            data["parents"].append(line[7:].strip())
        elif line.startswith("author "):
            match = re.match(r"^author (.*?) <(.*?)> (\d+)\s+([+-]\d{4})$", line)
            if match:
                data["author"] = {
                    "name": match.group(1),
                    "email": match.group(2),
                    "timestamp": int(match.group(3)),
                    "timezone": match.group(4)
                }
            else:
                data["author"] = {"raw": line[7:]}
        elif line.startswith("committer "):
            match = re.match(r"^committer (.*?) <(.*?)> (\d+)\s+([+-]\d{4})$", line)
            if match:
                data["committer"] = {
                    "name": match.group(1),
                    "email": match.group(2),
                    "timestamp": int(match.group(3)),
                    "timezone": match.group(4)
                }
            else:
                data["committer"] = {"raw": line[10:]}
        elif line.startswith("gpgsig "):
            in_gpgsig = True
            gpgsig_lines = [line[7:]]
        idx += 1
        
    return data

def audit_repo(repo_dir):
    print(f"\n========================================================")
    print(f"AUDITING REPOSITORY: {repo_dir}")
    print(f"========================================================")
    
    # 1. Structure & Remotes
    remotes_stdout, _, _ = run_git(repo_dir, ["remote", "-v"])
    remotes = [r.strip() for r in remotes_stdout.strip().split("\n") if r.strip()]
    has_remotes = len(remotes) > 0
    
    branches_stdout, _, _ = run_git(repo_dir, ["branch", "-a"])
    branches = [b.strip() for b in branches_stdout.strip().split("\n") if b.strip()]
    
    head_branch_stdout, _, _ = run_git(repo_dir, ["rev-parse", "--abbrev-ref", "HEAD"])
    current_head = head_branch_stdout.strip()
    
    tags_stdout, _, _ = run_git(repo_dir, ["tag", "-l"])
    tags = [t.strip() for t in tags_stdout.strip().split("\n") if t.strip()]
    
    notes_stdout, _, _ = run_git(repo_dir, ["notes", "list"])
    notes = [n.strip() for n in notes_stdout.strip().split("\n") if n.strip()]
    
    # 2. Get all reachable commits
    rev_list_stdout, _, _ = run_git(repo_dir, ["rev-list", "--all"])
    commit_shas = [c.strip() for c in rev_list_stdout.strip().split("\n") if c.strip()]
    
    # Signatures check using git log format
    sig_stdout, _, _ = run_git(repo_dir, ["log", "--all", "--format=%H%x1f%G?%x1f%GK%x1f%GS%x1f%GF%x1f%GP"])
    signatures_map = {}
    if sig_stdout:
        for line in sig_stdout.strip().split("\n"):
            parts = line.split("\x1f")
            if len(parts) >= 2:
                signatures_map[parts[0]] = {
                    "status": parts[1], # G=good, B=bad, U=untrusted, X=expired, Y=expired key, R=revoked, E=cannot check, N=none
                    "key": parts[2] if len(parts) > 2 else "",
                    "signer": parts[3] if len(parts) > 3 else "",
                    "fingerprint": parts[4] if len(parts) > 4 else "",
                    "trust_level": parts[5] if len(parts) > 5 else ""
                }

    # Branch containment map
    commit_branches = {}
    for sha in commit_shas:
        b_out, _, _ = run_git(repo_dir, ["branch", "-a", "--contains", sha])
        b_list = [b.replace("*", "").strip() for b in b_out.strip().split("\n") if b.strip()]
        commit_branches[sha] = b_list

    # Tag containment map
    commit_tags = {}
    for sha in commit_shas:
        t_out, _, _ = run_git(repo_dir, ["tag", "--points-at", sha])
        t_list = [t.strip() for t in t_out.strip().split("\n") if t.strip()]
        commit_tags[sha] = t_list

    print(f"Total reachable commits: {len(commit_shas)}")
    print(f"Current branch / HEAD: {current_head}")
    print(f"Branches: {', '.join(branches)}")
    print(f"Tags: {', '.join(tags) if tags else 'none'}")
    print(f"Remotes: {', '.join(remotes) if remotes else 'none (local only, not pushed)'}")
    print(f"Notes entries: {len(notes)}")

    # 3. Analyze Commits for Phase 2 & Phase 5
    findings_phase2_trailers = []
    findings_phase2_body = []
    findings_phase5_author = []
    findings_phase5_committer = []
    timestamp_anomalies = []
    
    commit_audit_records = []

    for sha in commit_shas:
        raw_out, _, _ = run_git(repo_dir, ["cat-file", "-p", sha])
        parsed = parse_raw_commit(raw_out)
        
        author = parsed["author"]
        committer = parsed["committer"]
        msg = parsed["message"]
        lines = msg.strip().split("\n")
        subject = lines[0] if lines else ""
        body = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""
        
        sig_info = signatures_map.get(sha, {"status": "N"})
        is_signed = sig_info["status"] not in ("N", "")

        author_name = author.get("name", "")
        author_email = author.get("email", "")
        author_ts = author.get("timestamp", 0)
        
        committer_name = committer.get("name", "")
        committer_email = committer.get("email", "")
        committer_ts = committer.get("timestamp", 0)

        # Format timestamps
        author_dt = datetime.fromtimestamp(author_ts, tz=timezone.utc).isoformat() if author_ts else "unknown"
        committer_dt = datetime.fromtimestamp(committer_ts, tz=timezone.utc).isoformat() if committer_ts else "unknown"

        # Check timestamp anomalies (e.g. committer earlier than author, future date, identical batch epoch)
        now_epoch = int(datetime.now().timestamp())
        if author_ts > now_epoch + 86400:
            timestamp_anomalies.append({
                "sha": sha,
                "type": "future_author_date",
                "details": f"Author date {author_dt} is in the future."
            })
        if committer_ts < author_ts:
            timestamp_anomalies.append({
                "sha": sha,
                "type": "committer_precedes_author",
                "details": f"Committer timestamp precedes author timestamp."
            })

        # --- Phase 5: Author / Committer Identity Audit ---
        author_ai_match = False
        author_match_reason = []
        for pat in AI_IDENTITY_PATTERNS:
            if pat.search(author_name) or pat.search(author_email):
                author_ai_match = True
                author_match_reason.append(pat.pattern)
                
        committer_ai_match = False
        committer_match_reason = []
        for pat in AI_IDENTITY_PATTERNS:
            if pat.search(committer_name) or pat.search(committer_email):
                committer_ai_match = True
                committer_match_reason.append(pat.pattern)

        if author_ai_match:
            findings_phase5_author.append({
                "sha": sha,
                "role": "author",
                "name": author_name,
                "email": author_email,
                "timestamp": author_dt,
                "branches": commit_branches.get(sha, []),
                "tags": commit_tags.get(sha, []),
                "is_signed": is_signed,
                "is_pushed": has_remotes,
                "reasons": author_match_reason
            })

        if committer_ai_match:
            findings_phase5_committer.append({
                "sha": sha,
                "role": "committer",
                "name": committer_name,
                "email": committer_email,
                "timestamp": committer_dt,
                "branches": commit_branches.get(sha, []),
                "tags": commit_tags.get(sha, []),
                "is_signed": is_signed,
                "is_pushed": has_remotes,
                "reasons": committer_match_reason
            })

        # --- Phase 2: Commit Trailers & Message Footprints ---
        # Parse trailers
        trailer_lines = []
        for l in msg.split("\n"):
            l_trimmed = l.strip()
            if ":" in l_trimmed:
                prefix = l_trimmed.split(":")[0].strip().lower()
                if prefix in AI_TRAILER_PREFIXES:
                    trailer_lines.append(l_trimmed)

        for tr in trailer_lines:
            # Check if trailer mentions AI tools or AI identities
            tr_lower = tr.lower()
            for kw in AI_TOOL_KEYWORDS:
                if kw in tr_lower:
                    findings_phase2_trailers.append({
                        "sha": sha,
                        "subject": subject,
                        "trailer": tr,
                        "tool": kw,
                        "classification": "explicit_ai_trailer"
                    })
                    break
            else:
                # Check if it is a generic human trailer (e.g. Co-authored-by: Human Name)
                if tr_lower.startswith("co-authored-by:") or tr_lower.startswith("signed-off-by:"):
                    # Preserve and classify as human attribution
                    pass

        # Check commit subject and body for AI-generated patterns
        for pat in AI_BODY_PATTERNS:
            match = pat.search(msg)
            if match:
                findings_phase2_body.append({
                    "sha": sha,
                    "subject": subject,
                    "matched_text": match.group(0),
                    "pattern": pat.pattern
                })

        commit_audit_records.append({
            "sha": sha,
            "short_sha": sha[:7],
            "subject": subject,
            "author": f"{author_name} <{author_email}>",
            "author_date": author_dt,
            "committer": f"{committer_name} <{committer_email}>",
            "committer_date": committer_dt,
            "parents": parsed["parents"],
            "signed": is_signed,
            "signature_status": sig_info["status"],
            "branches": commit_branches.get(sha, []),
            "tags": commit_tags.get(sha, []),
            "trailers_count": len(trailer_lines)
        })

    # Print Report
    print("\n--------------------------------------------------------")
    print("PHASE 5 FINDINGS: AUTHOR / COMMITTER IDENTITIES")
    print("--------------------------------------------------------")
    if not findings_phase5_author and not findings_phase5_committer:
        print("[CLEAR] No AI tool, agent, or bot identities detected in AUTHOR or COMMITTER metadata.")
        print(f"Verified {len(commit_shas)} commit identities against 18 known AI identity patterns.")
    else:
        for f in findings_phase5_author:
            print(f"[FOUND] AI Author Identity: {f['name']} <{f['email']}> in commit {f['sha']}")
        for f in findings_phase5_committer:
            print(f"[FOUND] AI Committer Identity: {f['name']} <{f['email']}> in commit {f['sha']}")

    print("\n--------------------------------------------------------")
    print("PHASE 2 FINDINGS: COMMIT METADATA, TRAILERS & PATTERNS")
    print("--------------------------------------------------------")
    if not findings_phase2_trailers and not findings_phase2_body:
        print("[CLEAR] No AI attribution trailers (Co-authored-by: Cursor/Claude/Copilot, etc.) detected.")
        print("[CLEAR] No AI session IDs, provider URLs, or generated message boilerplates detected.")
    else:
        for f in findings_phase2_trailers:
            print(f"[FOUND] Trailer in {f['sha'][:7]}: {f['trailer']} (Tool: {f['tool']})")
        for f in findings_phase2_body:
            print(f"[FOUND] Body pattern in {f['sha'][:7]}: {f['matched_text']}")

    print("\n--------------------------------------------------------")
    print("TIMESTAMP & INTEGRITY AUDIT")
    print("--------------------------------------------------------")
    if not timestamp_anomalies:
        print("[CLEAR] Commit timestamps are chronological and within normal operational bounds.")
    else:
        for t in timestamp_anomalies:
            print(f"[WARNING] {t['sha'][:7]}: {t['details']}")

    print("\n--------------------------------------------------------")
    print("COMPLETE COMMIT INVENTORY (accessible Git history)")
    print("--------------------------------------------------------")
    for r in commit_audit_records:
        sig_str = "SIGNED" if r["signed"] else "unsigned"
        tags_str = f" [tags: {', '.join(r['tags'])}]" if r["tags"] else ""
        branches_str = f" [branches: {', '.join(r['branches'])}]" if r["branches"] else ""
        print(f"* {r['short_sha']} | {r['author_date'][:10]} | {r['author']} | {sig_str}{tags_str}{branches_str} | {r['subject']}")

    # Return structured summary
    return {
        "repo_dir": repo_dir,
        "total_commits": len(commit_shas),
        "branches": branches,
        "tags": tags,
        "has_remotes": has_remotes,
        "findings_phase2_trailers": findings_phase2_trailers,
        "findings_phase2_body": findings_phase2_body,
        "findings_phase5_author": findings_phase5_author,
        "findings_phase5_committer": findings_phase5_committer,
        "timestamp_anomalies": timestamp_anomalies,
        "commits": commit_audit_records
    }

def main():
    print("=" * 70)
    print("FORENSIC GIT COMMIT AUDIT: PHASE 2 & PHASE 5 PROTOCOL EXECUTION")
    print("=" * 70)
    
    repos = find_all_repos()
    if not repos:
        print("[-] No Git repositories found in system paths.")
        sys.exit(0)

    print(f"Discovered {len(repos)} Git repository(ies):")
    for r in repos:
        print(f"  - {r}")

    all_reports = []
    for r in repos:
        rep = audit_repo(r)
        all_reports.append(rep)

    # Save JSON audit artifact
    output_path = "/app/applet/scripts/audit_phase2_phase5_results.json"
    try:
        with open(output_path, "w") as fp:
            json.dump(all_reports, fp, indent=2)
        print(f"\n[+] Complete forensic audit artifact written to: {output_path}")
    except Exception as e:
        print(f"\n[!] Note: could not write json artifact: {e}")

if __name__ == "__main__":
    main()
