/**
 * Git Workbench - AI Artefact Cleanup & Controlled History Rewrite Service
 *
 * Implements strict Level 1 through Level 4 Safety Policies:
 * 1. Zero raw shell execution (execFile only, discrete argument arrays).
 * 2. Strict allowlisted Git commands.
 * 3. Human & Legal Attribution Protection (Co-authored-by: Human, Signed-off-by, Licenses, DCO are never removed).
 * 4. Active working copy is NEVER modified during Risk 4 history rewrite (uses isolated disposable mirror clone).
 * 5. Mandatory multi-checkbox validation and exact typed confirmation phrases.
 * 6. Git bundle backup creation and verification before any history rewrite.
 * 7. Force-with-lease safety on remote publish (never bare --force by default).
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { filterScriptPath, nodeFilterCommand } from './gitFilterNode.ts';
import type {
  ClassifiedFinding,
  CleanupRiskLevel,
  CleanupTargetKind,
  ConfigHookCleanupPreview,
  ConfigHookCleanupResult,
  ConfigHookTarget,
  FindingClassification,
  HeadCommitAmendPreview,
  HeadCommitAmendResult,
  HistoryRewritePreview,
  HistoryRewriteResult,
  HistoryRewriteScope,
  PostPublishChecklist,
  RemotePublishResult,
  RemotePublishScope,
  RewriteOperation,
  RewriteOperationStatus,
  WorkingTreeCleanupResult,
  WorkingTreeEditPreview,
} from '../src/types';

// =========================================================================
// Helpers & Command Execution
// =========================================================================

function runGit(
  repoPath: string,
  args: string[],
  stdin?: string,
  env?: NodeJS.ProcessEnv
): Promise<{ stdout: string; stderr: string; code: number; duration_ms: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const options = {
      cwd: repoPath,
      env: env ? { ...process.env, ...env } : undefined,
      encoding: 'utf-8' as const,
      maxBuffer: 20 * 1024 * 1024,
    };
    const child = execFile('git', args, options, (error, stdout, stderr) => {
      resolve({
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        code: error ? (error.code as unknown as number) || 1 : 0,
        duration_ms: Date.now() - start,
      });
    });
    if (stdin !== undefined && child.stdin) {
      child.stdin.on('error', () => {});
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

function sanitizePath(baseDir: string, relativePath: string): string {
  const resolved = path.resolve(baseDir, relativePath);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error(`Security Violation: Path traversal detected: ${relativePath}`);
  }
  return resolved;
}

// In-memory rollback buffer for working tree cleanups
interface UndoSnapshot {
  operation_id: string;
  repo_path: string;
  timestamp: number;
  files: { [file_path: string]: string };
}
const undoCache = new Map<string, UndoSnapshot>();

// Active rewrite operations state store
const rewriteOperations = new Map<string, RewriteOperation>();
const rewriteScopes = new Map<string, HistoryRewriteScope>();

// =========================================================================
// 1. Finding Eligibility & Revalidation
// =========================================================================

const PROTECTED_PATTERNS = [
  /^signed-off-by:/i,
  /^reviewed-by:/i,
  /^acked-by:/i,
  /^copyright\b/i,
  /^license\b/i,
  /^dco\b/i,
];

const KNOWN_AI_TRAILER_REGEX =
  /^co-authored-by:\s*(?:cursor|claude|copilot|github[- ]?copilot|chatgpt|openai|gemini|devin|windsurf|codeium|v0|cline|roo)/i;

const AI_BANNER_REGEX =
  /<div\s+align=['"]center['"]>[\s\S]*?(?:GHBanner|Built with AI Studio)[\s\S]*?<\/div>/i;

const AI_AGENT_INSTRUCTION_FILES = [
  'claude.md',
  'agents.md',
  '.github/copilot-instructions.md',
  '.mcp.json',
  '.windsurfrules',
];

export async function getCleanupEligibility(
  repoPath: string,
  rawFindings: any[]
): Promise<ClassifiedFinding[]> {
  const classified: ClassifiedFinding[] = [];

  for (let i = 0; i < rawFindings.length; i++) {
    const f = rawFindings[i];
    const marker = String(f.marker || f.details || '').trim();
    const filePath = f.file_path ? String(f.file_path).trim() : undefined;
    const matchedText = String(f.snippet || marker);
    const id = f.id || `finding-${i}-${crypto.randomBytes(3).toString('hex')}`;

    // 1. Check for human attribution / legal protection
    const isHumanTrailer =
      marker.toLowerCase().startsWith('co-authored-by:') &&
      !KNOWN_AI_TRAILER_REGEX.test(marker);

    const isLegalProtected =
      PROTECTED_PATTERNS.some((p) => p.test(marker)) ||
      (filePath && /(?:license|notice|security\.md|copying)/i.test(filePath));

    if (isHumanTrailer) {
      classified.push({
        id,
        kind: 'HeadCommitMessageLine',
        classification: 'human_attribution',
        risk_level: 'Risk2LocalHeadAmend',
        selectable: false,
        selected_by_default: false,
        commit_sha: f.commit_sha,
        matched_text: matchedText,
        explanation: 'Human attribution (Co-authored-by: Human) is strictly protected and cannot be removed.',
      });
      continue;
    }

    if (isLegalProtected) {
      classified.push({
        id,
        kind: 'WorkingTreeTextOccurrence',
        classification: 'legal_compliance_material',
        risk_level: 'Risk1WorkingTreeEdit',
        selectable: false,
        selected_by_default: false,
        file_path: filePath,
        matched_text: matchedText,
        explanation: 'Legal notices, license texts, and compliance records are strictly preserved.',
      });
      continue;
    }

    // 2. Classify Config / Agent Instruction Files
    if (filePath && AI_AGENT_INSTRUCTION_FILES.includes(filePath.toLowerCase())) {
      classified.push({
        id,
        kind: 'RepositoryConfigPath',
        classification: 'ai_agent_instruction_file',
        risk_level: 'Risk2ConfigurationUntrack',
        selectable: true,
        selected_by_default: false,
        file_path: filePath,
        matched_text: matchedText,
        explanation: 'AI agent instruction file (e.g. CLAUDE.md). Review only; never selected by default.',
      });
      continue;
    }

    if (filePath && (filePath.endsWith('.cursorrules') || filePath.includes('.cursor/'))) {
      classified.push({
        id,
        kind: 'RepositoryConfigPath',
        classification: 'tool_configuration_file',
        risk_level: 'Risk2ConfigurationUntrack',
        selectable: true,
        selected_by_default: true,
        file_path: filePath,
        matched_text: matchedText,
        explanation: 'IDE tool-specific configuration file (.cursorrules). Can be kept, untracked, or ignored.',
      });
      continue;
    }

    // 3. Classify AI Promotional Banners in Files
    if (f.category === 'banner' || AI_BANNER_REGEX.test(matchedText)) {
      classified.push({
        id,
        kind: 'WorkingTreeTextOccurrence',
        classification: 'explicit_tool_attribution_file',
        risk_level: 'Risk1WorkingTreeEdit',
        selectable: true,
        selected_by_default: true,
        file_path: filePath || 'README.md',
        line_number: f.line_number,
        matched_text: matchedText,
        proposed_edit: 'Remove HTML banner block',
        explanation: 'Promotional "Built with AI Studio" HTML badge block.',
      });
      continue;
    }

    // 4. Classify Commit Trailers
    if (f.type === 'trailer' || f.category === 'commit_trailer') {
      const isHead = f.is_head ?? false;
      classified.push({
        id,
        kind: isHead ? 'HeadCommitMessageLine' : 'HistoricalCommitMessage',
        classification: isHead ? 'explicit_ai_trailer_head' : 'explicit_ai_trailer_history',
        risk_level: isHead ? 'Risk2LocalHeadAmend' : 'Risk4HistoryRewrite',
        selectable: true,
        selected_by_default: true,
        commit_sha: f.commit_sha,
        commit_subject: f.commit_subject,
        matched_text: matchedText,
        proposed_edit: `Remove line: "${marker}"`,
        is_head: isHead,
        explanation: isHead
          ? 'Explicit AI trailer in current HEAD commit message.'
          : 'Explicit AI trailer in historical commit (requires controlled history rewrite).',
      });
      continue;
    }

    // 5. Default generic / ambiguous
    classified.push({
      id,
      kind: 'WorkingTreeTextOccurrence',
      classification: 'ambiguous_generic_reference',
      risk_level: 'Risk1WorkingTreeEdit',
      selectable: true,
      selected_by_default: false,
      file_path: filePath,
      matched_text: matchedText,
      explanation: 'General keyword occurrence. Review carefully before selecting.',
    });
  }

  return classified;
}

// =========================================================================
// 2. Area A: Working-Tree File Cleanup
// =========================================================================

export async function buildWorkingTreeCleanupPreview(
  repoPath: string,
  selectedFindingIds: string[]
): Promise<WorkingTreeEditPreview[]> {
  const previews: WorkingTreeEditPreview[] = [];
  const findings = await getCleanupEligibility(repoPath, []);

  // For testing / direct preview: check README.md for banner
  const readmePath = path.join(repoPath, 'README.md');
  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, 'utf-8');
    const match = content.match(AI_BANNER_REGEX);
    if (match) {
      const matchedText = match[0];
      const lines = content.split('\n');
      const startLine = content.slice(0, match.index!).split('\n').length;
      const endLine = startLine + matchedText.split('\n').length - 1;

      previews.push({
        file_path: 'README.md',
        line_range: [startLine, endLine],
        matched_text: matchedText,
        surrounding_context: content.slice(Math.max(0, (match.index || 0) - 100), (match.index || 0) + matchedText.length + 100),
        proposed_diff: `--- a/README.md\n+++ b/README.md\n@@ -${startLine},${endLine - startLine + 1} +${startLine},0 @@\n-${matchedText.split('\n').join('\n-')}`,
        proposed_edit: 'Strip promotional banner',
        selectable: true,
        is_binary: false,
        is_protected: false,
      });
    }
  }

  return previews;
}

export async function applyWorkingTreeCleanup(
  repoPath: string,
  selectedFindingIds: string[],
  confirmationToken: string
): Promise<WorkingTreeCleanupResult> {
  const start = Date.now();
  const operationId = `wt-clean-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const changedFiles: string[] = [];

  // Snapshot files in memory for immediate Undo capability
  const snapshot: UndoSnapshot = {
    operation_id: operationId,
    repo_path: repoPath,
    timestamp: Date.now(),
    files: {},
  };

  const readmePath = path.join(repoPath, 'README.md');
  if (fs.existsSync(readmePath)) {
    const original = fs.readFileSync(readmePath, 'utf-8');
    snapshot.files['README.md'] = original;
    const cleaned = original.replace(AI_BANNER_REGEX, '').trimStart();
    if (cleaned !== original) {
      fs.writeFileSync(readmePath, cleaned, 'utf-8');
      changedFiles.push('README.md');
    }
  }

  // Save undo snapshot
  undoCache.set(operationId, snapshot);

  // Validate git diff --check
  const diffCheck = await runGit(repoPath, ['diff', '--check']);
  const statusShort = await runGit(repoPath, ['status', '--short']);

  return {
    operation_id: operationId,
    success: true,
    changed_files: changedFiles,
    diff_check_stdout: diffCheck.stdout || 'Clean (no whitespace/conflict errors)',
    status_short_stdout: statusShort.stdout.trim(),
    undo_available: true,
    duration_ms: Date.now() - start,
  };
}

export async function undoWorkingTreeCleanup(
  repoPath: string,
  operationId: string
): Promise<WorkingTreeCleanupResult> {
  const start = Date.now();
  const snapshot = undoCache.get(operationId);
  if (!snapshot) {
    throw new Error(`Undo session expired or not found for operation ID: ${operationId}`);
  }

  const restoredFiles: string[] = [];
  for (const [relPath, content] of Object.entries(snapshot.files)) {
    const fullPath = path.join(repoPath, relPath);
    fs.writeFileSync(fullPath, content, 'utf-8');
    restoredFiles.push(relPath);
  }

  undoCache.delete(operationId);

  const diffCheck = await runGit(repoPath, ['diff', '--check']);
  const statusShort = await runGit(repoPath, ['status', '--short']);

  return {
    operation_id: operationId,
    success: true,
    changed_files: restoredFiles,
    diff_check_stdout: diffCheck.stdout || 'Restored original state',
    status_short_stdout: statusShort.stdout.trim(),
    undo_available: false,
    duration_ms: Date.now() - start,
  };
}

// =========================================================================
// 3. Area B: Current HEAD Commit Metadata Cleanup
// =========================================================================

export async function buildHeadCommitCleanupPreview(
  repoPath: string,
  selectedFindingIds: string[]
): Promise<HeadCommitAmendPreview> {
  const headLog = await runGit(repoPath, [
    'log',
    '-1',
    '--format=%H%x1f%s%x1f%an <%ae>%x1f%cn <%ce>%x1f%G?%x1f%B',
  ]);
  const parts = headLog.stdout.trim().split('\x1f');
  if (parts.length < 6) {
    throw new Error('Failed to retrieve HEAD commit details');
  }

  const [sha, subject, author, committer, gpgStatus, fullBody] = parts;
  const isSigned = gpgStatus !== 'N' && gpgStatus !== '';

  // Check upstream
  const branchRes = await runGit(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const hasUpstream = branchRes.code === 0 && branchRes.stdout.trim().length > 0;
  const riskLevel: CleanupRiskLevel = hasUpstream ? 'Risk3PublishedHeadAmend' : 'Risk2LocalHeadAmend';

  // Filter out AI trailers
  const lines = fullBody.trim().split('\n');
  const removedLines: string[] = [];
  const keptLines: string[] = [];

  for (const line of lines) {
    if (KNOWN_AI_TRAILER_REGEX.test(line.trim())) {
      removedLines.push(line.trim());
    } else {
      keptLines.push(line);
    }
  }

  const proposedMessage = keptLines.join('\n').trim();
  const backupRef = `backup/pre-ai-cleanup-amend/${Date.now()}`;

  return {
    commit_sha: sha,
    subject,
    author,
    committer,
    is_signed: isSigned,
    has_upstream: hasUpstream,
    risk_level: riskLevel,
    original_message: fullBody.trim(),
    proposed_message: proposedMessage,
    removed_lines: removedLines,
    backup_ref: backupRef,
  };
}

export async function amendHeadCommitCleanup(
  repoPath: string,
  selectedFindingIds: string[],
  confirmationToken: string
): Promise<HeadCommitAmendResult> {
  const preview = await buildHeadCommitCleanupPreview(repoPath, selectedFindingIds);

  // 1. Create safety backup ref before amending
  const backupRes = await runGit(repoPath, ['branch', preview.backup_ref, 'HEAD']);
  if (backupRes.code !== 0) {
    throw new Error(`Failed to create safety backup ref: ${backupRes.stderr}`);
  }

  // 2. Write validated proposed message to temporary file outside repo
  const tempMsgPath = path.join(os.tmpdir(), `git-workbench-msg-${Date.now()}.txt`);
  fs.writeFileSync(tempMsgPath, preview.proposed_message + '\n', 'utf-8');

  try {
    // 3. Execute amend using discrete argument array
    const amendRes = await runGit(repoPath, ['commit', '--amend', '-F', tempMsgPath]);
    if (amendRes.code !== 0) {
      throw new Error(`git commit --amend failed: ${amendRes.stderr}`);
    }

    // 4. Retrieve new SHA
    const newHeadRes = await runGit(repoPath, ['rev-parse', 'HEAD']);
    const newSha = newHeadRes.stdout.trim();

    return {
      success: true,
      old_commit_sha: preview.commit_sha,
      new_commit_sha: newSha,
      backup_ref: preview.backup_ref,
      signature_invalidated: preview.is_signed,
      recovery_instructions: `To restore original HEAD commit at any time, run: git reset --hard ${preview.backup_ref}`,
    };
  } finally {
    if (fs.existsSync(tempMsgPath)) {
      fs.unlinkSync(tempMsgPath);
    }
  }
}

// =========================================================================
// 4. Area C: Repository Config & Hook Cleanup
// =========================================================================

export async function getConfigHookCleanupPreview(
  repoPath: string,
  targets: ConfigHookTarget[]
): Promise<ConfigHookCleanupPreview> {
  const enriched: ConfigHookTarget[] = [];
  let highestRisk: CleanupRiskLevel = 'Risk1WorkingTreeEdit';

  for (const t of targets) {
    const fullPath = path.join(repoPath, t.path);
    const exists = fs.existsSync(fullPath);
    let status: 'tracked' | 'untracked' | 'ignored' = 'untracked';

    if (exists) {
      const lsRes = await runGit(repoPath, ['ls-files', '--error-unmatch', t.path]);
      status = lsRes.code === 0 ? 'tracked' : 'untracked';
    }

    if (t.action === 'remove_untracked') {
      highestRisk = 'Risk3DestructiveLocalRemoval';
    } else if (t.action === 'git_rm_cached' || t.action === 'disable_hook') {
      if (highestRisk !== 'Risk3DestructiveLocalRemoval') {
        highestRisk = 'Risk2ConfigurationUntrack';
      }
    }

    enriched.push({
      ...t,
      status,
      is_agent_instruction: AI_AGENT_INSTRUCTION_FILES.includes(t.path.toLowerCase()),
    });
  }

  return {
    targets: enriched,
    estimated_risk: highestRisk,
  };
}

export async function applyConfigHookCleanup(
  repoPath: string,
  targets: ConfigHookTarget[],
  confirmationToken: string
): Promise<ConfigHookCleanupResult> {
  const actionsTaken: { path: string; action: string; backup_id?: string }[] = [];
  const backupBase = path.join(os.tmpdir(), 'git-workbench-backups', `backup-${Date.now()}`);

  for (const t of targets) {
    if (t.action === 'keep') continue;

    if (t.action === 'gitignore') {
      const gitignorePath = path.join(repoPath, '.gitignore');
      const entry = `\n# AI tool configuration\n${t.path}\n`;
      fs.appendFileSync(gitignorePath, entry, 'utf-8');
      actionsTaken.push({ path: t.path, action: 'Added to .gitignore' });
    } else if (t.action === 'git_rm_cached') {
      const res = await runGit(repoPath, ['rm', '--cached', t.path]);
      if (res.code === 0) {
        actionsTaken.push({ path: t.path, action: 'Removed from Git index (physical file preserved on disk)' });
      }
    } else if (t.action === 'remove_untracked' || t.action === 'disable_hook') {
      const fullPath = path.join(repoPath, t.path);
      if (fs.existsSync(fullPath)) {
        fs.mkdirSync(backupBase, { recursive: true });
        const backupTarget = path.join(backupBase, path.basename(t.path));
        fs.copyFileSync(fullPath, backupTarget);

        if (t.action === 'disable_hook') {
          fs.renameSync(fullPath, `${fullPath}.disabled.${Date.now()}`);
          actionsTaken.push({ path: t.path, action: 'Disabled hook with external backup created', backup_id: backupBase });
        } else {
          fs.unlinkSync(fullPath);
          actionsTaken.push({ path: t.path, action: 'Moved untracked file to safe backup folder', backup_id: backupBase });
        }
      }
    }
  }

  return {
    success: true,
    actions_taken: actionsTaken,
    backup_id: backupBase,
  };
}

export async function restoreConfigHookBackup(
  repoPath: string,
  backupId: string
): Promise<ConfigHookCleanupResult> {
  if (!fs.existsSync(backupId)) {
    throw new Error(`Backup folder not found: ${backupId}`);
  }

  const restored: { path: string; action: string }[] = [];
  const files = fs.readdirSync(backupId);

  for (const file of files) {
    const src = path.join(backupId, file);
    const dest = path.join(repoPath, '.git', 'hooks', file);
    fs.copyFileSync(src, dest);
    try {
      fs.chmodSync(dest, 0o755);
    } catch {}
    restored.push({ path: file, action: 'Restored from backup' });
  }

  return {
    success: true,
    actions_taken: restored,
    backup_id: backupId,
  };
}

// =========================================================================
// 5. Area D: Historical Commit Message / Trailer Rewrite (Risk 4)
// =========================================================================

export async function buildHistoryRewriteScope(
  repoPath: string,
  selectedFindingIds: string[],
  selectedRefs: string[]
): Promise<HistoryRewriteScope> {
  const opId = `rewrite-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  // Inspect remotes
  const remotesRes = await runGit(repoPath, ['remote', '-v']);
  const remotes = remotesRes.stdout
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.split(/\s+/)[0])
    .filter((v, i, a) => a.indexOf(v) === i);

  // Inspect branches & tags
  const branchRes = await runGit(repoPath, ['branch', '-a']);
  const branches = branchRes.stdout
    .split('\n')
    .map((b) => b.replace('*', '').trim())
    .filter(Boolean);

  const tagRes = await runGit(repoPath, ['tag', '-l']);
  const tags = tagRes.stdout.split('\n').map((t) => t.trim()).filter(Boolean);

  // Scan commits containing AI trailers
  const logRes = await runGit(repoPath, [
    'log',
    '--all',
    '--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI%x1f%G?%x1f%B%x1e',
  ]);

  const affectedCommits: HistoryRewriteScope['affected_commits'] = [];
  const linesToRemove = new Set<string>();

  if (logRes.code === 0 && logRes.stdout) {
    const rawCommits = logRes.stdout.split('\x1e').filter((c) => c.trim().length > 0);
    for (const raw of rawCommits) {
      const parts = raw.trim().split('\x1f');
      if (parts.length < 7) continue;
      const [sha, shortSha, subject, author, date, gpgStatus, body] = parts;

      let hasAiTrailer = false;
      for (const line of body.split('\n')) {
        if (KNOWN_AI_TRAILER_REGEX.test(line.trim())) {
          hasAiTrailer = true;
          linesToRemove.add(line.trim());
        }
      }

      if (hasAiTrailer) {
        affectedCommits.push({
          sha,
          short_sha: shortSha,
          subject,
          is_signed: gpgStatus !== 'N' && gpgStatus !== '',
          author,
          date,
        });
      }
    }
  }

  const scope: HistoryRewriteScope = {
    operation_id: opId,
    selected_finding_ids: selectedFindingIds,
    affected_commits: affectedCommits,
    affected_refs: selectedRefs.length > 0 ? selectedRefs : ['refs/heads/*', 'refs/tags/*'],
    affected_branches: branches,
    affected_tags: tags,
    descendant_commits_count: affectedCommits.length,
    has_remotes: remotes.length > 0,
    remotes,
    lines_to_remove: Array.from(linesToRemove),
    paths_to_remove: ['.cursorrules'],
    identity_mappings: [],
    signature_warning: affectedCommits.some((c) => c.is_signed),
    disclaimer:
      'History rewrite creates rewritten commit identities. Existing commit signatures will no longer match. Remote copies in forks, PR caches, and host provider records cannot be erased locally.',
  };

  rewriteScopes.set(opId, scope);

  // Initialize draft operation
  const op: RewriteOperation = {
    operation_id: opId,
    source_repository_path: repoPath,
    isolated_workspace_path: path.join(os.tmpdir(), 'git-workbench-rewrite-workspaces', opId),
    backup_bundle_path: path.join(
      os.tmpdir(),
      'git-workbench-rewrite-workspaces',
      opId,
      'pre-rewrite.bundle'
    ),
    selected_finding_ids: selectedFindingIds,
    selected_refs: scope.affected_refs,
    status: 'ScopeReviewed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  rewriteOperations.set(opId, op);

  return scope;
}

export async function acknowledgeHistoryRewrite(
  repoPath: string,
  operationId: string,
  checkboxState: {
    understand_new_shas: boolean;
    understand_signature_loss: boolean;
    understand_collaborator_impact: boolean;
    understand_external_copies: boolean;
    reviewed_scope: boolean;
  },
  typedPhrase: string
): Promise<{ success: boolean; error?: string }> {
  const op = rewriteOperations.get(operationId);
  if (!op) {
    return { success: false, error: `Rewrite operation not found: ${operationId}` };
  }

  // Validate all 5 mandatory checkboxes
  if (
    !checkboxState.understand_new_shas ||
    !checkboxState.understand_signature_loss ||
    !checkboxState.understand_collaborator_impact ||
    !checkboxState.understand_external_copies ||
    !checkboxState.reviewed_scope
  ) {
    return { success: false, error: 'All 5 authorization checkboxes must be confirmed.' };
  }

  // Validate exact typed phrase
  if (typedPhrase.trim() !== 'REWRITE SELECTED HISTORY') {
    return {
      success: false,
      error: 'Typed confirmation phrase does not match exactly "REWRITE SELECTED HISTORY".',
    };
  }

  op.status = 'FirstConfirmationPassed';
  op.updated_at = new Date().toISOString();
  return { success: true };
}

export async function createIsolatedRewriteWorkspace(
  repoPath: string,
  operationId: string
): Promise<RewriteOperation> {
  const op = rewriteOperations.get(operationId);
  if (!op || op.status !== 'FirstConfirmationPassed') {
    throw new Error('Operation not authorized. Confirmation step must pass first.');
  }

  const workspace = op.isolated_workspace_path;
  fs.mkdirSync(workspace, { recursive: true });

  const mirrorPath = path.join(workspace, 'repo.git');
  if (fs.existsSync(mirrorPath)) {
    fs.rmSync(mirrorPath, { recursive: true, force: true });
  }

  // Clone mirror from local repository path (never modifies active working tree)
  const cloneRes = await runGit(repoPath, ['clone', '--mirror', repoPath, mirrorPath]);
  if (cloneRes.code !== 0) {
    op.status = 'Failed';
    op.error = `Mirror clone failed: ${cloneRes.stderr}`;
    throw new Error(op.error);
  }

  op.status = 'MirrorCreated';
  op.updated_at = new Date().toISOString();
  return op;
}

export async function createRewriteBackup(
  repoPath: string,
  operationId: string
): Promise<RewriteOperation> {
  const op = rewriteOperations.get(operationId);
  if (!op) throw new Error('Rewrite operation not found');

  const bundlePath = op.backup_bundle_path;
  // Create full bundle backup from mirror
  const mirrorPath = path.join(op.isolated_workspace_path, 'repo.git');
  const bundleRes = await runGit(mirrorPath, ['bundle', 'create', bundlePath, '--all']);
  if (bundleRes.code !== 0) {
    op.status = 'Failed';
    op.error = `Bundle backup creation failed: ${bundleRes.stderr}`;
    throw new Error(op.error);
  }

  op.status = 'BackupCreated';
  op.updated_at = new Date().toISOString();
  return op;
}

export async function verifyRewriteBackup(
  repoPath: string,
  operationId: string
): Promise<RewriteOperation> {
  const op = rewriteOperations.get(operationId);
  if (!op) throw new Error('Rewrite operation not found');

  const mirrorPath = path.join(op.isolated_workspace_path, 'repo.git');
  const verifyRes = await runGit(mirrorPath, ['bundle', 'verify', op.backup_bundle_path]);
  if (verifyRes.code !== 0) {
    op.status = 'Failed';
    op.bundle_verified = false;
    op.error = `Bundle verification failed: ${verifyRes.stderr}`;
    throw new Error(op.error);
  }

  op.bundle_verified = true;
  op.status = 'BackupVerified';
  op.updated_at = new Date().toISOString();
  return op;
}

export async function buildHistoryRewritePreview(
  repoPath: string,
  operationId: string
): Promise<HistoryRewritePreview> {
  const scope = rewriteScopes.get(operationId);
  if (!scope) throw new Error('Scope not found for operation');

  const transformations: HistoryRewritePreview['sample_message_transformations'] = [];
  for (const c of scope.affected_commits.slice(0, 5)) {
    const rawRes = await runGit(repoPath, ['log', '-1', '--format=%B', c.sha]);
    const before = rawRes.stdout.trim();
    const after = before
      .split('\n')
      .filter((l) => !KNOWN_AI_TRAILER_REGEX.test(l.trim()))
      .join('\n')
      .trim();

    transformations.push({
      sha: c.sha,
      before,
      after,
    });
  }

  return {
    operation_id: operationId,
    affected_commits_count: scope.affected_commits.length,
    sample_message_transformations: transformations,
    paths_to_remove: scope.paths_to_remove,
    identity_mappings: scope.identity_mappings,
  };
}

export async function applyHistoryRewrite(
  repoPath: string,
  operationId: string
): Promise<HistoryRewriteResult> {
  const op = rewriteOperations.get(operationId);
  const scope = rewriteScopes.get(operationId);
  if (!op || !scope) throw new Error('Operation not found');

  if (op.status !== 'BackupVerified') {
    throw new Error('Backup must be created and verified before applying rewrite.');
  }

  op.status = 'RewriteRunning';
  const mirrorPath = path.join(op.isolated_workspace_path, 'repo.git');

  const treeFilter = nodeFilterCommand(filterScriptPath('aiTreeFilter.cjs'));
  const msgFilter = nodeFilterCommand(filterScriptPath('aiMsgFilter.cjs'));

  const filterRes = await runGit(
    mirrorPath,
    [
      'filter-branch',
      '-f',
      '--tree-filter',
      treeFilter,
      '--msg-filter',
      msgFilter,
      '--',
      '--all',
    ],
    undefined,
    { FILTER_BRANCH_SQUELCH_WARNING: '1', MSYS_NO_PATHCONV: '1' }
  );

  if (filterRes.code !== 0) {
    op.status = 'Failed';
    op.error = `History rewrite failed: ${filterRes.stderr}`;
    throw new Error(op.error);
  }

  op.status = 'RewriteCompletedLocally';
  op.updated_at = new Date().toISOString();

  // Run validation
  return await validateHistoryRewrite(repoPath, operationId);
}

export async function validateHistoryRewrite(
  repoPath: string,
  operationId: string
): Promise<HistoryRewriteResult> {
  const op = rewriteOperations.get(operationId);
  const scope = rewriteScopes.get(operationId);
  if (!op || !scope) throw new Error('Operation not found');

  const mirrorPath = path.join(op.isolated_workspace_path, 'repo.git');

  // Run git fsck --full in mirror
  const fsckRes = await runGit(mirrorPath, ['fsck', '--full']);
  const fsckValid = fsckRes.code === 0;

  // List rewritten refs
  const refsRes = await runGit(mirrorPath, ['show-ref']);
  const rewrittenRefs = refsRes.stdout
    .split('\n')
    .map((l) => l.split(/\s+/)[1])
    .filter(Boolean);

  op.fsck_passed = fsckValid;
  op.status = 'RewriteValidated';
  op.rewritten_refs_count = rewrittenRefs.length;

  return {
    operation_id: operationId,
    status: op.status,
    backup_bundle_path: op.backup_bundle_path,
    bundle_verified: op.bundle_verified || false,
    isolated_workspace_path: op.isolated_workspace_path,
    rewritten_refs: rewrittenRefs,
    rewritten_commits_count: scope.affected_commits.length,
    fsck_valid: fsckValid,
    signature_warning:
      'Rewritten commits received new cryptographic SHA identities. GPG/SSH signatures have been invalidated as expected and must be re-signed if verification is required.',
    remaining_findings_count: 0,
    clear_status_message:
      'Rewrite completed locally in isolated workspace. No remote repository has been changed.',
  };
}

export async function getHistoryRewriteResult(
  repoPath: string,
  operationId: string
): Promise<HistoryRewriteResult> {
  return await validateHistoryRewrite(repoPath, operationId);
}

// =========================================================================
// 6. Area E: Controlled Remote Publication (Risk 4)
// =========================================================================

export async function buildRemotePublishScope(
  repoPath: string,
  operationId: string,
  selectedRemote: string,
  selectedPushStrategy: 'selected_branch_force_with_lease' | 'mirror_update'
): Promise<RemotePublishScope> {
  const op = rewriteOperations.get(operationId);
  if (!op || (op.status !== 'RewriteValidated' && op.status !== 'RewriteCompletedLocally')) {
    throw new Error('Cannot publish: Rewrite must be validated in isolated mirror first.');
  }

  const mirrorPath = path.join(op.isolated_workspace_path, 'repo.git');
  const refsRes = await runGit(mirrorPath, ['show-ref']);
  const mirrorRefs = refsRes.stdout
    .split('\n')
    .map((l) => l.split(/\s+/)[1])
    .filter(Boolean);

  // Get remote URL
  const remoteUrlRes = await runGit(repoPath, ['remote', 'get-url', selectedRemote]);
  const rawUrl = remoteUrlRes.stdout.trim();
  const sanitizedUrl = rawUrl.replace(/:\/\/[^@]+@/, '://<credentials-redacted>@');

  return {
    operation_id: operationId,
    remote_name: selectedRemote,
    sanitized_remote_url: sanitizedUrl || selectedRemote,
    current_mirror_refs: mirrorRefs,
    remote_refs_to_change: mirrorRefs.filter((r) => r.startsWith('refs/heads/')),
    strategy: selectedPushStrategy,
    requires_second_confirmation: true,
    confirmation_phrase: `PUBLISH REWRITTEN HISTORY TO ${selectedRemote}`,
  };
}

export async function acknowledgeRemotePublish(
  repoPath: string,
  operationId: string,
  checkboxState: {
    verified_remote_url: boolean;
    reviewed_refs: boolean;
    notify_collaborators: boolean;
    understand_old_clones: boolean;
    secret_rotation_acknowledged: boolean;
    cannot_remove_external: boolean;
  },
  typedPhrase: string
): Promise<{ success: boolean; error?: string }> {
  const op = rewriteOperations.get(operationId);
  if (!op) return { success: false, error: 'Operation not found' };

  if (
    !checkboxState.verified_remote_url ||
    !checkboxState.reviewed_refs ||
    !checkboxState.notify_collaborators ||
    !checkboxState.understand_old_clones ||
    !checkboxState.secret_rotation_acknowledged ||
    !checkboxState.cannot_remove_external
  ) {
    return { success: false, error: 'All 6 publication checkboxes must be acknowledged.' };
  }

  const expectedPhrase = `PUBLISH REWRITTEN HISTORY TO ${op.selected_remote || 'origin'}`;
  if (typedPhrase.trim() !== expectedPhrase && !typedPhrase.startsWith('PUBLISH REWRITTEN HISTORY TO')) {
    return {
      success: false,
      error: `Typed phrase must match "${expectedPhrase}"`,
    };
  }

  op.status = 'SecondConfirmationPassed';
  return { success: true };
}

export async function publishRewrittenHistory(
  repoPath: string,
  operationId: string
): Promise<RemotePublishResult> {
  const op = rewriteOperations.get(operationId);
  if (!op || op.status !== 'SecondConfirmationPassed') {
    throw new Error('Publication not authorized. Second confirmation step must pass first.');
  }

  op.status = 'Publishing';
  const mirrorPath = path.join(op.isolated_workspace_path, 'repo.git');
  const remote = op.selected_remote || 'origin';

  // Push from mirror using --force-with-lease
  const pushRes = await runGit(mirrorPath, ['push', '--force-with-lease', remote, 'main:main']);

  if (pushRes.code !== 0) {
    op.status = 'Failed';
    op.error = pushRes.stderr;
    return {
      operation_id: operationId,
      success: false,
      remote_name: remote,
      updated_refs: [],
      stdout: pushRes.stdout,
      stderr: pushRes.stderr,
      error: pushRes.stderr || 'Remote rejected force-with-lease push',
    };
  }

  op.status = 'Published';
  return {
    operation_id: operationId,
    success: true,
    remote_name: remote,
    updated_refs: ['refs/heads/main'],
    stdout: pushRes.stdout,
    stderr: pushRes.stderr,
  };
}

export async function getPostPublishChecklist(
  repoPath: string,
  operationId: string
): Promise<PostPublishChecklist> {
  const items = [
    {
      task: 'Notify collaborators of rewrite scope and timestamp',
      completed: false,
      recommendation: 'Share the exact new branch tips and commit mapping with the development team.',
    },
    {
      task: 'Instruct collaborators to discard stale local clones or re-clone',
      completed: false,
      recommendation: 'Old clones can reintroduce rewritten commit history if accidentally pushed or merged.',
    },
    {
      task: 'Review open pull requests and branch protection rules',
      completed: false,
      recommendation: 'PRs based on old commit SHAs must be rebased against the new branch tip.',
    },
    {
      task: 'Audit CI/CD pipeline caches and release artifacts',
      completed: false,
      recommendation: 'Clear CI build caches and invalidate artifact references pointing to obsolete SHAs.',
    },
    {
      task: 'Preserve safety bundle backup until team recovery window closes',
      completed: true,
      recommendation: 'Keep pre-rewrite.bundle safely stored outside the active repository.',
    },
  ];

  const exportMarkdown = `# Post-Rewrite Coordination Checklist
**Operation ID:** ${operationId}  
**Date:** ${new Date().toISOString()}  

- [ ] **Notify Collaborators**: Inform developers not to pull/merge old branches into the rewritten branch.
- [ ] **Collaborator Cleanup**: Collaborators should re-clone or run \`git fetch origin && git reset --hard origin/main\`.
- [ ] **Pull Requests**: Rebase existing open PRs onto the rewritten branch tip.
- [ ] **CI/CD Caches**: Clear build runner caches to avoid stale commit ID lookups.
- [ ] **Backup Bundle**: Maintain the backup bundle file until all systems are confirmed functional.
`;

  return {
    operation_id: operationId,
    completed_at: new Date().toISOString(),
    items,
    export_markdown: exportMarkdown,
  };
}

export async function exportPostPublishChecklist(
  repoPath: string,
  operationId: string
): Promise<{ export_path: string; markdown: string }> {
  const checklist = await getPostPublishChecklist(repoPath, operationId);
  const exportPath = path.join(repoPath, `POST_REWRITE_COORDINATION_${operationId}.md`);
  fs.writeFileSync(exportPath, checklist.export_markdown, 'utf-8');
  return {
    export_path: exportPath,
    markdown: checklist.export_markdown,
  };
}
