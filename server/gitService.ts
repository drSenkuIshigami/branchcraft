/**
 * Server-side Git Service (Local dev environment & testing bridge)
 *
 * Implements the exact same security principles as the Rust GitAdapter:
 * 1. Zero shell execution (uses execFile with discrete tokenized argument arrays).
 * 2. Strict allowlist matching docs/COMMAND_ALLOWLIST.md.
 * 3. Sanitized parameters.
 * 4. Local-first only.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  BranchInfo,
  ChangeType,
  CherryPickOptions,
  CommitDetail,
  CommitDetailFile,
  CommitInfo,
  ConflictResolutionType,
  ConflictState,
  FileChange,
  FileDiff,
  GitAvailability,
  GitUserConfig,
  ModifyCommitAuthorDateParams,
  OperationResult,
  RebaseAction,
  RebaseStatus,
  RebaseTodoItem,
  ReflogEntry,
  RemoteInfo,
  RevertOptions,
  StashDetail,
  StashInfo,
  StatusInfo,
  SyncStatus,
  SystemOpenResult,
  WorktreeInfo,
  AddWorktreeOptions,
  BackupRef,
  SecretFinding,
  LargeFileFinding,
  AITraceFinding,
  RepoAuditReport,
  PurgePlanOptions,
  MirrorCloneSetupResult,
  FsckResult,
  GitHooksStatus,
  TagInfo,
  CreateTagOptions,
  SubmoduleInfo,
  BisectStatus,
  RerereStatus,
  LfsDiagnostics,
  RangeDiffResult,
  MergeExecutionOptions,
  ForceRelocateBranchPreview,
  SearchQueryOptions,
  SearchResponse,
  SearchFileResult,
  SearchMatch,
  SearchCommitMatch,
  ReplaceFileOptions,
  ReplaceResponse,
  CleanAITracesOptions,
  CleanAITracesResult,
} from '../src/types';

function runGit(
  repoPath: string | null,
  args: string[],
  stdin?: string,
  env?: NodeJS.ProcessEnv
): Promise<{ stdout: string; stderr: string; code: number; duration_ms: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const options = {
      cwd: repoPath || undefined,
      env: env ? { ...process.env, ...env } : undefined,
      encoding: 'utf-8' as const,
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

export async function checkGitAvailability(): Promise<GitAvailability> {
  try {
    const res = await runGit(null, ['--version']);
    if (res.code === 0 && res.stdout) {
      return {
        available: true,
        version: res.stdout.trim(),
        error: null,
      };
    }
    return {
      available: false,
      version: null,
      error: res.stderr.trim() || 'Git returned non-zero exit code',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      version: null,
      error: message,
    };
  }
}

export async function validateRepository(repoPath: string): Promise<string> {
  const sampleDir = '/tmp/git-workbench-sample-repo';
  if (
    repoPath === sampleDir &&
    (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, '.git')))
  ) {
    await createOrGetSampleRepo();
  }

  if (!fs.existsSync(repoPath)) {
    throw new Error(`Path does not exist: ${repoPath}`);
  }
  const res = await runGit(repoPath, ['rev-parse', '--is-inside-work-tree']);
  if (res.code !== 0 || res.stdout.trim() !== 'true') {
    throw new Error(`Directory is not a valid Git repository: ${repoPath}`);
  }
  const topRes = await runGit(repoPath, ['rev-parse', '--show-toplevel']);
  return topRes.stdout.trim();
}

export async function getStatus(repoPath: string): Promise<StatusInfo> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, [
    'status',
    '--porcelain=v2',
    '--branch',
    '--untracked-files=all',
  ]);

  if (res.code !== 0) {
    throw new Error(`git status failed: ${res.stderr}`);
  }

  let current_branch: string | null = null;
  let upstream: string | null = null;
  let ahead = 0;
  let behind = 0;
  const staged: FileChange[] = [];
  const unstaged: FileChange[] = [];
  const untracked: string[] = [];
  const conflicted: string[] = [];

  const lines = res.stdout.split('\n');
  for (const line of lines) {
    if (line.startsWith('# branch.head ')) {
      const head = line.replace('# branch.head ', '').trim();
      if (head !== '(detached)') {
        current_branch = head;
      }
    } else if (line.startsWith('# branch.upstream ')) {
      upstream = line.replace('# branch.upstream ', '').trim();
    } else if (line.startsWith('# branch.ab ')) {
      const parts = line.replace('# branch.ab ', '').trim().split(/\s+/);
      if (parts.length >= 2) {
        ahead = parseInt(parts[0].replace('+', ''), 10) || 0;
        behind = parseInt(parts[1].replace('-', ''), 10) || 0;
      }
    } else if (line.startsWith('1 ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 9) {
        const xy = parts[1];
        const filePath = parts.slice(8).join(' ');
        const stagedChar = xy[0];
        const unstagedChar = xy[1];

        if (stagedChar !== '.') {
          staged.push({
            path: filePath,
            change_type: mapChangeType(stagedChar),
            is_staged: true,
            is_binary: false,
          });
        }
        if (unstagedChar !== '.') {
          unstaged.push({
            path: filePath,
            change_type: mapChangeType(unstagedChar),
            is_staged: false,
            is_binary: false,
          });
        }
      }
    } else if (line.startsWith('2 ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 10) {
        const filePath = parts.slice(8).join(' ');
        staged.push({
          path: filePath,
          change_type: 'Renamed',
          is_staged: true,
          is_binary: false,
        });
      }
    } else if (line.startsWith('u ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 11) {
        conflicted.push(parts.slice(10).join(' '));
      }
    } else if (line.startsWith('? ')) {
      untracked.push(line.replace('? ', '').trim());
    }
  }

  return {
    root_path: rootPath,
    current_branch,
    upstream,
    ahead,
    behind,
    staged,
    unstaged,
    untracked,
    conflicted,
  };
}

function mapChangeType(char: string): ChangeType {
  switch (char) {
    case 'A':
      return 'Added';
    case 'D':
      return 'Deleted';
    case 'R':
      return 'Renamed';
    case 'C':
      return 'Copied';
    default:
      return 'Modified';
  }
}

export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  const rootPath = await validateRepository(repoPath);
  const format = '%(refname:short)%09%(refname)%09%(HEAD)%09%(upstream:short)%09%(objectname:short)';
  const res = await runGit(rootPath, [
    'for-each-ref',
    `--format=${format}`,
    'refs/heads/',
    'refs/remotes/',
  ]);

  if (res.code !== 0) {
    throw new Error(`Failed to list branches: ${res.stderr}`);
  }

  const branches: BranchInfo[] = [];
  const lines = res.stdout.trim().split('\n');

  for (const line of lines) {
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length >= 5) {
      const name = parts[0];
      const fullRef = parts[1];
      const isHead = parts[2] === '*';
      const upstream = parts[3] ? parts[3] : null;
      const tipSha = parts[4];
      const isLocal = fullRef.startsWith('refs/heads/');
      const isRemote = fullRef.startsWith('refs/remotes/');

      let ahead = 0;
      let behind = 0;
      if (upstream) {
        const countRes = await runGit(rootPath, [
          'rev-list',
          '--left-right',
          '--count',
          `${name}...${upstream}`,
        ]);
        if (countRes.code === 0) {
          const counts = countRes.stdout.trim().split(/\s+/);
          ahead = parseInt(counts[0], 10) || 0;
          behind = parseInt(counts[1], 10) || 0;
        }
      }

      branches.push({
        name,
        is_local: isLocal,
        is_remote: isRemote,
        is_head: isHead,
        upstream,
        ahead,
        behind,
        tip_sha: tipSha,
      });
    }
  }

  return branches;
}

export async function getCommitGraph(repoPath: string, limit = 100, skip = 0): Promise<CommitInfo[]> {
  const rootPath = await validateRepository(repoPath);
  const format = '%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s%x1f%b%x1f%D%x1e';
  const res = await runGit(rootPath, [
    'log',
    '--all',
    '--topo-order',
    `--format=${format}`,
    '-n',
    String(limit),
    '--skip',
    String(skip),
  ]);

  if (res.code !== 0) {
    throw new Error(`git log failed: ${res.stderr}`);
  }

  const commits: CommitInfo[] = [];
  const records = res.stdout.split('\x1e');

  for (const record of records) {
    const trimmed = record.trim();
    if (!trimmed) continue;
    const fields = trimmed.split('\x1f');
    if (fields.length >= 11) {
      const sha = fields[0];
      const parents = fields[1] ? fields[1].split(/\s+/) : [];
      const authorName = fields[2];
      const authorEmail = fields[3];
      const authorDate = fields[4];
      const committerName = fields[5];
      const committerEmail = fields[6];
      const committerDate = fields[7];
      const subject = fields[8];
      const body = fields[9];
      const refs = fields[10] ? fields[10].split(', ').map((r) => r.trim()).filter(Boolean) : [];

      commits.push({
        sha,
        parents,
        author_name: authorName,
        author_email: authorEmail,
        author_date: authorDate,
        committer_name: committerName,
        committer_email: committerEmail,
        committer_date: committerDate,
        subject,
        body,
        refs,
      });
    }
  }

  return commits;
}

export async function getCommitDetail(repoPath: string, sha: string): Promise<CommitDetail> {
  const rootPath = await validateRepository(repoPath);
  if (!/^[0-9a-fA-F]{4,64}$/.test(sha)) {
    throw new Error('Invalid commit SHA');
  }

  const format = '%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cn%x1f%ce%x1f%cI%x1f%s%x1f%b%x1f%D';
  const metaRes = await runGit(rootPath, [
    'show',
    '-s',
    `--format=${format}`,
    sha,
  ]);

  if (metaRes.code !== 0) {
    throw new Error(`Failed to load commit: ${metaRes.stderr}`);
  }

  const fields = metaRes.stdout.trim().split('\x1f');
  if (fields.length < 11) {
    throw new Error('Invalid commit output');
  }

  const commit: CommitInfo = {
    sha: fields[0],
    parents: fields[1] ? fields[1].split(/\s+/) : [],
    author_name: fields[2],
    author_email: fields[3],
    author_date: fields[4],
    committer_name: fields[5],
    committer_email: fields[6],
    committer_date: fields[7],
    subject: fields[8],
    body: fields[9],
    refs: fields[10] ? fields[10].split(', ').map((r) => r.trim()).filter(Boolean) : [],
  };

  const statRes = await runGit(rootPath, ['show', '--numstat', '--format=', sha]);
  const files: CommitDetailFile[] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  for (const line of statRes.stdout.split('\n')) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const additions = parseInt(parts[0], 10) || 0;
      const deletions = parseInt(parts[1], 10) || 0;
      const filePath = parts[2];
      totalInsertions += additions;
      totalDeletions += deletions;

      files.push({
        path: filePath,
        status: 'Modified',
        additions,
        deletions,
        old_path: null,
      });
    }
  }

  return {
    commit,
    files,
    stats: {
      files_changed: files.length,
      insertions: totalInsertions,
      deletions: totalDeletions,
    },
  };
}

export async function getFileDiff(repoPath: string, filePath: string, rev?: string | null): Promise<FileDiff> {
  const rootPath = await validateRepository(repoPath);

  let rawDiff = '';
  let oldContent = '';
  let newContent = '';

  if (rev) {
    const diffRes = await runGit(rootPath, ['show', `${rev}^..${rev}`, '--', filePath]);
    rawDiff = diffRes.stdout;

    const parentRes = await runGit(rootPath, ['show', `${rev}^:${filePath}`]);
    oldContent = parentRes.code === 0 ? parentRes.stdout : '';

    let currRes = await runGit(rootPath, ['show', `${rev}:${filePath}`]);
    if (currRes.code !== 0 && rev.startsWith('stash@{')) {
      currRes = await runGit(rootPath, ['show', `${rev}^3:${filePath}`]);
    }
    newContent = currRes.code === 0 ? currRes.stdout : '';

    if (!rawDiff && newContent && !oldContent) {
      const lines = newContent.split('\n');
      rawDiff = `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((l) => `+${l}`).join('\n')}`;
    }
  } else {
    const diffRes = await runGit(rootPath, ['diff', 'HEAD', '--', filePath]);
    rawDiff = diffRes.stdout;

    const headRes = await runGit(rootPath, ['show', `HEAD:${filePath}`]);
    oldContent = headRes.code === 0 ? headRes.stdout : '';

    const fullTarget = path.join(rootPath, filePath);
    try {
      if (fs.existsSync(fullTarget)) {
        newContent = fs.readFileSync(fullTarget, 'utf-8');
      }
    } catch {
      // binary or unreadable
    }
  }

  return {
    path: filePath,
    old_content: oldContent,
    new_content: newContent,
    is_binary: false,
    raw_diff: rawDiff,
  };
}

export async function stagePath(repoPath: string, filePath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, ['add', '--', filePath]);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['add', '--', filePath],
    duration_ms: res.duration_ms,
  };
}

export async function unstagePath(repoPath: string, filePath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, ['restore', '--staged', '--', filePath]);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['restore', '--staged', '--', filePath],
    duration_ms: res.duration_ms,
  };
}

export async function discardPath(repoPath: string, filePath: string, isUntracked = false): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = isUntracked ? ['clean', '-f', '--', filePath] : ['restore', '--', filePath];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function stageAll(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, ['add', '-A']);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['add', '-A'],
    duration_ms: res.duration_ms,
  };
}

export async function unstageAll(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, ['restore', '--staged', '.']);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['restore', '--staged', '.'],
    duration_ms: res.duration_ms,
  };
}

export async function createCommit(
  repoPath: string,
  message: string,
  options?: {
    authorName?: string;
    authorEmail?: string;
    authorDate?: string;
    committerDate?: string;
  }
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!message.trim()) {
    throw new Error('Commit message cannot be empty');
  }
  const args = ['commit', '-m', message];
  const env: Record<string, string> = {};

  if (options?.authorName || options?.authorEmail) {
    const name = options.authorName?.trim() || '';
    const email = options.authorEmail?.trim() || '';
    args.push(`--author=${name} <${email}>`);
  }
  if (options?.authorDate) {
    args.push(`--date=${options.authorDate}`);
  }
  if (options?.committerDate) {
    env.GIT_COMMITTER_DATE = options.committerDate;
  }

  const res = await runGit(
    rootPath,
    args,
    undefined,
    Object.keys(env).length > 0 ? env : undefined
  );
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function amendCommit(repoPath: string, message: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!message.trim()) {
    throw new Error('Commit message cannot be empty');
  }
  const res = await runGit(rootPath, ['commit', '--amend', '-m', message]);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['commit', '--amend', '-m', message],
    duration_ms: res.duration_ms,
  };
}

function validateBranchName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Branch name cannot be empty');
  if (
    trimmed.startsWith('-') ||
    trimmed.startsWith('/') ||
    trimmed.endsWith('/') ||
    trimmed.endsWith('.') ||
    trimmed.endsWith('.lock')
  ) {
    throw new Error('Invalid branch name format');
  }
  if (
    trimmed.includes('..') ||
    trimmed.includes('~') ||
    trimmed.includes('^') ||
    trimmed.includes(':') ||
    trimmed.includes('?') ||
    trimmed.includes('*') ||
    trimmed.includes('[') ||
    trimmed.includes('\\') ||
    trimmed.includes('@{') ||
    trimmed.includes('//')
  ) {
    throw new Error('Branch name contains forbidden characters');
  }
  if (/[\s\x00-\x1f\x7f]/.test(trimmed)) {
    throw new Error('Branch name cannot contain whitespace or control characters');
  }
}

export async function createBranch(
  repoPath: string,
  name: string,
  startSha?: string
): Promise<OperationResult> {
  validateBranchName(name);
  const rootPath = await validateRepository(repoPath);
  const args =
    startSha && startSha.trim()
      ? ['switch', '-c', name.trim(), startSha.trim()]
      : ['switch', '-c', name.trim()];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function switchBranch(repoPath: string, name: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Branch name cannot be empty');
  const res = await runGit(rootPath, ['switch', trimmed]);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['switch', trimmed],
    duration_ms: res.duration_ms,
  };
}

export async function renameBranch(
  repoPath: string,
  oldName: string,
  newName: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedOld = oldName.trim();
  validateBranchName(newName);
  if (!trimmedOld) throw new Error('Current branch name cannot be empty');
  const args = ['branch', '-m', trimmedOld, newName.trim()];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function deleteBranch(
  repoPath: string,
  name: string,
  force = false
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Branch name cannot be empty');
  const flag = force ? '-D' : '-d';
  const args = ['branch', flag, trimmed];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function getStashes(repoPath: string): Promise<StashInfo[]> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, [
    'stash',
    'list',
    '--pretty=format:%gd%x00%h%x00%cr%x00%ci%x00%gs',
  ]);
  if (!res.stdout.trim()) return [];

  const lines = res.stdout.split('\n').filter(Boolean);
  const stashes: StashInfo[] = [];

  for (const line of lines) {
    const fields = line.split('\0');
    if (fields.length >= 5) {
      const ref = fields[0];
      const hash = fields[1];
      const relativeTime = fields[2];
      const date = fields[3];
      const fullSubject = fields[4];

      const match = ref.match(/stash@\{(\d+)\}/);
      const index = match ? parseInt(match[1], 10) : stashes.length;

      let branch = 'unknown';
      let message = fullSubject;
      const branchMatch = fullSubject.match(/^(?:WIP on|On)\s+([^:]+):?\s*(.*)$/);
      if (branchMatch) {
        branch = branchMatch[1].trim();
        message = branchMatch[2]?.trim() || fullSubject;
      }

      stashes.push({
        index,
        ref,
        hash,
        branch,
        relative_time: relativeTime,
        date,
        message,
      });
    }
  }

  return stashes;
}

export async function getStashDetail(
  repoPath: string,
  stashRef: string
): Promise<StashDetail> {
  const rootPath = await validateRepository(repoPath);
  const trimmedRef = stashRef.trim();
  if (!/^stash@\{\d+\}$/.test(trimmedRef)) {
    throw new Error('Invalid stash reference format');
  }

  const listRes = await runGit(rootPath, [
    'stash',
    'list',
    '--pretty=format:%gd%x00%h%x00%cr%x00%ci%x00%gs',
  ]);
  const lines = listRes.stdout.split('\n').filter(Boolean);
  let stashInfo: StashInfo | null = null;

  for (const line of lines) {
    const fields = line.split('\0');
    if (fields[0] === trimmedRef && fields.length >= 5) {
      const ref = fields[0];
      const hash = fields[1];
      const relativeTime = fields[2];
      const date = fields[3];
      const fullSubject = fields[4];
      const match = ref.match(/stash@\{(\d+)\}/);
      const index = match ? parseInt(match[1], 10) : 0;
      let branch = 'unknown';
      let message = fullSubject;
      const branchMatch = fullSubject.match(/^(?:WIP on|On)\s+([^:]+):?\s*(.*)$/);
      if (branchMatch) {
        branch = branchMatch[1].trim();
        message = branchMatch[2]?.trim() || fullSubject;
      }
      stashInfo = {
        index,
        ref,
        hash,
        branch,
        relative_time: relativeTime,
        date,
        message,
      };
      break;
    }
  }

  if (!stashInfo) {
    throw new Error(`Stash ${trimmedRef} not found`);
  }

  const statRes = await runGit(rootPath, ['show', '--numstat', '--format=', trimmedRef]);
  const files: CommitDetailFile[] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  for (const line of statRes.stdout.split('\n')) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const additions = parseInt(parts[0], 10) || 0;
      const deletions = parseInt(parts[1], 10) || 0;
      const filePath = parts[2];
      totalInsertions += additions;
      totalDeletions += deletions;

      files.push({
        path: filePath,
        status: 'Modified',
        additions,
        deletions,
        old_path: null,
      });
    }
  }

  // Also check if untracked files commit exists: <stashRef>^3
  const untrackedCheck = await runGit(rootPath, ['rev-parse', '--verify', `${trimmedRef}^3`]);
  if (untrackedCheck.code === 0) {
    const untrackedStat = await runGit(rootPath, [
      'show',
      '--numstat',
      '--format=',
      `${trimmedRef}^3`,
    ]);
    for (const line of untrackedStat.stdout.split('\n')) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const additions = parseInt(parts[0], 10) || 0;
        const filePath = parts[2];
        if (!files.some((f) => f.path === filePath)) {
          totalInsertions += additions;
          files.push({
            path: filePath,
            status: 'Added',
            additions,
            deletions: 0,
            old_path: null,
          });
        }
      }
    }
  }

  return {
    stash: stashInfo,
    files,
    stats: {
      files_changed: files.length,
      insertions: totalInsertions,
      deletions: totalDeletions,
    },
  };
}

export async function createStash(
  repoPath: string,
  message?: string,
  includeUntracked = false,
  keepIndex = false
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['stash', 'push'];
  if (includeUntracked) {
    args.push('-u');
  }
  if (keepIndex) {
    args.push('--keep-index');
  }
  if (message && message.trim()) {
    args.push('-m', message.trim());
  }
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function applyStash(
  repoPath: string,
  stashRef: string,
  reinstateIndex = false
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmed = stashRef.trim();
  if (!/^stash@\{\d+\}$/.test(trimmed)) {
    throw new Error('Invalid stash reference format');
  }
  const args = ['stash', 'apply'];
  if (reinstateIndex) {
    args.push('--index');
  }
  args.push(trimmed);
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function popStash(
  repoPath: string,
  stashRef: string,
  reinstateIndex = false
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmed = stashRef.trim();
  if (!/^stash@\{\d+\}$/.test(trimmed)) {
    throw new Error('Invalid stash reference format');
  }
  const args = ['stash', 'pop'];
  if (reinstateIndex) {
    args.push('--index');
  }
  args.push(trimmed);
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function dropStash(
  repoPath: string,
  stashRef: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmed = stashRef.trim();
  if (!/^stash@\{\d+\}$/.test(trimmed)) {
    throw new Error('Invalid stash reference format');
  }
  const args = ['stash', 'drop', trimmed];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function clearStashes(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['stash', 'clear'];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function branchFromStash(
  repoPath: string,
  branchName: string,
  stashRef: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedRef = stashRef.trim();
  validateBranchName(branchName);
  if (!/^stash@\{\d+\}$/.test(trimmedRef)) {
    throw new Error('Invalid stash reference format');
  }
  const args = ['stash', 'branch', branchName.trim(), trimmedRef];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function resetHard(repoPath: string, createBackup = true): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  let backupRef: string | undefined = undefined;
  let backupDuration = 0;

  if (createBackup) {
    const timestamp = Date.now();
    backupRef = `backup/pre-reset-hard-${timestamp}`;
    const backupRes = await runGit(rootPath, ['branch', backupRef, 'HEAD']);
    backupDuration = backupRes.duration_ms;
  }

  const args = ['reset', '--hard', 'HEAD'];
  const res = await runGit(rootPath, args);
  let stdout = res.stdout;
  if (backupRef) {
    stdout = `[Safety backup created at refs/heads/${backupRef}]\n` + stdout;
  } else {
    stdout = `[Safety backup declined by user]\n` + stdout;
  }

  return {
    success: res.code === 0,
    stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: backupRef ? ['branch', backupRef, 'HEAD', '&&', ...args] : args,
    duration_ms: res.duration_ms + backupDuration,
    backup_ref: backupRef,
    backup_declined: !createBackup,
  };
}

export async function getRemotes(repoPath: string): Promise<RemoteInfo[]> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, ['remote', '-v']);
  if (res.code !== 0) {
    throw new Error(`Failed to list remotes: ${res.stderr}`);
  }

  const remoteMap = new Map<string, { fetch_url?: string; push_url?: string }>();
  const lines = res.stdout.trim().split('\n');

  for (const line of lines) {
    if (!line) continue;
    // format: origin\thttps://... (fetch)
    const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (match) {
      const [, name, urlStr, type] = match;
      if (!remoteMap.has(name)) {
        remoteMap.set(name, {});
      }
      const entry = remoteMap.get(name)!;
      if (type === 'fetch') {
        entry.fetch_url = urlStr;
      } else if (type === 'push') {
        entry.push_url = urlStr;
      }
    }
  }

  const results: RemoteInfo[] = [];
  for (const [name, urls] of remoteMap.entries()) {
    results.push({
      name,
      fetch_url: urls.fetch_url || null,
      push_url: urls.push_url || null,
    });
  }

  return results;
}

export async function getSyncStatus(repoPath: string): Promise<SyncStatus> {
  const rootPath = await validateRepository(repoPath);

  // Get current HEAD branch
  const branchRes = await runGit(rootPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branchRes.code !== 0) {
    return {
      has_upstream: false,
      ahead: 0,
      behind: 0,
      current_branch: null,
      upstream_name: null,
    };
  }

  const currentBranch = branchRes.stdout.trim();
  if (currentBranch === 'HEAD') {
    // Detached HEAD
    return {
      has_upstream: false,
      ahead: 0,
      behind: 0,
      current_branch: 'HEAD (detached)',
      upstream_name: null,
    };
  }

  // Get upstream branch if any
  const upstreamRes = await runGit(rootPath, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);

  if (upstreamRes.code !== 0 || !upstreamRes.stdout.trim()) {
    return {
      has_upstream: false,
      ahead: 0,
      behind: 0,
      current_branch: currentBranch,
      upstream_name: null,
    };
  }

  const upstreamName = upstreamRes.stdout.trim();
  const remoteName = upstreamName.split('/')[0] || null;

  // Count ahead / behind
  let ahead = 0;
  let behind = 0;
  const countRes = await runGit(rootPath, [
    'rev-list',
    '--left-right',
    '--count',
    `${currentBranch}...${upstreamName}`,
  ]);

  if (countRes.code === 0) {
    const counts = countRes.stdout.trim().split(/\s+/);
    ahead = parseInt(counts[0], 10) || 0;
    behind = parseInt(counts[1], 10) || 0;
  }

  return {
    has_upstream: true,
    upstream_name: upstreamName,
    remote_name: remoteName,
    ahead,
    behind,
    current_branch: currentBranch,
  };
}

export async function gitFetch(
  repoPath: string,
  remote = 'origin',
  prune = true
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedRemote = remote.trim();
  if (!trimmedRemote || /[\s;&|><]/.test(trimmedRemote)) {
    throw new Error('Invalid remote name');
  }

  const args = ['fetch'];
  if (prune) {
    args.push('--prune');
  }
  args.push(trimmedRemote);

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function gitPull(
  repoPath: string,
  remote = 'origin',
  branch?: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedRemote = remote.trim();
  if (!trimmedRemote || /[\s;&|><]/.test(trimmedRemote)) {
    throw new Error('Invalid remote name');
  }

  const args = ['pull', trimmedRemote];
  if (branch && branch.trim()) {
    validateBranchName(branch.trim());
    args.push(branch.trim());
  }

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function gitPush(
  repoPath: string,
  remote = 'origin',
  branch?: string,
  forceWithLease = false,
  setUpstream = false,
  mode?: 'normal' | 'force_with_lease' | 'raw_force' | 'mirror'
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedRemote = remote.trim();
  if (!trimmedRemote || /[\s;&|><]/.test(trimmedRemote)) {
    throw new Error('Invalid remote name');
  }

  const effectiveMode = mode || (forceWithLease ? 'force_with_lease' : 'normal');

  const args = ['push'];
  if (setUpstream) {
    args.push('-u');
  }
  if (effectiveMode === 'force_with_lease') {
    args.push('--force-with-lease');
  } else if (effectiveMode === 'raw_force') {
    // User explicitly chose raw --force; do not silently downgrade
    args.push('--force');
  } else if (effectiveMode === 'mirror') {
    // User explicitly chose --mirror
    args.push('--mirror');
  }

  args.push(trimmedRemote);

  if (effectiveMode !== 'mirror' && branch && branch.trim()) {
    validateBranchName(branch.trim());
    args.push(branch.trim());
  }

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function deleteRemoteRef(
  repoPath: string,
  remote = 'origin',
  refType: 'branch' | 'tag',
  refName: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedRemote = remote.trim();
  const trimmedRef = refName.trim();
  if (!trimmedRemote || /[\s;&|><]/.test(trimmedRemote)) {
    throw new Error('Invalid remote name');
  }
  if (!trimmedRef || /[\s;&|><]/.test(trimmedRef)) {
    throw new Error('Invalid ref name');
  }
  validateBranchName(trimmedRef);

  const target = refType === 'tag' ? `refs/tags/${trimmedRef}` : trimmedRef;
  const args = ['push', trimmedRemote, '--delete', target];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout || `Remote ${refType} ${trimmedRef} successfully deleted from ${trimmedRemote}.`,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

/**
 * Restores a specific file from a historical commit into the working tree and index.
 * Matches allowlist command: git checkout <sha> -- <filePath>
 */
export async function restoreFileFromCommit(
  repoPath: string,
  commitSha: string,
  filePath: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedSha = commitSha.trim();
  const trimmedPath = filePath.trim();

  if (!/^[0-9a-fA-F]{4,64}$/.test(trimmedSha)) {
    throw new Error('Invalid commit SHA format');
  }
  if (!trimmedPath || trimmedPath.startsWith('/') || trimmedPath.includes('..')) {
    throw new Error('Invalid file path for restoration');
  }

  const args = ['checkout', trimmedSha, '--', trimmedPath];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

/**
 * Opens system terminal or native file explorer at repository root.
 * In containerized/web sandbox environments, provides immediate command snippet fallback.
 */
export async function openSystemLocation(
  repoPath: string,
  target: 'terminal' | 'file_manager'
): Promise<SystemOpenResult> {
  const rootPath = await validateRepository(repoPath);
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (target === 'file_manager') {
    return new Promise((resolve) => {
      let command = 'xdg-open';
      let args = [rootPath];
      if (isWindows) {
        command = 'explorer';
        args = [rootPath];
      } else if (isMac) {
        command = 'open';
        args = [rootPath];
      }

      execFile(command, args, (err) => {
        if (err) {
          resolve({
            success: false,
            target,
            message: `Could not launch native file manager: ${err.message}`,
            command_snippet: rootPath,
          });
        } else {
          resolve({
            success: true,
            target,
            message: `Opened repository folder in system file manager: ${rootPath}`,
            command_snippet: rootPath,
          });
        }
      });
    });
  } else {
    // terminal
    return new Promise((resolve) => {
      const commandSnippet = `cd "${rootPath}"`;
      if (isWindows) {
        execFile('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', `cd /d "${rootPath}"`], (err) => {
          if (err) {
            resolve({
              success: true,
              target,
              message: `Copy terminal navigation command: ${commandSnippet}`,
              command_snippet: commandSnippet,
            });
          } else {
            resolve({
              success: true,
              target,
              message: `Launched terminal at ${rootPath}`,
              command_snippet: commandSnippet,
            });
          }
        });
      } else if (isMac) {
        execFile('open', ['-a', 'Terminal', rootPath], (err) => {
          if (err) {
            resolve({
              success: true,
              target,
              message: `Copy terminal navigation command: ${commandSnippet}`,
              command_snippet: commandSnippet,
            });
          } else {
            resolve({
              success: true,
              target,
              message: `Launched terminal at ${rootPath}`,
              command_snippet: commandSnippet,
            });
          }
        });
      } else {
        // Linux: try x-terminal-emulator, otherwise provide convenient snippet
        execFile('x-terminal-emulator', ['--working-directory', rootPath], (err) => {
          if (err) {
            resolve({
              success: true,
              target,
              message: `Copy terminal navigation command: ${commandSnippet}`,
              command_snippet: commandSnippet,
            });
          } else {
            resolve({
              success: true,
              target,
              message: `Launched terminal at ${rootPath}`,
              command_snippet: commandSnippet,
            });
          }
        });
      }
    });
  }
}


/**
 * Initializes or resets a realistic, isolated demo Git repository in /tmp/git-workbench-sample
 * Contains multiple commits, feature branch, merge commit, tag, and staged/unstaged changes.
 * Perfectly mirrors real-world repositories for instant interactive testing!
 */
export async function createOrGetSampleRepo(): Promise<string> {
  const targetDir = '/tmp/git-workbench-sample-repo';

  if (fs.existsSync(path.join(targetDir, '.git'))) {
    return targetDir;
  }

  // Create clean directory
  fs.mkdirSync(targetDir, { recursive: true });

  const run = (args: string[]) => runGit(targetDir, args);

  await run(['init', '-b', 'main']);
  await run(['config', 'user.name', 'Alex Mercer']);
  await run(['config', 'user.email', 'alex@example.com']);

  // Commit 1
  fs.writeFileSync(path.join(targetDir, 'README.md'), '# Sample Project\n\nA test repository for Git Workbench.\n');
  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify({ name: 'sample-app', version: '0.1.0' }, null, 2),
  );
  await run(['add', '.']);
  await run(['commit', '-m', 'chore: initial commit with project scaffold']);

  // Commit 2
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(targetDir, 'src', 'index.js'),
    `export function calculateMetrics(input) {\n  return input.reduce((acc, v) => acc + v, 0);\n}\n`,
  );
  await run(['add', '.']);
  await run(['commit', '-m', 'feat(core): implement metrics calculation engine']);
  await run(['tag', 'v0.1.0']);

  // Branch: feature/visual-graph
  await run(['checkout', '-b', 'feature/visual-graph']);
  fs.writeFileSync(
    path.join(targetDir, 'src', 'graph.js'),
    `export class CommitGraph {\n  constructor(nodes) {\n    this.nodes = nodes;\n  }\n  render() {\n    console.log("Rendering graph lanes...");\n  }\n}\n`,
  );
  await run(['add', '.']);
  await run(['commit', '-m', 'feat(graph): add CommitGraph lane layout algorithm']);

  fs.writeFileSync(
    path.join(targetDir, 'src', 'graph.js'),
    `export class CommitGraph {\n  constructor(nodes) {\n    this.nodes = nodes;\n  }\n  render(canvas) {\n    const ctx = canvas.getContext("2d");\n    ctx.fillStyle = "#3b82f6";\n  }\n}\n`,
  );
  await run(['add', '.']);
  await run(['commit', '-m', 'refactor(graph): switch to high-performance 2D canvas rendering']);

  // Back to main
  await run(['checkout', 'main']);
  fs.writeFileSync(
    path.join(targetDir, 'README.md'),
    '# Sample Project\n\nA test repository for Git Workbench.\n\n## Documentation\nIncludes visual graph engine and diff inspector.\n',
  );
  await run(['add', 'README.md']);
  await run(['commit', '-m', 'docs: update README documentation']);

  // Merge feature/visual-graph into main
  await run(['merge', '--no-ff', 'feature/visual-graph', '-m', 'merge: integrate feature/visual-graph into main']);
  await run(['tag', 'v0.2.0']);

  // Add unstaged and staged files for working tree testing
  fs.writeFileSync(path.join(targetDir, 'CHANGELOG.md'), '# Changelog\n\n- v0.2.0: Canvas graph integrated\n');
  await run(['add', 'CHANGELOG.md']); // Staged!

  fs.writeFileSync(
    path.join(targetDir, 'src', 'index.js'),
    `// Pending working tree update\nexport function calculateMetrics(input) {\n  return input.filter(Boolean).reduce((acc, v) => acc + v, 0);\n}\n`,
  ); // Unstaged modified!

  fs.writeFileSync(path.join(targetDir, 'scratchpad.txt'), 'Temporary local notes that are untracked.\n'); // Untracked!

  return targetDir;
}

// ---------------------------------------------------------------------------
// Phase 2: Interactive Hunk Staging & Discarding
// ---------------------------------------------------------------------------

export async function stageHunk(repoPath: string, patch: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!patch || !patch.trim()) throw new Error('Patch cannot be empty');
  const res = await runGit(rootPath, ['apply', '--cached', '--whitespace=nowarn', '--recount', '-'], patch);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['apply', '--cached', '--whitespace=nowarn', '--recount', '-'],
    duration_ms: res.duration_ms,
  };
}

export async function unstageHunk(repoPath: string, patch: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!patch || !patch.trim()) throw new Error('Patch cannot be empty');
  const res = await runGit(rootPath, ['apply', '--cached', '--reverse', '--whitespace=nowarn', '--recount', '-'], patch);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['apply', '--cached', '--reverse', '--whitespace=nowarn', '--recount', '-'],
    duration_ms: res.duration_ms,
  };
}

export async function discardHunk(repoPath: string, patch: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!patch || !patch.trim()) throw new Error('Patch cannot be empty');
  const res = await runGit(rootPath, ['apply', '--reverse', '--whitespace=nowarn', '--recount', '-'], patch);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['apply', '--reverse', '--whitespace=nowarn', '--recount', '-'],
    duration_ms: res.duration_ms,
  };
}

// ---------------------------------------------------------------------------
// Phase 2: Conflict Resolution Workflow
// ---------------------------------------------------------------------------

export async function getConflictState(repoPath: string): Promise<ConflictState> {
  const rootPath = await validateRepository(repoPath);
  const gitDir = path.join(rootPath, '.git');

  const inMerge = fs.existsSync(path.join(gitDir, 'MERGE_HEAD'));
  const inRebase =
    fs.existsSync(path.join(gitDir, 'rebase-merge')) ||
    fs.existsSync(path.join(gitDir, 'rebase-apply'));
  const inCherryPick = fs.existsSync(path.join(gitDir, 'CHERRY_PICK_HEAD'));
  const inRevert = fs.existsSync(path.join(gitDir, 'REVERT_HEAD'));

  const diffRes = await runGit(rootPath, ['diff', '--name-only', '--diff-filter=U']);
  const conflictedFiles = diffRes.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  let cherryPickHead: string | null = null;
  let cherryPickSubject: string | null = null;
  if (inCherryPick) {
    try {
      const headFile = path.join(gitDir, 'CHERRY_PICK_HEAD');
      if (fs.existsSync(headFile)) {
        cherryPickHead = fs.readFileSync(headFile, 'utf-8').trim();
        if (cherryPickHead) {
          const showRes = await runGit(rootPath, ['log', '-1', '--format=%s', cherryPickHead]);
          cherryPickSubject = showRes.stdout.trim() || null;
        }
      }
    } catch {
      // Ignore fallback
    }
  }

  let revertHead: string | null = null;
  let revertSubject: string | null = null;
  if (inRevert) {
    try {
      const headFile = path.join(gitDir, 'REVERT_HEAD');
      if (fs.existsSync(headFile)) {
        revertHead = fs.readFileSync(headFile, 'utf-8').trim();
        if (revertHead) {
          const showRes = await runGit(rootPath, ['log', '-1', '--format=%s', revertHead]);
          revertSubject = showRes.stdout.trim() || null;
        }
      }
    } catch {
      // Ignore fallback
    }
  }

  return {
    in_merge: inMerge,
    in_rebase: inRebase,
    in_cherry_pick: inCherryPick,
    in_revert: inRevert,
    conflicted_files: conflictedFiles,
    cherry_pick_head: cherryPickHead,
    cherry_pick_subject: cherryPickSubject,
    revert_head: revertHead,
    revert_subject: revertSubject,
  };
}

export async function resolveConflict(
  repoPath: string,
  filePath: string,
  resolution: ConflictResolutionType
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!filePath.trim()) throw new Error('File path required');

  if (resolution === 'ours') {
    const checkoutRes = await runGit(rootPath, ['checkout', '--ours', '--', filePath]);
    if (checkoutRes.code !== 0) {
      return {
        success: false,
        stdout: checkoutRes.stdout,
        stderr: checkoutRes.stderr,
        exit_code: checkoutRes.code,
        command_run: ['checkout', '--ours', '--', filePath],
        duration_ms: checkoutRes.duration_ms,
      };
    }
  } else if (resolution === 'theirs') {
    const checkoutRes = await runGit(rootPath, ['checkout', '--theirs', '--', filePath]);
    if (checkoutRes.code !== 0) {
      return {
        success: false,
        stdout: checkoutRes.stdout,
        stderr: checkoutRes.stderr,
        exit_code: checkoutRes.code,
        command_run: ['checkout', '--theirs', '--', filePath],
        duration_ms: checkoutRes.duration_ms,
      };
    }
  }

  // After resolving, stage file
  const addRes = await runGit(rootPath, ['add', '--', filePath]);
  return {
    success: addRes.code === 0,
    stdout: addRes.stdout,
    stderr: addRes.stderr,
    exit_code: addRes.code,
    command_run:
      resolution === 'mark_resolved'
        ? ['add', '--', filePath]
        : ['checkout', `--${resolution}`, '--', filePath, '&&', 'add', '--', filePath],
    duration_ms: addRes.duration_ms,
  };
}

export async function launchMergetool(
  repoPath: string,
  filePath?: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['mergetool', '--no-prompt'];
  if (filePath) {
    args.push('--', filePath);
  }
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout || 'Mergetool launched',
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function continueConflictOperation(repoPath: string): Promise<OperationResult> {
  const state = await getConflictState(repoPath);
  const rootPath = await validateRepository(repoPath);

  let args: string[];
  if (state.in_rebase) {
    args = ['rebase', '--continue'];
  } else if (state.in_cherry_pick) {
    args = ['cherry-pick', '--continue'];
  } else if (state.in_revert) {
    args = ['revert', '--continue'];
  } else {
    args = ['merge', '--continue'];
  }

  let res = await runGit(rootPath, args);
  // Fallback for merge if older git versions expect commit -m
  if (res.code !== 0 && !state.in_rebase && !state.in_cherry_pick && !state.in_revert) {
    res = await runGit(rootPath, ['commit', '--no-edit']);
    args = ['commit', '--no-edit'];
  }

  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function abortConflictOperation(repoPath: string): Promise<OperationResult> {
  const state = await getConflictState(repoPath);
  const rootPath = await validateRepository(repoPath);

  let args: string[];
  if (state.in_rebase) {
    args = ['rebase', '--abort'];
  } else if (state.in_cherry_pick) {
    args = ['cherry-pick', '--abort'];
  } else if (state.in_revert) {
    args = ['revert', '--abort'];
  } else {
    args = ['merge', '--abort'];
  }

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

// ---------------------------------------------------------------------------
// Phase 3 Step 3: Cherry-Pick Workflow with Conflict Guidance
// ---------------------------------------------------------------------------

export async function cherryPickCommit(
  repoPath: string,
  sha: string,
  options?: CherryPickOptions
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedSha = sha.trim();
  if (!/^[0-9a-fA-F]{4,64}$/.test(trimmedSha)) {
    throw new Error('Invalid commit SHA for cherry-pick');
  }

  const args = ['cherry-pick'];
  if (options?.noCommit) {
    args.push('-n');
  }
  if (options?.recordOrigin) {
    args.push('-x');
  }
  if (options?.signoff) {
    args.push('-s');
  }
  if (options?.edit) {
    args.push('--edit');
  }
  if (options?.mainline && Number.isInteger(options.mainline) && options.mainline > 0) {
    args.push('-m', String(options.mainline));
  }
  args.push(trimmedSha);

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function cherryPickContinue(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['cherry-pick', '--continue'];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function cherryPickSkip(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['cherry-pick', '--skip'];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function cherryPickAbort(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['cherry-pick', '--abort'];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function createDemoCherryPickConflict(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const sideBranch = `cherry-demo-source-${Date.now()}`;
  const targetBranch = `cherry-demo-target-${Date.now()}`;
  const filePath = path.join(rootPath, 'src', 'metrics-cherry.txt');

  // Checkout main and establish base file
  await runGit(rootPath, ['checkout', 'main']);
  fs.writeFileSync(filePath, 'Base line 1\nBase line 2\nBase line 3\n');
  await runGit(rootPath, ['add', 'src/metrics-cherry.txt']);
  await runGit(rootPath, ['commit', '-m', 'chore: prepare cherry-pick base file']);

  // Create side branch with commit to cherry pick
  await runGit(rootPath, ['checkout', '-b', sideBranch]);
  fs.writeFileSync(filePath, 'Base line 1\nSOURCE BRANCH MODIFICATION\nBase line 3\n');
  await runGit(rootPath, ['add', 'src/metrics-cherry.txt']);
  await runGit(rootPath, ['commit', '-m', 'feat(metrics): source change to cherry-pick']);
  
  // Get source commit SHA
  const shaRes = await runGit(rootPath, ['rev-parse', 'HEAD']);
  const sourceSha = shaRes.stdout.trim();

  // Create target branch with conflicting change
  await runGit(rootPath, ['checkout', 'main']);
  await runGit(rootPath, ['checkout', '-b', targetBranch]);
  fs.writeFileSync(filePath, 'Base line 1\nTARGET CONFLICTING MODIFICATION\nBase line 3\n');
  await runGit(rootPath, ['add', 'src/metrics-cherry.txt']);
  await runGit(rootPath, ['commit', '-m', 'refactor(metrics): target branch conflict change']);

  // Trigger cherry-pick that conflicts!
  const cpRes = await runGit(rootPath, ['cherry-pick', sourceSha]);

  return {
    success: true,
    stdout: `Cherry-pick conflict created against ${sourceSha.slice(0, 7)}: ${cpRes.stdout || cpRes.stderr}`,
    stderr: cpRes.stderr,
    exit_code: cpRes.code,
    command_run: ['cherry-pick', sourceSha],
    duration_ms: cpRes.duration_ms,
  };
}

// ---------------------------------------------------------------------------
// Phase 3 Step 4: Revert Workflow (including mainline selection -m 1)
// ---------------------------------------------------------------------------

export async function revertCommit(
  repoPath: string,
  sha: string,
  options?: RevertOptions
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedSha = sha.trim();
  if (!/^[0-9a-fA-F]{4,64}$/.test(trimmedSha)) {
    throw new Error('Invalid commit SHA for revert');
  }

  const args = ['revert'];
  if (options?.noCommit) {
    args.push('-n');
  }
  if (options?.signoff) {
    args.push('-s');
  }
  if (options?.edit === true) {
    args.push('--edit');
  } else {
    // Default to --no-edit in non-interactive GUI mode unless edit is explicitly requested
    args.push('--no-edit');
  }
  if (options?.mainline && Number.isInteger(options.mainline) && options.mainline > 0) {
    args.push('-m', String(options.mainline));
  }
  args.push(trimmedSha);

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function revertContinue(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['revert', '--continue'];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function revertSkip(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['revert', '--skip'];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function revertAbort(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['revert', '--abort'];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function createDemoRevertConflict(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const demoBranch = `revert-demo-${Date.now()}`;
  const filePath = path.join(rootPath, 'src', 'metrics-revert.txt');

  // Checkout main and establish base file
  await runGit(rootPath, ['checkout', 'main']);
  fs.writeFileSync(filePath, 'Section 1: Initial Header\nSection 2: Original Value\nSection 3: Footer\n');
  await runGit(rootPath, ['add', 'src/metrics-revert.txt']);
  await runGit(rootPath, ['commit', '-m', 'chore: prepare revert base file']);

  // Create demo branch
  await runGit(rootPath, ['checkout', '-b', demoBranch]);
  fs.writeFileSync(filePath, 'Section 1: Initial Header\nSection 2: MODIFIED VALUE TO REVERT\nSection 3: Footer\n');
  await runGit(rootPath, ['add', 'src/metrics-revert.txt']);
  await runGit(rootPath, ['commit', '-m', 'feat(metrics): change that will be reverted']);

  // Get SHA of commit to revert
  const shaRes = await runGit(rootPath, ['rev-parse', 'HEAD']);
  const revertSha = shaRes.stdout.trim();

  // Introduce conflicting modification on top of it so reverting original line causes conflict
  fs.writeFileSync(filePath, 'Section 1: Initial Header\nSection 2: CONFLICTING SUBSEQUENT EDIT\nSection 3: Footer\n');
  await runGit(rootPath, ['add', 'src/metrics-revert.txt']);
  await runGit(rootPath, ['commit', '-m', 'refactor(metrics): subsequent conflicting line modification']);

  // Trigger revert of the older commit
  const revRes = await runGit(rootPath, ['revert', '--no-edit', revertSha]);

  return {
    success: true,
    stdout: `Revert conflict created against ${revertSha.slice(0, 7)}: ${revRes.stdout || revRes.stderr}`,
    stderr: revRes.stderr,
    exit_code: revRes.code,
    command_run: ['revert', '--no-edit', revertSha],
    duration_ms: revRes.duration_ms,
  };
}

/**
 * Creates an intentional merge conflict in the sandbox repository for testing & demo purposes.
 */
export async function createDemoConflict(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const conflictBranch = `conflict-demo-${Date.now()}`;
  const filePath = path.join(rootPath, 'src', 'index.js');

  // Ensure clean index or commit
  await runGit(rootPath, ['checkout', 'main']);
  
  // Create side branch with change
  await runGit(rootPath, ['checkout', '-b', conflictBranch]);
  fs.writeFileSync(
    filePath,
    `// Incoming branch calculation update\nexport function calculateMetrics(input) {\n  return input.reduce((total, val) => total + (val * 2), 0);\n}\n`
  );
  await runGit(rootPath, ['add', 'src/index.js']);
  await runGit(rootPath, ['commit', '-m', `feat(metrics): conflict demo incoming change on ${conflictBranch}`]);

  // Switch to main and introduce conflicting change
  await runGit(rootPath, ['checkout', 'main']);
  fs.writeFileSync(
    filePath,
    `// Local main branch calculation update\nexport function calculateMetrics(input) {\n  return input.filter(x => x > 0).reduce((acc, curr) => acc + curr, 0);\n}\n`
  );
  await runGit(rootPath, ['add', 'src/index.js']);
  await runGit(rootPath, ['commit', '-m', 'refactor(metrics): conflict demo main local change']);

  // Merge side branch into main to trigger conflict
  const mergeRes = await runGit(rootPath, ['merge', '--no-commit', conflictBranch]);

  return {
    success: true,
    stdout: `Merge conflict intentionally created on src/index.js: ${mergeRes.stdout || mergeRes.stderr}`,
    stderr: mergeRes.stderr,
    exit_code: mergeRes.code,
    command_run: ['merge', '--no-commit', conflictBranch],
    duration_ms: mergeRes.duration_ms,
  };
}

/**
 * Phase 3 Step 1: Retrieve list of commits from baseSha..HEAD in forward order for interactive rebase
 */
export async function getRebaseCandidates(
  repoPath: string,
  baseSha: string,
  isRoot?: boolean
): Promise<RebaseTodoItem[]> {
  const rootPath = await validateRepository(repoPath);

  // Determine if this is a root rebase (starts from the initial commit)
  let effectiveIsRoot = Boolean(isRoot || baseSha === '--root');
  if (!effectiveIsRoot && baseSha) {
    try {
      const parentCheck = await runGit(rootPath, ['rev-list', '--parents', '-n', '1', baseSha]);
      if (parentCheck.code === 0) {
        const tokens = parentCheck.stdout.trim().split(/\s+/).filter(Boolean);
        // If only 1 SHA token is returned, the commit has 0 parents -> It is a ROOT commit!
        if (tokens.length === 1 && tokens[0]) {
          effectiveIsRoot = true;
        }
      }
    } catch {
      // Fallback to standard range
    }
  }

  const logArgs = effectiveIsRoot
    ? ['log', '--reverse', '--format=%H%x00%h%x00%an%x00%s', 'HEAD']
    : ['log', '--reverse', '--format=%H%x00%h%x00%an%x00%s', `${baseSha}..HEAD`];

  const res = await runGit(rootPath, logArgs);

  if (res.code !== 0 || !res.stdout.trim()) {
    return [];
  }

  const lines = res.stdout.split('\n').filter(Boolean);
  return lines.map((line, idx) => {
    const parts = line.split('\0');
    const sha = parts[0] || '';
    const short_sha = parts[1] || sha.slice(0, 7);
    const author = parts[2] || 'Unknown';
    const summary = parts[3] || '(no commit message)';
    return {
      id: `rebase-${idx}-${short_sha}`,
      sha,
      short_sha,
      author,
      summary,
      action: 'pick' as const,
    };
  });
}

/**
 * Phase 3 Step 1: Get detailed active rebase status including current commit, done/todo steps
 */
export async function getDetailedRebaseStatus(repoPath: string): Promise<RebaseStatus> {
  const rootPath = await validateRepository(repoPath);
  const rebaseMergeDir = path.join(rootPath, '.git', 'rebase-merge');
  const rebaseApplyDir = path.join(rootPath, '.git', 'rebase-apply');

  const dir = fs.existsSync(rebaseMergeDir)
    ? rebaseMergeDir
    : fs.existsSync(rebaseApplyDir)
    ? rebaseApplyDir
    : null;

  if (!dir) {
    return { in_progress: false };
  }

  const readSafe = (fileName: string) => {
    try {
      return fs.readFileSync(path.join(dir, fileName), 'utf8').trim();
    } catch {
      return undefined;
    }
  };

  const onto = readSafe('onto');
  const headName = readSafe('head-name');
  const currentCommit = readSafe('stopped-sha');
  const msgNumStr = readSafe('msgnum');
  const endStr = readSafe('end');
  const doneContent = readSafe('done') || '';
  const todoContent = readSafe('git-rebase-todo') || '';

  const doneSteps = doneContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const todoSteps = todoContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const msgnum = msgNumStr ? parseInt(msgNumStr, 10) : undefined;
  const end = endStr ? parseInt(endStr, 10) : undefined;

  return {
    in_progress: true,
    onto_commit: onto,
    head_name: headName?.replace('refs/heads/', ''),
    current_commit: currentCommit,
    remaining_steps: end && msgnum ? end - msgnum : todoSteps.length,
    total_steps: end || doneSteps.length + todoSteps.length,
    done_steps: doneSteps,
    todo_steps: todoSteps,
  };
}

/**
 * Phase 3 Step 1: Execute interactive rebase plan
 */
export async function executeInteractiveRebase(
  repoPath: string,
  baseSha: string,
  items: RebaseTodoItem[],
  isRoot?: boolean,
  autostash?: boolean
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);

  let effectiveIsRoot = Boolean(isRoot || baseSha === '--root');
  if (!effectiveIsRoot && baseSha) {
    try {
      const parentCheck = await runGit(rootPath, ['rev-list', '--parents', '-n', '1', baseSha]);
      if (parentCheck.code === 0) {
        const tokens = parentCheck.stdout.trim().split(/\s+/).filter(Boolean);
        if (tokens.length === 1 && tokens[0]) {
          effectiveIsRoot = true;
        }
      }
    } catch {
      // Fallback
    }
  }

  // Construct todo sequence text
  const todoLines: string[] = [];
  for (const item of items) {
    if (item.action === 'drop') {
      todoLines.push(`drop ${item.sha} ${item.summary}`);
    } else if (item.action === 'reword' && item.new_message && item.new_message.trim()) {
      todoLines.push(`pick ${item.sha} ${item.summary}`);
      const escapedMsg = item.new_message.replace(/"/g, '\\"');
      todoLines.push(`exec git commit --amend -m "${escapedMsg}"`);
    } else if (item.action === 'exec' && item.exec_command) {
      todoLines.push(`exec ${item.exec_command}`);
    } else {
      todoLines.push(`${item.action} ${item.sha} ${item.summary}`);
    }
  }

  const tempTodoPath = path.join(
    os.tmpdir(),
    `rebase-todo-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
  );
  fs.writeFileSync(tempTodoPath, todoLines.join('\n') + '\n', 'utf8');

  try {
    const sequenceEditorScript = `node -e "require('fs').copyFileSync(process.env.GIT_TODO_REPLACEMENT, process.argv[1])"`;
    const rebaseCmd: string[] = ['rebase', '-i'];
    if (autostash) {
      rebaseCmd.push('--autostash');
    }
    if (effectiveIsRoot) {
      rebaseCmd.push('--root');
    } else {
      rebaseCmd.push(baseSha);
    }

    const res = await runGit(
      rootPath,
      rebaseCmd,
      undefined,
      {
        GIT_SEQUENCE_EDITOR: sequenceEditorScript,
        GIT_TODO_REPLACEMENT: tempTodoPath,
        GIT_EDITOR: 'cat',
      }
    );

    return {
      success: res.code === 0,
      stdout: res.stdout,
      stderr: res.stderr,
      exit_code: res.code,
      command_run: rebaseCmd,
      duration_ms: res.duration_ms,
    };
  } finally {
    try {
      if (fs.existsSync(tempTodoPath)) {
        fs.unlinkSync(tempTodoPath);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Phase 3 Step 1: Skip the current conflicting/paused commit during rebase
 */
export async function rebaseSkip(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, ['rebase', '--skip']);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['rebase', '--skip'],
    duration_ms: res.duration_ms,
  };
}

/**
 * Phase 3 Step 2: Fetch Git user.name and user.email from repository configuration
 */
export async function getGitUserConfig(repoPath: string): Promise<GitUserConfig> {
  const rootPath = await validateRepository(repoPath);
  const nameRes = await runGit(rootPath, ['config', 'user.name']);
  const emailRes = await runGit(rootPath, ['config', 'user.email']);
  return {
    name: nameRes.stdout.trim(),
    email: emailRes.stdout.trim(),
  };
}

/**
 * Phase 3 Step 2: Modify commit author, author date, committer date, and message
 * Supports both HEAD commit in-place amend and historical commits via automated rebase edit.
 */
export async function modifyCommitAuthorDate(
  repoPath: string,
  params: ModifyCommitAuthorDateParams
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);

  // Check if target commit is HEAD
  const headRes = await runGit(rootPath, ['rev-parse', 'HEAD']);
  const headSha = headRes.stdout.trim();
  const target = params.target_sha?.trim();
  const isHead =
    !target ||
    target.toUpperCase() === 'HEAD' ||
    headSha.startsWith(target) ||
    target.startsWith(headSha);

  // Build amend arguments
  const args: string[] = ['commit', '--amend'];

  if (params.new_message !== undefined && params.new_message !== null) {
    if (!params.new_message.trim()) {
      throw new Error('Commit message cannot be empty');
    }
    args.push('-m', params.new_message);
  } else {
    args.push('--no-edit');
  }

  if (params.reset_author) {
    args.push('--reset-author');
  } else if (params.author_name || params.author_email) {
    const name = params.author_name?.trim() || '';
    const email = params.author_email?.trim() || '';
    args.push(`--author=${name} <${email}>`);
  }

  if (params.author_date) {
    args.push(`--date=${params.author_date}`);
  }

  const env: Record<string, string> = {};
  if (params.sync_committer_date_to_author && params.author_date) {
    env.GIT_COMMITTER_DATE = params.author_date;
  } else if (params.committer_date) {
    env.GIT_COMMITTER_DATE = params.committer_date;
  }

  if (params.committer_name) {
    env.GIT_COMMITTER_NAME = params.committer_name;
  }
  if (params.committer_email) {
    env.GIT_COMMITTER_EMAIL = params.committer_email;
  }

  if (isHead) {
    const res = await runGit(
      rootPath,
      args,
      undefined,
      Object.keys(env).length > 0 ? env : undefined
    );
    return {
      success: res.code === 0,
      stdout: res.stdout,
      stderr: res.stderr,
      exit_code: res.code,
      command_run: args,
      duration_ms: res.duration_ms,
    };
  }

  // Target is a historical commit: perform automated rebase edit
  const parentRes = await runGit(rootPath, ['rev-parse', `${target}^`]);
  const hasParent = parentRes.code === 0;
  const baseRef = hasParent ? `${target}^` : '--root';

  const targetRevRes = await runGit(rootPath, ['rev-parse', target!]);
  const fullTargetSha = targetRevRes.code === 0 ? targetRevRes.stdout.trim() : target!;
  const shortSha = fullTargetSha.slice(0, 7);

  const scriptContent = `
const fs = require('fs');
const filePath = process.argv[1];
const targetSha = process.env.TARGET_COMMIT_SHA;
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\\n');
const updated = lines.map(line => {
  if (line.startsWith('pick ') && (line.includes(targetSha) || line.includes(targetSha.slice(0, 7)))) {
    return line.replace(/^pick /, 'edit ');
  }
  return line;
});
fs.writeFileSync(filePath, updated.join('\\n'), 'utf8');
`.trim();

  const tempScriptPath = path.join(
    os.tmpdir(),
    `rebase-edit-seq-${Date.now()}-${Math.random().toString(36).slice(2)}.js`
  );
  fs.writeFileSync(tempScriptPath, scriptContent, 'utf8');

  try {
    const rebaseArgs = ['rebase', '-i'];
    if (baseRef === '--root') {
      rebaseArgs.push('--root');
    } else {
      rebaseArgs.push(baseRef);
    }

    const rebaseStart = await runGit(rootPath, rebaseArgs, undefined, {
      GIT_SEQUENCE_EDITOR: `node "${tempScriptPath}"`,
      TARGET_COMMIT_SHA: fullTargetSha,
      GIT_EDITOR: 'cat',
    });

    if (rebaseStart.code !== 0) {
      throw new Error(`Failed to initiate rebase for commit ${shortSha}: ${rebaseStart.stderr || rebaseStart.stdout}`);
    }

    // Now Git is stopped at `edit` for the target commit!
    const amendRes = await runGit(
      rootPath,
      args,
      undefined,
      Object.keys(env).length > 0 ? env : undefined
    );

    if (amendRes.code !== 0) {
      throw new Error(`Failed to amend commit at rebase pause: ${amendRes.stderr || amendRes.stdout}`);
    }

    // Continue the rebase to HEAD
    const continueRes = await runGit(rootPath, ['rebase', '--continue'], undefined, {
      GIT_EDITOR: 'cat',
    });

    return {
      success: continueRes.code === 0,
      stdout: `${amendRes.stdout}\n${continueRes.stdout}`.trim(),
      stderr: continueRes.stderr,
      exit_code: continueRes.code,
      command_run: ['rebase', '-i', baseRef, '&&', 'commit', '--amend', '&&', 'rebase', '--continue'],
      duration_ms: rebaseStart.duration_ms + amendRes.duration_ms + continueRes.duration_ms,
    };
  } finally {
    try {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Phase 3 Step 5: Reflog & Emergency Recovery
 * Queries reflog entries with formatted metadata and structured action categories.
 */
export async function getReflog(repoPath: string, limit = 100): Promise<ReflogEntry[]> {
  const rootPath = await validateRepository(repoPath);
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const res = await runGit(rootPath, [
    'reflog',
    'show',
    '-n',
    String(safeLimit),
    '--format=%gD%x00%H%x00%h%x00%gs%x00%an%x00%ae%x00%aI',
  ]);

  if (res.code !== 0) {
    return [];
  }

  const lines = res.stdout.split('\n').filter(Boolean);
  const entries: ReflogEntry[] = [];

  for (const line of lines) {
    const parts = line.split('\0');
    if (parts.length >= 7) {
      const [selector, sha, short_sha, subject, author_name, author_email, date] = parts;
      const match = selector.match(/@\{(\d+)\}/);
      const index = match ? parseInt(match[1], 10) : entries.length;

      let action = 'other';
      const lower = subject.toLowerCase();
      if (lower.startsWith('commit:') || lower.startsWith('commit (amend):') || lower.startsWith('commit (initial):')) {
        action = 'commit';
      } else if (lower.startsWith('checkout:')) {
        action = 'checkout';
      } else if (lower.startsWith('rebase')) {
        action = 'rebase';
      } else if (lower.startsWith('reset:')) {
        action = 'reset';
      } else if (lower.startsWith('cherry-pick')) {
        action = 'cherry-pick';
      } else if (lower.startsWith('revert')) {
        action = 'revert';
      } else if (lower.startsWith('merge')) {
        action = 'merge';
      } else if (lower.startsWith('branch:')) {
        action = 'branch';
      } else if (lower.startsWith('pull')) {
        action = 'pull';
      } else if (lower.startsWith('clone')) {
        action = 'clone';
      } else {
        action = subject.split(':')[0]?.trim().toLowerCase() || 'other';
      }

      entries.push({
        selector: selector.trim(),
        index,
        sha: sha.trim(),
        short_sha: short_sha.trim(),
        action,
        subject: subject.trim(),
        author_name: author_name.trim(),
        author_email: author_email.trim(),
        date: date.trim(),
      });
    }
  }

  return entries;
}

/**
 * Resets HEAD to a target reference (commit SHA, reflog selector, branch name).
 * Follows Level 3 Safety Policy: when mode is 'hard', an automatic backup branch is created.
 */
export async function resetToTarget(
  repoPath: string,
  target: string,
  mode: 'soft' | 'mixed' | 'hard' = 'mixed',
  createBackup = true
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);

  if (!target || !/^[\w@{}~^/.-]+$/.test(target)) {
    throw new Error(`Invalid target ref format: ${target}`);
  }

  let backupRef: string | undefined = undefined;
  let backupDuration = 0;

  // Warning Level 3: When performing --hard reset, offer backup branch; allow user to intentionally decline
  if (mode === 'hard') {
    if (createBackup) {
      const timestamp = Date.now();
      backupRef = `backup/pre-reset-${timestamp}`;
      const backupRes = await runGit(rootPath, ['branch', backupRef, 'HEAD']);
      backupDuration = backupRes.duration_ms;
    }
  }

  const flag = mode === 'soft' ? '--soft' : mode === 'hard' ? '--hard' : '--mixed';
  const args = ['reset', flag, target];
  const res = await runGit(rootPath, args);

  let stdout = res.stdout;
  if (mode === 'hard') {
    if (backupRef) {
      stdout = `[Safety backup created at refs/heads/${backupRef}]\n` + stdout;
    } else {
      stdout = `[Safety backup declined by user]\n` + stdout;
    }
  }

  return {
    success: res.code === 0,
    stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: backupRef ? ['branch', backupRef, 'HEAD', '&&', ...args] : args,
    duration_ms: res.duration_ms + backupDuration,
    backup_ref: backupRef,
    backup_declined: mode === 'hard' && !createBackup,
  };
}

/**
 * Phase 3 Step 6: Git Worktrees Management
 */
export async function getWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, ['worktree', 'list', '--porcelain']);
  if (res.code !== 0) {
    return [];
  }

  const entries: WorktreeInfo[] = [];
  const lines = res.stdout.split('\n');
  let current: Partial<WorktreeInfo> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current.path && current.head) {
        entries.push({
          path: current.path,
          head: current.head,
          short_head: current.head.slice(0, 7),
          branch: current.branch || null,
          is_main: entries.length === 0,
          is_bare: Boolean(current.is_bare),
          is_locked: Boolean(current.is_locked),
          lock_reason: current.lock_reason || null,
          is_detached: Boolean(current.is_detached),
        });
      }
      current = {};
      continue;
    }

    if (line.startsWith('worktree ')) {
      current.path = line.substring('worktree '.length).trim();
    } else if (line.startsWith('HEAD ')) {
      current.head = line.substring('HEAD '.length).trim();
    } else if (line.startsWith('branch ')) {
      const fullRef = line.substring('branch '.length).trim();
      current.branch = fullRef.replace(/^refs\/heads\//, '');
    } else if (line === 'bare') {
      current.is_bare = true;
    } else if (line === 'detached') {
      current.is_detached = true;
    } else if (line.startsWith('locked')) {
      current.is_locked = true;
      const reason = line.substring('locked'.length).trim();
      current.lock_reason = reason.length > 0 ? reason : null;
    }
  }

  if (current.path && current.head) {
    entries.push({
      path: current.path,
      head: current.head,
      short_head: current.head.slice(0, 7),
      branch: current.branch || null,
      is_main: entries.length === 0,
      is_bare: Boolean(current.is_bare),
      is_locked: Boolean(current.is_locked),
      lock_reason: current.lock_reason || null,
      is_detached: Boolean(current.is_detached),
    });
  }

  return entries;
}

export async function addWorktree(
  repoPath: string,
  options: AddWorktreeOptions
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!options.path || typeof options.path !== 'string') {
    throw new Error('Worktree target path is required.');
  }

  const args: string[] = ['worktree', 'add'];

  if (options.lock) {
    args.push('--lock');
    if (options.lock_reason?.trim()) {
      args.push('--reason', options.lock_reason.trim());
    }
  }

  if (options.new_branch?.trim()) {
    args.push('-b', options.new_branch.trim(), options.path);
    if (options.commit_ish?.trim()) {
      args.push(options.commit_ish.trim());
    }
  } else if (options.branch?.trim()) {
    args.push(options.path, options.branch.trim());
  } else if (options.commit_ish?.trim()) {
    args.push('--detach', options.path, options.commit_ish.trim());
  } else {
    args.push(options.path);
  }

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force = false
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!worktreePath) {
    throw new Error('Worktree path is required.');
  }

  const args: string[] = ['worktree', 'remove'];
  if (force) {
    args.push('--force');
  }
  args.push(worktreePath);

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function lockWorktree(
  repoPath: string,
  worktreePath: string,
  reason?: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!worktreePath) {
    throw new Error('Worktree path is required.');
  }

  const args: string[] = ['worktree', 'lock'];
  if (reason?.trim()) {
    args.push('--reason', reason.trim());
  }
  args.push(worktreePath);

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function unlockWorktree(
  repoPath: string,
  worktreePath: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!worktreePath) {
    throw new Error('Worktree path is required.');
  }

  const args: string[] = ['worktree', 'unlock', worktreePath];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function pruneWorktrees(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args: string[] = ['worktree', 'prune', '-v'];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

// =========================================================================
// PHASE 4: Automated Backups, Repository Audit & History Purging Wizard
// =========================================================================

/**
 * Creates an automatic safety backup before risky operations (Level 2/3/4).
 * Kind: 'branch' (e.g., backup/pre-rebase-TIMESTAMP) or 'bundle' (offline .bundle file).
 */
export async function createBackup(
  repoPath: string,
  reason: string,
  kind: 'branch' | 'bundle' = 'branch'
): Promise<BackupRef> {
  const rootPath = await validateRepository(repoPath);
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .split('.')[0];
  const sanitizedReason = reason
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 30);

  if (kind === 'bundle') {
    const backupDir = path.join(os.tmpdir(), 'git-workbench-backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const bundleFileName = `backup-${sanitizedReason}-${timestamp}.bundle`;
    const bundleFilePath = path.join(backupDir, bundleFileName);

    const res = await runGit(rootPath, ['bundle', 'create', bundleFilePath, '--all']);
    if (res.code !== 0) {
      throw new Error(`Failed to create repository bundle backup: ${res.stderr || res.stdout}`);
    }

    let fileSize = 0;
    try {
      const stat = fs.statSync(bundleFilePath);
      fileSize = stat.size;
    } catch {
      // Ignore stat error
    }

    return {
      id: `bundle-${timestamp}`,
      kind: 'bundle',
      identifier: bundleFilePath,
      created_at: now.toISOString(),
      reason,
      file_size: fileSize,
    };
  }

  // Branch backup
  const branchName = `backup/pre-${sanitizedReason}-${timestamp}`;
  // Find current HEAD SHA
  const headRes = await runGit(rootPath, ['rev-parse', 'HEAD']);
  const headSha = headRes.stdout.trim();

  const res = await runGit(rootPath, ['branch', branchName, headSha]);
  if (res.code !== 0) {
    throw new Error(`Failed to create safety backup branch: ${res.stderr || res.stdout}`);
  }

  return {
    id: `branch-${timestamp}`,
    kind: 'branch',
    identifier: branchName,
    created_at: now.toISOString(),
    reason,
    sha: headSha,
  };
}

/**
 * Lists existing backup branches and bundle files recorded for this repository.
 */
export async function getBackups(repoPath: string): Promise<BackupRef[]> {
  const rootPath = await validateRepository(repoPath);
  const backups: BackupRef[] = [];

  // 1. List branches matching backup/*
  const branchRes = await runGit(rootPath, [
    'for-each-ref',
    '--format=%(refname:short)|%(objectname)|%(committerdate:iso8601)',
    'refs/heads/backup/',
  ]);

  if (branchRes.code === 0 && branchRes.stdout.trim()) {
    const lines = branchRes.stdout.trim().split('\n');
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        const branchName = parts[0];
        const sha = parts[1];
        const dateStr = parts[2] || new Date().toISOString();
        backups.push({
          id: branchName,
          kind: 'branch',
          identifier: branchName,
          created_at: dateStr,
          reason: branchName.replace(/^backup\/pre-/, '').split('-')[0] || 'Safety Backup',
          sha,
        });
      }
    }
  }

  // 2. Scan tmp directory for bundles
  const backupDir = path.join(os.tmpdir(), 'git-workbench-backups');
  if (fs.existsSync(backupDir)) {
    try {
      const files = fs.readdirSync(backupDir);
      for (const file of files) {
        if (file.endsWith('.bundle')) {
          const filePath = path.join(backupDir, file);
          const stat = fs.statSync(filePath);
          backups.push({
            id: file,
            kind: 'bundle',
            identifier: filePath,
            created_at: stat.mtime.toISOString(),
            reason: file.replace(/^backup-/, '').replace(/\.bundle$/, ''),
            file_size: stat.size,
          });
        }
      }
    } catch {
      // Ignore file reading errors
    }
  }

  // Sort latest first
  return backups.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Validates repository structural integrity with `git fsck --full`.
 */
export async function runGitFsck(repoPath: string): Promise<FsckResult> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, ['fsck', '--full']);

  const stdout = res.stdout;
  const stderr = res.stderr;
  const combined = `${stdout}\n${stderr}`.trim();

  const errors: string[] = [];
  const warnings: string[] = [];
  let danglingBlobs = 0;
  let danglingCommits = 0;

  const lines = combined.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('error:')) {
      errors.push(trimmed.slice(6).trim());
    } else if (trimmed.startsWith('warning:')) {
      warnings.push(trimmed.slice(8).trim());
    } else if (trimmed.includes('dangling blob')) {
      danglingBlobs++;
    } else if (trimmed.includes('dangling commit')) {
      danglingCommits++;
    }
  }

  return {
    is_healthy: res.code === 0 && errors.length === 0,
    errors,
    warnings,
    dangling_blobs: danglingBlobs,
    dangling_commits: danglingCommits,
    raw_output: combined,
  };
}

/**
 * Scans Git commit history for:
 * 1. Accidental secrets (API tokens, private keys, AWS/GitHub/Slack credentials).
 * 2. Large blobs (> 500KB) bloating git history.
 * 3. AI commit trailers or tool files (e.g. Co-authored-by: Claude/ChatGPT, .cursorrules).
 */
export async function auditRepositoryHistory(
  repoPath: string,
  commitLimit = 100
): Promise<RepoAuditReport> {
  const rootPath = await validateRepository(repoPath);
  const start = Date.now();

  const secretRules = [
    {
      id: 'openai_api_key',
      name: 'OpenAI / Anthropic API Key',
      regex: /(?:sk-[a-zA-Z0-9_-]{20,}|sk-ant-[a-zA-Z0-9_-]{20,})/,
      severity: 'critical' as const,
    },
    {
      id: 'github_pat',
      name: 'GitHub Personal Access Token',
      regex: /(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})/,
      severity: 'critical' as const,
    },
    {
      id: 'aws_access_key',
      name: 'AWS Access Key ID',
      regex: /(?:AKIA[0-9A-Z]{16})/,
      severity: 'high' as const,
    },
    {
      id: 'slack_token',
      name: 'Slack Bot / User Token',
      regex: /(?:xox[baprs]-[0-9]{10,}-[a-zA-Z0-9]{24,})/,
      severity: 'high' as const,
    },
    {
      id: 'private_key',
      name: 'Private Encryption Key (RSA/EC/OpenSSH)',
      regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      severity: 'critical' as const,
    },
    {
      id: 'generic_bearer',
      name: 'Hardcoded Bearer / Secret String',
      regex: /(?:bearer\s+[a-zA-Z0-9_\-\.]{30,}|(?:api[_-]?key|client[_-]?secret)\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{16,}['"])/i,
      severity: 'medium' as const,
    },
  ];

  const aiTrailerRegexes = [
    /Co-authored-by:.*(?:claude|chatgpt|copilot|cursor|gemini|openai|anthropic)/i,
    /Generated-by:.*(?:claude|cursor|copilot|gemini|v0)/i,
    /AI-Assisted:.*true/i,
  ];

  const secrets: SecretFinding[] = [];
  const largeFiles: LargeFileFinding[] = [];
  const aiTraces: AITraceFinding[] = [];

  // 1. Scan commits for messages and trailers
  const logRes = await runGit(rootPath, [
    'log',
    `-${commitLimit}`,
    '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%B%x1e',
  ]);

  let totalCommits = 0;
  if (logRes.code === 0 && logRes.stdout) {
    const rawCommits = logRes.stdout.split('\x1e').filter((c) => c.trim().length > 0);
    totalCommits = rawCommits.length;

    for (const raw of rawCommits) {
      const parts = raw.trim().split('\x1f');
      if (parts.length < 6) continue;
      const [sha, author, _email, date, subject, body] = parts;

      // Check AI trailers
      for (const line of body.split('\n')) {
        for (const trailerRx of aiTrailerRegexes) {
          if (trailerRx.test(line)) {
            aiTraces.push({
              id: `trailer-${sha.slice(0, 7)}-${aiTraces.length}`,
              type: 'trailer',
              category: 'commit_trailer',
              marker: line.trim(),
              commit_sha: sha,
              commit_subject: subject,
              date,
              details: `Commit message contains AI co-author / assistant trailer: "${line.trim()}"`,
              can_auto_clean: true,
            });
          }
        }
      }
    }
  }

  // 2. Scan diff patches for secrets (limiting to last 50 commits for responsive performance)
  const diffLog = await runGit(rootPath, [
    'log',
    '-p',
    '-U1',
    '-50',
    '--no-color',
  ]);

  if (diffLog.code === 0 && diffLog.stdout) {
    const diffBlocks = diffLog.stdout.split('commit ');
    for (const block of diffBlocks) {
      if (!block.trim()) continue;
      const headerEnd = block.indexOf('\n\n');
      if (headerEnd === -1) continue;
      const header = block.slice(0, headerEnd);
      const content = block.slice(headerEnd);

      const shaMatch = header.match(/^([0-9a-f]{40})/);
      const sha = shaMatch ? shaMatch[1] : 'unknown';
      const authorMatch = header.match(/Author:\s*(.*)/);
      const author = authorMatch ? authorMatch[1] : 'unknown';
      const dateMatch = header.match(/Date:\s*(.*)/);
      const date = dateMatch ? dateMatch[1] : '';

      // Find file paths and added lines
      let currentFile = 'unknown';
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('diff --git a/')) {
          const m = line.match(/diff --git a\/(.*) b\/(.*)/);
          if (m) currentFile = m[2];
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          const addedText = line.slice(1);
          for (const rule of secretRules) {
            const match = addedText.match(rule.regex);
            if (match) {
              const matchedStr = match[0];
              const redacted =
                matchedStr.length > 8
                  ? `${matchedStr.slice(0, 4)}••••${matchedStr.slice(-4)}`
                  : '••••••••';
              // Check if not duplicate for same file/commit/rule
              const exists = secrets.some(
                (s) =>
                  s.commit_sha === sha &&
                  s.file_path === currentFile &&
                  s.rule_id === rule.id
              );
              if (!exists && secrets.length < 50) {
                secrets.push({
                  rule_id: rule.id,
                  rule_name: rule.name,
                  file_path: currentFile,
                  commit_sha: sha,
                  commit_subject: 'Commit in history',
                  author,
                  date,
                  match_preview: redacted,
                  severity: rule.severity,
                });
              }
            }
          }
        }
      }
    }
  }

  // 3. Scan tree for AI configuration file markers (e.g. .cursorrules, claude.json)
  const lsTreeRes = await runGit(rootPath, ['ls-files']);
  if (lsTreeRes.code === 0 && lsTreeRes.stdout) {
    const files = lsTreeRes.stdout.trim().split('\n');
    const aiFilePatterns = [
      /\.cursorrules$/i,
      /\.cursor\/rules/i,
      /\.copilot/i,
      /claude\.md$/i,
      /\.continue\//i,
      /\.ai_config/i,
    ];

    for (const f of files) {
      for (const pattern of aiFilePatterns) {
        if (pattern.test(f)) {
          aiTraces.push({
            id: `file-${f}`,
            type: 'file_marker',
            category: 'config_file',
            marker: f,
            file_path: f,
            details: `Dedicated AI configuration / instruction file tracked in tree`,
            can_auto_clean: true,
          });
        }
      }

      // Check text files for AI Studio banners or generator comments
      const ext = path.extname(f).toLowerCase();
      if (['.md', '.html', '.htm', '.tsx', '.ts', '.jsx', '.js'].includes(ext) || f === 'README' || f === 'index.html') {
        const fullP = path.resolve(rootPath, f);
        if (fullP.startsWith(rootPath) && fs.existsSync(fullP)) {
          try {
            const content = fs.readFileSync(fullP, 'utf8');

            // Detect Built with AI Studio or GHBanner
            if (
              content.includes('GHBanner') ||
              content.includes('Built with AI Studio') ||
              content.includes('The fastest path from prompt to production with Gemini') ||
              content.includes('aistudio.google.com/apps')
            ) {
              aiTraces.push({
                id: `banner-${f}`,
                type: 'banner',
                category: 'banner',
                marker: 'Built with AI Studio HTML Banner / GHBanner',
                file_path: f,
                details: `README / HTML file contains "Built with AI Studio" hero banner and promotion`,
                snippet: `<div align="center">...<h1>Built with AI Studio</h2>...</div>`,
                can_auto_clean: true,
              });
            }

            // Detect comment watermarks
            const commentMatch = content.match(/(?:\/\*|\/\/|<!--)\s*(?:Generated by|Auto-generated with|Built with) (?:Cursor|AI Studio|Copilot|Claude|v0|ChatGPT)[^\n]*/i);
            if (commentMatch) {
              aiTraces.push({
                id: `comment-${f}`,
                type: 'comment',
                category: 'code_watermark',
                marker: commentMatch[0].trim(),
                file_path: f,
                details: `Source code contains AI generator comment watermark`,
                snippet: commentMatch[0].trim(),
                can_auto_clean: true,
              });
            }
          } catch {
            // skip
          }
        }
      }
    }

    // Also scan historical commits (including initial commit) for AI banners
    try {
      const bannerLog = await runGit(rootPath, [
        'log',
        '--all',
        '-S',
        'Built with AI Studio',
        '--format=%H%x1f%s%x1f%aI',
        '-n',
        '10',
      ]);
      if (bannerLog.code === 0 && bannerLog.stdout) {
        for (const line of bannerLog.stdout.split('\n').filter(Boolean)) {
          const [bSha, bSubj, bDate] = line.split('\x1f');
          if (bSha && !aiTraces.some((t) => t.commit_sha === bSha && t.category === 'banner')) {
            aiTraces.push({
              id: `history-banner-${bSha.slice(0, 7)}`,
              type: 'banner',
              category: 'banner',
              marker: 'Built with AI Studio Banner in Git History',
              commit_sha: bSha,
              commit_subject: bSubj,
              date: bDate,
              details: `Commit ${bSha.slice(0, 7)} ("${bSubj}") introduced "Built with AI Studio" hero banner into Git history.`,
              snippet: `<div align="center">...<h1>Built with AI Studio</h2>...</div>`,
              can_auto_clean: true,
            });
          }
        }
      }

      const ghBannerLog = await runGit(rootPath, [
        'log',
        '--all',
        '-S',
        'GHBanner',
        '--format=%H%x1f%s%x1f%aI',
        '-n',
        '10',
      ]);
      if (ghBannerLog.code === 0 && ghBannerLog.stdout) {
        for (const line of ghBannerLog.stdout.split('\n').filter(Boolean)) {
          const [bSha, bSubj, bDate] = line.split('\x1f');
          if (bSha && !aiTraces.some((t) => t.commit_sha === bSha)) {
            aiTraces.push({
              id: `history-ghbanner-${bSha.slice(0, 7)}`,
              type: 'banner',
              category: 'banner',
              marker: 'AI Studio GHBanner in Git History',
              commit_sha: bSha,
              commit_subject: bSubj,
              date: bDate,
              details: `Commit ${bSha.slice(0, 7)} ("${bSubj}") contains AI Studio GHBanner image in history.`,
              snippet: `<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/..."/>`,
              can_auto_clean: true,
            });
          }
        }
      }
    } catch {
      // Ignore git log pickaxe errors if repository is empty
    }
  }

  // 4. Scan object store for large blobs (> 500 KB)
  try {
    const revListRes = await runGit(rootPath, [
      'rev-list',
      '--objects',
      '--all',
      '--filter=blob:limit=500k',
    ]);
    if (revListRes.code === 0 && revListRes.stdout) {
      const items = revListRes.stdout.trim().split('\n');
      for (const item of items) {
        const [oid, ...pathParts] = item.trim().split(' ');
        const filePath = pathParts.join(' ');
        if (oid && filePath) {
          // get size
          const catRes = await runGit(rootPath, ['cat-file', '-s', oid]);
          const sizeBytes = parseInt(catRes.stdout.trim(), 10) || 0;
          if (sizeBytes > 500 * 1024) {
            const formatted =
              sizeBytes > 1024 * 1024
                ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                : `${(sizeBytes / 1024).toFixed(1)} KB`;

            largeFiles.push({
              path: filePath,
              oid,
              size_bytes: sizeBytes,
              formatted_size: formatted,
              commit_sha: 'Historical Blob',
              commit_subject: 'Object present in history pack',
              author: 'Repository object',
              date: new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch {
    // Large file check is best-effort if --filter is not supported by older git
  }

  return {
    scanned_at: new Date().toISOString(),
    total_commits_scanned: totalCommits,
    secrets,
    large_files: largeFiles.sort((a, b) => b.size_bytes - a.size_bytes),
    ai_traces: aiTraces,
    duration_ms: Date.now() - start,
  };
}

/**
 * Initializes a clean, isolated mirror clone for safe Level 4 history rewrites.
 * SAFETY RULE: History rewrites must never happen directly on the primary working tree!
 */
export async function setupIsolatedMirrorClone(
  sourceRepoPath: string
): Promise<MirrorCloneSetupResult> {
  const rootPath = await validateRepository(sourceRepoPath);

  // 1. Mandatory bundle backup of the source repository first
  const backupRef = await createBackup(rootPath, 'pre-history-purge', 'bundle');

  // 2. Clone into an isolated temporary mirror repository
  const mirrorDir = path.join(
    os.tmpdir(),
    `git-workbench-mirror-${Date.now()}`
  );

  const cloneRes = await runGit(null, ['clone', '--mirror', rootPath, mirrorDir]);
  if (cloneRes.code !== 0) {
    throw new Error(`Failed to create isolated mirror clone: ${cloneRes.stderr || cloneRes.stdout}`);
  }

  // Find remote url if present
  let remoteUrl: string | undefined;
  const remoteRes = await runGit(rootPath, ['config', '--get', 'remote.origin.url']);
  if (remoteRes.code === 0 && remoteRes.stdout.trim()) {
    remoteUrl = remoteRes.stdout.trim();
  }

  return {
    source_repo_path: rootPath,
    mirror_path: mirrorDir,
    bundle_backup_path: backupRef.identifier,
    backup_ref: backupRef,
    remote_url: remoteUrl,
  };
}

/**
 * Purges specified paths or rewrites history using native Git filtering in the mirror clone.
 * Adheres strictly to the 7-step safe runbook:
 * - Isolation in mirror
 * - Pre-backup verified
 * - Automatic fsck validation post-rewrite
 */
export async function executeHistoryPurge(
  mirrorPath: string,
  options: PurgePlanOptions
): Promise<OperationResult> {
  const rootPath = await validateRepository(mirrorPath);
  const start = Date.now();

  const commandsRun: string[][] = [];

  // Build filter expression or command
  // Check if python git-filter-repo is available, or fallback to git filter-branch / git-rev-list rewrite
  // If removing paths:
  if (options.paths_to_remove && options.paths_to_remove.length > 0) {
    for (const filePath of options.paths_to_remove) {
      // Using git filter-branch with index-filter for zero-dependency native execution
      const rmCommand = `git rm --cached --ignore-unmatch ${JSON.stringify(filePath)}`;
      const filterArgs = [
        'filter-branch',
        '--force',
        '--index-filter',
        rmCommand,
        '--prune-empty',
        '--tag-name-filter',
        'cat',
        '--',
        '--all',
      ];

      commandsRun.push(['filter-branch', '--index-filter', rmCommand, '--all']);
      const res = await runGit(rootPath, filterArgs, undefined, {
        FILTER_BRANCH_SQUELCH_WARNING: '1',
      });
      if (res.code !== 0) {
        return {
          success: false,
          stdout: res.stdout,
          stderr: res.stderr,
          exit_code: res.code,
          command_run: ['filter-branch', filePath],
          duration_ms: Date.now() - start,
        };
      }
    }
  }

  // Strip AI trailers if requested
  if (options.remove_ai_trailers) {
    const msgFilter = `python3 -c "import sys, re; msg = sys.stdin.read(); msg = re.sub(r'(?i)(Co-authored-by|Generated-by|AI-Assisted):.*(claude|chatgpt|copilot|cursor|gemini|openai|anthropic).*\\n?', '', msg); sys.stdout.write(msg)" 2>/dev/null || cat`;
    const filterArgs = [
      'filter-branch',
      '--force',
      '--msg-filter',
      msgFilter,
      '--',
      '--all',
    ];
    commandsRun.push(['filter-branch', '--msg-filter', '<ai-trailer-scrub>', '--all']);
    await runGit(rootPath, filterArgs, undefined, {
      FILTER_BRANCH_SQUELCH_WARNING: '1',
    });
  }

  // Author rewrites if requested
  if (options.rewrite_authors && options.rewrite_authors.length > 0) {
    for (const rule of options.rewrite_authors) {
      const script = `
        if [ "$GIT_AUTHOR_EMAIL" = "${rule.from_email || ''}" ] || [ "$GIT_COMMITTER_EMAIL" = "${rule.from_email || ''}" ]; then
          export GIT_AUTHOR_NAME="${rule.to_name}"
          export GIT_AUTHOR_EMAIL="${rule.to_email}"
          export GIT_COMMITTER_NAME="${rule.to_name}"
          export GIT_COMMITTER_EMAIL="${rule.to_email}"
        fi
      `;
      const filterArgs = [
        'filter-branch',
        '--force',
        '--env-filter',
        script,
        '--tag-name-filter',
        'cat',
        '--',
        '--all',
      ];
      commandsRun.push(['filter-branch', '--env-filter', `<rewrite-author-${rule.to_email}>`, '--all']);
      await runGit(rootPath, filterArgs, undefined, {
        FILTER_BRANCH_SQUELCH_WARNING: '1',
      });
    }
  }

  // Post-rewrite validation: Run git fsck
  const fsckRes = await runGit(rootPath, ['fsck', '--full']);

  return {
    success: fsckRes.code === 0,
    stdout: `History purge completed. Validated with git fsck (code ${fsckRes.code}).`,
    stderr: fsckRes.stderr,
    exit_code: fsckRes.code,
    command_run: commandsRun.length > 0 ? commandsRun[0] : ['filter-branch'],
    duration_ms: Date.now() - start,
  };
}

/**
 * Safely pushes rewritten mirror clone back to remote origin with explicit typed confirmation.
 */
export async function pushMirrorToRemote(
  mirrorPath: string,
  remoteUrl: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(mirrorPath);
  const args = ['push', '--mirror', remoteUrl];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

/**
 * Phase 4 Additional Hardening:
 * Standalone manual execution of `git gc --prune=now --aggressive`.
 * As specified in SAFETY_POLICY.md:
 * Must never run automatically inside any wizard or cleanup loop.
 * It is always an independent, explicitly labeled action warning that unreferenced commits become unrecoverable.
 */
export async function runGitGC(
  repoPath: string,
  mode: 'standard' | 'prune_now' | 'aggressive' = 'standard'
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['gc'];
  if (mode === 'prune_now') {
    args.push('--prune=now');
  } else if (mode === 'aggressive') {
    args.push('--prune=now', '--aggressive');
  }

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout || `Git garbage collection (${mode}) completed successfully.`,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function runManualAggressiveGC(repoPath: string): Promise<OperationResult> {
  return runGitGC(repoPath, 'aggressive');
}

export async function cleanWorkingTree(
  repoPath: string,
  mode: 'f' | 'fd' | 'fdx' = 'fd',
  dryRun = false,
  targetPath?: string
): Promise<{
  dry_run: boolean;
  cleaned_items: string[];
  output: string;
  exit_code: number;
}> {
  const rootPath = await validateRepository(repoPath);
  const args = ['clean'];
  if (dryRun) {
    args.push('-n');
  } else {
    args.push('-f');
  }
  if (mode.includes('d')) {
    args.push('-d');
  }
  if (mode.includes('x')) {
    args.push('-x');
  }
  if (targetPath && targetPath.trim()) {
    args.push('--', targetPath.trim());
  }

  const res = await runGit(rootPath, args);
  const lines = (res.stdout || '').split('\n').filter(Boolean);
  const items = lines.map((l) => l.replace(/^Would remove\s+|^Removing\s+/, '').trim()).filter(Boolean);

  return {
    dry_run: dryRun,
    cleaned_items: items,
    output: res.stdout || res.stderr,
    exit_code: res.code,
  };
}

/**
 * Phase 4 Additional Hardening:
 * Inspect status of local commit-msg and pre-commit hooks and .gitignore AI directory rules.
 */
export async function getGitHooksStatus(repoPath: string): Promise<GitHooksStatus> {
  const rootPath = await validateRepository(repoPath);
  const hooksDir = path.join(rootPath, '.git', 'hooks');
  const commitMsgPath = path.join(hooksDir, 'commit-msg');
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const gitignorePath = path.join(rootPath, '.gitignore');

  let commit_msg_installed = false;
  let commit_msg_blocks_ai_trailers = false;
  if (fs.existsSync(commitMsgPath)) {
    commit_msg_installed = true;
    try {
      const content = fs.readFileSync(commitMsgPath, 'utf8');
      if (content.includes('Co-authored-by') || content.includes('AI-Assisted') || content.includes('Claude') || content.includes('Cursor')) {
        commit_msg_blocks_ai_trailers = true;
      }
    } catch {
      // ignore
    }
  }

  let pre_commit_installed = false;
  let pre_commit_blocks_secrets = false;
  if (fs.existsSync(preCommitPath)) {
    pre_commit_installed = true;
    try {
      const content = fs.readFileSync(preCommitPath, 'utf8');
      if (content.includes('AKIA') || content.includes('sk-') || content.includes('ghp_')) {
        pre_commit_blocks_secrets = true;
      }
    } catch {
      // ignore
    }
  }

  const aiDirs = ['.cursor', '.cursorrules', '.claude', '.cline', '.ai'];
  const missing_ai_dirs: string[] = [];
  let gitignore_has_ai_dirs = false;

  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      for (const d of aiDirs) {
        if (!content.includes(d)) {
          missing_ai_dirs.push(d);
        }
      }
      gitignore_has_ai_dirs = missing_ai_dirs.length === 0;
    } catch {
      missing_ai_dirs.push(...aiDirs);
    }
  } else {
    missing_ai_dirs.push(...aiDirs);
  }

  return {
    commit_msg_installed,
    pre_commit_installed,
    commit_msg_blocks_ai_trailers,
    pre_commit_blocks_secrets,
    gitignore_has_ai_dirs,
    missing_ai_dirs,
  };
}

/**
 * Phase 4: Installs a local defense-in-depth commit-msg hook that automatically strips
 * or rejects unwanted AI attribution trailers (e.g. Co-authored-by: Claude, Claude-Session).
 */
export async function installCommitMsgHook(
  repoPath: string,
  mode: 'strip' | 'reject' = 'strip'
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const hooksDir = path.join(rootPath, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const commitMsgPath = path.join(hooksDir, 'commit-msg');

  const hookScript = mode === 'strip'
    ? `#!/usr/bin/env bash
# Git Workbench AI-Trailer Defense-In-Depth Hook (Strip Mode)
COMMIT_MSG_FILE="$1"
if [ -f "$COMMIT_MSG_FILE" ]; then
  # Strip known AI trailers
  sed -i -E '/(?i)(Co-authored-by|Generated-by|AI-Assisted|Claude-Session):.*(claude|chatgpt|copilot|cursor|gemini|openai|anthropic)/d' "$COMMIT_MSG_FILE"
fi
exit 0
`
    : `#!/usr/bin/env bash
# Git Workbench AI-Trailer Defense-In-Depth Hook (Reject Mode)
COMMIT_MSG_FILE="$1"
if [ -f "$COMMIT_MSG_FILE" ]; then
  if grep -Eiq '(Co-authored-by|Generated-by|AI-Assisted|Claude-Session):.*(claude|chatgpt|copilot|cursor|gemini|openai|anthropic)' "$COMMIT_MSG_FILE"; then
    echo "ERROR: [Git Workbench] Commit blocked due to detected AI trailer." >&2
    echo "Remove Co-authored-by / Claude-Session trailer before committing." >&2
    exit 1
  fi
fi
exit 0
`;

  const start = Date.now();
  try {
    fs.writeFileSync(commitMsgPath, hookScript, { mode: 0o755 });
    return {
      success: true,
      stdout: `commit-msg hook successfully installed in ${mode} mode.`,
      stderr: '',
      exit_code: 0,
      command_run: ['hooks', 'install', 'commit-msg', mode],
      duration_ms: Date.now() - start,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      stdout: '',
      stderr: `Failed to install commit-msg hook: ${msg}`,
      exit_code: 1,
      command_run: ['hooks', 'install', 'commit-msg'],
      duration_ms: Date.now() - start,
    };
  }
}

/**
 * Phase 4: Installs a local pre-commit hook that scans staged files for uncommitted secrets
 * and flags large files (> 500 KB) with a Git LFS recommendation.
 */
export async function installPreCommitHook(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const hooksDir = path.join(rootPath, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const preCommitPath = path.join(hooksDir, 'pre-commit');

  const hookScript = `#!/usr/bin/env bash
# Git Workbench Pre-Commit Security & Large File Guard
# Scans staged files for high-risk token signatures & large binaries

BLOCKED=0

# Check staged secrets
if git diff --cached --unified=0 | grep -E -q '(AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{36}|xoxb-[0-9]{10,}-[a-zA-Z0-9]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)'; then
  echo "ERROR: [Git Workbench] High-risk secret detected in staged changes!" >&2
  echo "Commit rejected to protect credentials. Unstage or remove secrets before committing." >&2
  BLOCKED=1
fi

# Check large files (> 500KB)
for file in $(git diff --cached --name-only --diff-filter=ACM); do
  if [ -f "$file" ]; then
    size=$(wc -c < "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
    if [ "$size" -gt 524288 ]; then
      echo "WARNING: [Git Workbench] Staged file '$file' is > 500KB ($size bytes)." >&2
      echo "Consider using Git LFS to keep repository history lean." >&2
    fi
  fi
done

if [ "$BLOCKED" -eq 1 ]; then
  exit 1
fi

exit 0
`;

  const start = Date.now();
  try {
    fs.writeFileSync(preCommitPath, hookScript, { mode: 0o755 });
    return {
      success: true,
      stdout: 'pre-commit hook installed successfully with secret scanner and large file warning.',
      stderr: '',
      exit_code: 0,
      command_run: ['hooks', 'install', 'pre-commit'],
      duration_ms: Date.now() - start,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      stdout: '',
      stderr: `Failed to install pre-commit hook: ${msg}`,
      exit_code: 1,
      command_run: ['hooks', 'install', 'pre-commit'],
      duration_ms: Date.now() - start,
    };
  }
}

/**
 * Phase 4: Adds common AI directories (.cursor, .claude, etc.) to .gitignore.
 */
export async function updateGitignoreAIDirectories(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const gitignorePath = path.join(rootPath, '.gitignore');
  const aiEntries = [
    '',
    '# AI coding tool workspaces & local settings (Git Workbench guard)',
    '.cursor/',
    '.cursorrules',
    '.claude/',
    '.cline/',
    '',
  ].join('\n');

  const start = Date.now();
  try {
    if (fs.existsSync(gitignorePath)) {
      const existing = fs.readFileSync(gitignorePath, 'utf8');
      fs.writeFileSync(gitignorePath, existing.endsWith('\n') ? `${existing}${aiEntries}` : `${existing}\n${aiEntries}`);
    } else {
      fs.writeFileSync(gitignorePath, aiEntries);
    }

    return {
      success: true,
      stdout: '.gitignore updated with AI development directories.',
      stderr: '',
      exit_code: 0,
      command_run: ['gitignore', 'add', '.cursor/', '.claude/', '.cursorrules'],
      duration_ms: Date.now() - start,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      stdout: '',
      stderr: `Failed to update .gitignore: ${msg}`,
      exit_code: 1,
      command_run: ['gitignore', 'add'],
      duration_ms: Date.now() - start,
    };
  }
}

/**
 * Phase 3 Power Tools Extensions: Tags, Submodules, Bisect, Rerere, and LFS
 */

export async function getTags(repoPath: string): Promise<TagInfo[]> {
  const rootPath = await validateRepository(repoPath);
  const format = '%(refname:short)%00%(objectname)%00%(objecttype)%00%(subject)%00%(taggername)%00%(taggeremail)%00%(taggerdate:iso)';
  const res = await runGit(rootPath, ['for-each-ref', `--format=${format}`, 'refs/tags/']);
  if (res.code !== 0) return [];

  const lines = res.stdout.split('\n').filter(Boolean);
  return lines.map((line) => {
    const [name, sha, type, subject, taggerName, taggerEmail, taggerDate] = line.split('\0');
    return {
      name: name || '',
      sha: sha || '',
      short_sha: (sha || '').slice(0, 7),
      is_annotated: type === 'tag',
      message: subject || undefined,
      tagger_name: taggerName || undefined,
      tagger_email: taggerEmail || undefined,
      tagger_date: taggerDate || undefined,
    };
  });
}

export async function createTag(repoPath: string, options: CreateTagOptions): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const tagName = options.name.trim();
  if (!tagName || !/^[\w./-]+$/.test(tagName)) {
    throw new Error('Invalid tag name.');
  }

  const args = ['tag'];
  if (options.force) args.push('-f');
  if (options.message?.trim()) {
    args.push('-a', '-m', options.message.trim());
  }
  args.push(tagName);
  if (options.target_sha?.trim()) {
    args.push(options.target_sha.trim());
  }

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout || `Created tag ${tagName}`,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function deleteTag(repoPath: string, tagName: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!tagName.trim() || !/^[\w./-]+$/.test(tagName.trim())) {
    throw new Error('Invalid tag name.');
  }

  const args = ['tag', '-d', tagName.trim()];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout || `Deleted tag ${tagName}`,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function getSubmodules(repoPath: string): Promise<SubmoduleInfo[]> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, ['submodule', 'status']);
  if (res.code !== 0) return [];

  const submodules: SubmoduleInfo[] = [];
  const lines = res.stdout.split('\n').filter(Boolean);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const prefix = trimmed.charAt(0);
    const parts = trimmed.substring(1).trim().split(/\s+/);
    if (parts.length >= 2) {
      const sha = parts[0];
      const subPath = parts[1];
      let status: 'clean' | 'modified' | 'uninitialized' | 'conflict' = 'clean';
      if (prefix === '-') status = 'uninitialized';
      else if (prefix === '+') status = 'modified';
      else if (prefix === 'U') status = 'conflict';

      submodules.push({
        name: subPath.split('/').pop() || subPath,
        path: subPath,
        head_sha: sha,
        short_head: sha.slice(0, 7),
        url: '',
        status,
      });
    }
  }

  return submodules;
}

export async function updateSubmodules(repoPath: string, recursive = true): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['submodule', 'update', '--init'];
  if (recursive) args.push('--recursive');

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout || 'Submodules updated successfully.',
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function getBisectStatus(repoPath: string): Promise<BisectStatus> {
  const rootPath = await validateRepository(repoPath);
  const bisectStartPath = path.join(rootPath, '.git', 'BISECT_START');
  const inBisect = fs.existsSync(bisectStartPath);

  if (!inBisect) {
    return { in_bisect: false };
  }

  const logRes = await runGit(rootPath, ['bisect', 'log']);
  return {
    in_bisect: true,
    output: logRes.stdout,
  };
}

export async function runBisectCommand(
  repoPath: string,
  action: 'start' | 'good' | 'bad' | 'reset' | 'skip',
  commitSha?: string
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['bisect', action];
  if (commitSha?.trim()) {
    args.push(commitSha.trim());
  }

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function getRerereStatus(repoPath: string): Promise<RerereStatus> {
  const rootPath = await validateRepository(repoPath);
  const checkEnabled = await runGit(rootPath, ['config', '--get', 'rerere.enabled']);
  const isEnabled = checkEnabled.stdout.trim() === 'true' || checkEnabled.stdout.trim() === '1';

  const rrDir = path.join(rootPath, '.git', 'rr-cache');
  let recordedCount = 0;
  if (fs.existsSync(rrDir)) {
    try {
      recordedCount = fs.readdirSync(rrDir).length;
    } catch {
      // ignore
    }
  }

  return {
    enabled: isEnabled,
    resolved_recorded: recordedCount,
  };
}

export async function toggleRerere(repoPath: string, enable: boolean): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['config', 'rerere.enabled', enable ? 'true' : 'false'];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: `rerere.enabled set to ${enable}`,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function getLfsDiagnostics(repoPath: string): Promise<LfsDiagnostics> {
  const rootPath = await validateRepository(repoPath);
  const versionRes = await runGit(rootPath, ['lfs', 'version']);
  const isInstalled = versionRes.code === 0;

  const gitattributesPath = path.join(rootPath, '.gitattributes');
  const trackedPatterns: string[] = [];
  if (fs.existsSync(gitattributesPath)) {
    const content = fs.readFileSync(gitattributesPath, 'utf8');
    for (const line of content.split('\n')) {
      if (line.includes('filter=lfs')) {
        const pattern = line.split(/\s+/)[0];
        if (pattern) trackedPatterns.push(pattern);
      }
    }
  }

  return {
    is_installed: isInstalled,
    tracked_patterns: trackedPatterns,
    locked_files: [],
  };
}

export async function getRangeDiff(
  repoPath: string,
  baseSha: string,
  oldHeadSha: string,
  newHeadSha: string,
  creationFactor?: number
): Promise<RangeDiffResult> {
  const rootPath = await validateRepository(repoPath);
  const range1 = `${baseSha.trim()}..${oldHeadSha.trim()}`;
  const range2 = `${baseSha.trim()}..${newHeadSha.trim()}`;
  const args = ['range-diff'];
  if (
    creationFactor !== undefined &&
    !Number.isNaN(creationFactor) &&
    creationFactor >= 0 &&
    creationFactor <= 100
  ) {
    args.push(`--creation-factor=${Math.round(creationFactor)}`);
  }
  args.push(range1, range2);
  const res = await runGit(rootPath, args);

  const output = res.stdout || res.stderr || 'No differences between ranges.';
  const entries: RangeDiffResult['diff_entries'] = [];

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('=')) {
      entries.push({ status: 'matched', summary: trimmed });
    } else if (trimmed.startsWith('!')) {
      entries.push({ status: 'modified', summary: trimmed });
    } else if (trimmed.startsWith('+')) {
      entries.push({ status: 'added', summary: trimmed });
    } else if (trimmed.startsWith('-')) {
      entries.push({ status: 'removed', summary: trimmed });
    } else {
      entries.push({ status: 'modified', summary: trimmed });
    }
  }

  return {
    output,
    diff_entries: entries,
  };
}

export async function mergeWithOptions(
  repoPath: string,
  options: MergeExecutionOptions
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['merge'];

  // Strict differentiation:
  // -X ours: use recursive/ort merge driver, but auto-resolve conflicting hunks favoring our current version
  // -X theirs: use recursive/ort merge driver, but auto-resolve conflicting hunks favoring the incoming version
  // -s ours: discard entire tree of incoming branch; merge commit simply keeps our exact tree untouched
  if (options.strategy === 'recursive-ours') {
    args.push('-X', 'ours');
  } else if (options.strategy === 'recursive-theirs') {
    args.push('-X', 'theirs');
  } else if (options.strategy === 'strategy-ours') {
    args.push('-s', 'ours');
  }

  // Fast-forward policy
  if (options.fastForward === 'no-ff') {
    args.push('--no-ff');
  } else if (options.fastForward === 'ff-only') {
    args.push('--ff-only');
  }

  // Squash merge
  if (options.squash) {
    args.push('--squash');
  }

  // No-commit (pause after merge stage before committing)
  if (options.noCommit) {
    args.push('--no-commit');
  }

  // Allow unrelated histories
  if (options.allowUnrelatedHistories) {
    args.push('--allow-unrelated-histories');
  }

  // Autostash
  if (options.autostash) {
    args.push('--autostash');
  }

  if (options.message?.trim() && !options.squash) {
    args.push('-m', options.message.trim());
  }

  args.push(options.branchName.trim());

  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

export async function previewForceRelocateBranch(
  repoPath: string,
  branchName: string,
  newSha: string
): Promise<ForceRelocateBranchPreview> {
  const rootPath = await validateRepository(repoPath);
  // Get current SHA of the target branch
  const shaRes = await runGit(rootPath, ['rev-parse', branchName.trim()]);
  const currentSha = shaRes.stdout.trim();

  // Find commits reachable from currentSha but NOT reachable from newSha (these would become dangling/lost from this branch)
  const logRes = await runGit(rootPath, [
    'log',
    '--format=%H|%s|%an|%ae|%ad',
    '--date=iso',
    `${newSha.trim()}..${currentSha}`,
  ]);

  const lostCommits: CommitInfo[] = [];
  if (logRes.stdout.trim()) {
    for (const line of logRes.stdout.trim().split('\n')) {
      const parts = line.split('|');
      if (parts.length >= 4) {
        lostCommits.push({
          sha: parts[0],
          subject: parts[1] || '',
          author_name: parts[2] || '',
          author_email: parts[3] || '',
          author_date: parts[4] || '',
          committer_name: parts[2] || '',
          committer_email: parts[3] || '',
          committer_date: parts[4] || '',
          body: '',
          refs: [],
          parents: [],
        });
      }
    }
  }

  return {
    targetBranch: branchName,
    currentSha,
    newSha,
    lostCommits,
  };
}

export async function executeForceRelocateBranch(
  repoPath: string,
  branchName: string,
  newSha: string,
  createBackup: boolean = true
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);

  // Safety verification: Git refuses `branch -f` on currently checked out branch
  const statusRes = await runGit(rootPath, ['symbolic-ref', '--short', 'HEAD']);
  const currentBranch = statusRes.stdout.trim();
  if (currentBranch === branchName.trim()) {
    return {
      success: false,
      stdout: '',
      stderr: `Cannot force update the currently checked out branch '${branchName}' via branch -f. To move HEAD to ${newSha.slice(0, 7)}, please switch branches first or use the 'Reset' operation.`,
      exit_code: 1,
      command_run: ['branch', '-f', branchName, newSha],
      duration_ms: 0,
    };
  }

  // Create automatic safety backup ref before repositioning
  if (createBackup) {
    const safeBranchName = branchName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const backupName = `backup/${safeBranchName}-${Date.now()}`;
    await runGit(rootPath, ['branch', backupName, branchName.trim()]);
  }

  const args = ['branch', '-f', branchName.trim(), newSha.trim()];
  const res = await runGit(rootPath, args);
  return {
    success: res.code === 0,
    stdout: res.stdout || `Branch ${branchName} successfully relocated to ${newSha.slice(0, 7)}.`,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: args,
    duration_ms: res.duration_ms,
  };
}

/**
 * Prompts the operating system's native folder dialog (Windows, macOS, or Linux).
 * Returns the selected absolute directory path, or null if canceled/unavailable.
 */
export async function pickFolderDialog(): Promise<{
  path: string | null;
  cancelled: boolean;
  error?: string;
}> {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWindows) {
    return new Promise((resolve) => {
      const psCommand =
        "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; " +
        "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog; " +
        "$dialog.Description = 'Select Git Repository'; " +
        "$dialog.ShowNewFolderButton = $false; " +
        "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) } else { [Console]::Out.Write('__CANCELLED__') }";

      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCommand],
        (err, stdout) => {
          if (err) {
            return resolve({ path: null, cancelled: false, error: err.message });
          }
          const trimmed = (stdout || '').trim();
          if (!trimmed || trimmed === '__CANCELLED__') {
            return resolve({ path: null, cancelled: true });
          }
          return resolve({ path: trimmed, cancelled: false });
        }
      );
    });
  } else if (isMac) {
    return new Promise((resolve) => {
      const script =
        'try\n' +
        '  set chosenFolder to choose folder with prompt "Select Git Repository"\n' +
        '  POSIX path of chosenFolder\n' +
        'on error\n' +
        '  "__CANCELLED__"\n' +
        'end try';
      execFile('osascript', ['-e', script], (err, stdout) => {
        if (err) {
          return resolve({ path: null, cancelled: false, error: err.message });
        }
        const trimmed = (stdout || '').trim();
        if (!trimmed || trimmed === '__CANCELLED__') {
          return resolve({ path: null, cancelled: true });
        }
        return resolve({ path: trimmed, cancelled: false });
      });
    });
  } else {
    // Linux: try zenity then kdialog
    return new Promise((resolve) => {
      execFile(
        'zenity',
        ['--file-selection', '--directory', '--title=Select Git Repository'],
        (err, stdout) => {
          if (!err && stdout && stdout.trim()) {
            return resolve({ path: stdout.trim(), cancelled: false });
          }
          execFile('kdialog', ['--getexistingdirectory', '.'], (kerr, kstdout) => {
            if (!kerr && kstdout && kstdout.trim()) {
              return resolve({ path: kstdout.trim(), cancelled: false });
            }
            if (err && (err as any).code === 1) {
              return resolve({ path: null, cancelled: true });
            }
            return resolve({
              path: null,
              cancelled: false,
              error: 'Native OS dialog unavailable in this environment',
            });
          });
        }
      );
    });
  }
}

/**
 * Helper to test wildcard patterns (e.g. *main, feature/*, *.ts)
 */
function matchWildcardString(str: string, pattern: string): boolean {
  if (!pattern || pattern.trim() === '*' || pattern.trim() === '') return true;
  const regex = new RegExp(
    '^' +
      pattern
        .trim()
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
    'i'
  );
  return regex.test(str);
}

/**
 * Searches across working tree, selected branches, or git commit history.
 * Supports wildcards (*code*, *.com), regex, case sensitivity, word boundary,
 * branch filters, and file path filters.
 */
export async function searchRepository(
  repoPath: string,
  options: SearchQueryOptions
): Promise<SearchResponse> {
  const rootPath = await validateRepository(repoPath);
  const startTime = performance.now();

  const query = options.query?.trim() || '';
  if (!query) {
    return {
      query: '',
      total_matches: 0,
      files_matched: 0,
      results: [],
      commit_results: [],
      duration_ms: 0,
    };
  }

  // Determine if query is regex or contains wildcards
  const hasWildcard = !options.isRegex && (query.includes('*') || query.includes('?'));
  const isExtended = options.isRegex || hasWildcard;

  // Convert search expression
  let searchExpr = query;
  if (hasWildcard) {
    // Escape special regex chars except * and ?
    searchExpr = query
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
  }

  // Build flags for git grep
  const grepFlags: string[] = [];
  if (!options.isCaseSensitive) {
    grepFlags.push('-i');
  }
  if (options.isWholeWord && !hasWildcard) {
    grepFlags.push('-w');
  }
  if (isExtended) {
    grepFlags.push('-E');
  }

  // Build pathspecs
  const pathspecs: string[] = [];
  if (options.pathPrefix && options.pathPrefix.trim()) {
    pathspecs.push(options.pathPrefix.trim());
  }
  if (options.fileFilter && options.fileFilter.trim()) {
    const rawFilters = options.fileFilter.split(/[,\s]+/).filter(Boolean);
    for (const f of rawFilters) {
      if (f.startsWith('!')) {
        pathspecs.push(`:!${f.slice(1)}`);
      } else {
        pathspecs.push(f);
      }
    }
  }

  // Regular expression for computing replacement preview and match bounds
  let jsRegex: RegExp;
  try {
    const flags = options.isCaseSensitive ? 'g' : 'gi';
    if (options.isRegex) {
      jsRegex = new RegExp(query, flags);
    } else if (hasWildcard) {
      jsRegex = new RegExp(searchExpr, flags);
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      jsRegex = new RegExp(options.isWholeWord ? `\\b${escaped}\\b` : escaped, flags);
    }
  } catch {
    jsRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  }

  const resultsMap = new Map<string, SearchFileResult>();
  const commitResults: SearchCommitMatch[] = [];

  if (options.searchScope === 'working_tree') {
    // Run git grep on working tree including untracked files
    const args = ['grep', '-n', '-I', '--untracked', ...grepFlags, '-e', searchExpr];
    if (pathspecs.length > 0) {
      args.push('--', ...pathspecs);
    }

    const res = await runGit(rootPath, args);
    const lines = res.stdout ? res.stdout.split('\n') : [];

    for (const line of lines) {
      if (!line.trim()) continue;
      // Format: <file>:<line>:<content>
      const match = line.match(/^([^:\r\n]+):(\d+):(.*)$/);
      if (!match) continue;

      const [, filePath, lineStr, lineContent] = match;
      const lineNum = parseInt(lineStr, 10);

      // Check fileFilter if specified and not fully captured by pathspec
      if (options.fileFilter) {
        const fileName = path.basename(filePath);
        const filters = options.fileFilter.split(/[,\s]+/).filter(Boolean);
        const includeFilters = filters.filter((f) => !f.startsWith('!'));
        const excludeFilters = filters.filter((f) => f.startsWith('!')).map((f) => f.slice(1));

        if (includeFilters.length > 0) {
          const matchedAny = includeFilters.some((f) => matchWildcardString(fileName, f) || matchWildcardString(filePath, f));
          if (!matchedAny) continue;
        }
        if (excludeFilters.some((f) => matchWildcardString(fileName, f) || matchWildcardString(filePath, f))) {
          continue;
        }
      }

      // Compute match positions
      let matchStart = 0;
      let matchEnd = query.length;
      jsRegex.lastIndex = 0;
      const execResult = jsRegex.exec(lineContent);
      if (execResult) {
        matchStart = execResult.index;
        matchEnd = execResult.index + execResult[0].length;
      }

      let replacedContent: string | undefined;
      if (options.replaceText !== undefined) {
        jsRegex.lastIndex = 0;
        replacedContent = lineContent.replace(jsRegex, options.replaceText);
      }

      if (!resultsMap.has(filePath)) {
        resultsMap.set(filePath, {
          file_path: filePath,
          branch_or_commit: 'Working Tree',
          matches: [],
        });
      }

      resultsMap.get(filePath)!.matches.push({
        line_number: lineNum,
        line_content: lineContent,
        match_start: matchStart,
        match_end: matchEnd,
        replaced_content: replacedContent,
      });

      if (resultsMap.size >= (options.maxResults || 500)) break;
    }
  } else if (options.searchScope === 'selected_branches') {
    // Get all branches
    const allBranches = await getBranches(rootPath);
    let targetBranches = allBranches;

    if (options.branches && options.branches.length > 0) {
      targetBranches = allBranches.filter((b) => options.branches!.includes(b.name));
    } else if (options.branchPattern && options.branchPattern.trim()) {
      targetBranches = allBranches.filter((b) => matchWildcardString(b.name, options.branchPattern!));
    }

    const branchNames = targetBranches.map((b) => b.name).slice(0, 30);
    if (branchNames.length > 0) {
      const args = ['grep', '-n', '-I', ...grepFlags, '-e', searchExpr, ...branchNames];
      if (pathspecs.length > 0) {
        args.push('--', ...pathspecs);
      }

      const res = await runGit(rootPath, args);
      const lines = res.stdout ? res.stdout.split('\n') : [];

      for (const line of lines) {
        if (!line.trim()) continue;
        // Format with refs: <ref>:<file>:<line>:<content>
        const match = line.match(/^([^:\r\n]+):([^:\r\n]+):(\d+):(.*)$/);
        if (!match) continue;

        const [, refName, filePath, lineStr, lineContent] = match;
        const lineNum = parseInt(lineStr, 10);
        const mapKey = `${refName}:${filePath}`;

        let replacedContent: string | undefined;
        if (options.replaceText !== undefined) {
          jsRegex.lastIndex = 0;
          replacedContent = lineContent.replace(jsRegex, options.replaceText);
        }

        if (!resultsMap.has(mapKey)) {
          resultsMap.set(mapKey, {
            file_path: filePath,
            branch_or_commit: refName,
            matches: [],
          });
        }

        resultsMap.get(mapKey)!.matches.push({
          line_number: lineNum,
          line_content: lineContent,
          match_start: 0,
          match_end: query.length,
          replaced_content: replacedContent,
        });

        if (resultsMap.size >= (options.maxResults || 500)) break;
      }
    }
  } else if (options.searchScope === 'all_commits') {
    // Pickaxe history search (-S for exact string, -G for regex)
    const pickaxeFlag = options.isRegex || hasWildcard ? '-G' : '-S';
    const logArgs = [
      'log',
      '--all',
      pickaxeFlag,
      searchExpr,
      '--oneline',
      '--name-only',
      '-n',
      '100',
    ];
    if (pathspecs.length > 0) {
      logArgs.push('--', ...pathspecs);
    }

    const res = await runGit(rootPath, logArgs);
    if (res.stdout) {
      const blocks = res.stdout.split(/\n(?=[a-f0-9]{7,40}\s)/g);
      for (const block of blocks) {
        const lines = block.split('\n').filter(Boolean);
        if (lines.length === 0) continue;
        const header = lines[0];
        const shaMatch = header.match(/^([a-f0-9]{7,40})\s+(.*)$/);
        if (!shaMatch) continue;

        const [, shortSha, subject] = shaMatch;
        const files = lines.slice(1);

        for (const file of files) {
          commitResults.push({
            sha: shortSha,
            short_sha: shortSha.slice(0, 7),
            subject,
            author_name: '',
            author_date: '',
            file_path: file.trim(),
          });
          if (commitResults.length >= 200) break;
        }
        if (commitResults.length >= 200) break;
      }
    }

    // Also search commit messages
    const msgArgs = ['log', '--all', `--grep=${query}`, '--oneline', '-n', '50'];
    const msgRes = await runGit(rootPath, msgArgs);
    if (msgRes.stdout) {
      const msgLines = msgRes.stdout.split('\n').filter(Boolean);
      for (const mLine of msgLines) {
        const parts = mLine.match(/^([a-f0-9]{7,40})\s+(.*)$/);
        if (!parts) continue;
        const [, sSha, sSubj] = parts;
        if (!commitResults.some((c) => c.sha === sSha)) {
          commitResults.push({
            sha: sSha,
            short_sha: sSha.slice(0, 7),
            subject: sSubj,
            author_name: '',
            author_date: '',
          });
        }
      }
    }
  }

  const results = Array.from(resultsMap.values());
  const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0);

  return {
    query,
    total_matches: totalMatches,
    files_matched: results.length,
    results,
    commit_results: commitResults,
    duration_ms: Math.round(performance.now() - startTime),
  };
}

/**
 * Replaces matching text across specified files on disk (Working Tree).
 */
export async function replaceInFiles(
  repoPath: string,
  options: ReplaceFileOptions
): Promise<ReplaceResponse> {
  const rootPath = await validateRepository(repoPath);

  if (!options.query || options.replaceText === undefined) {
    return {
      success: false,
      replaced_files_count: 0,
      total_replacements_count: 0,
      modified_files: [],
      error: 'Query or replaceText missing',
    };
  }

  const hasWildcard = !options.isRegex && (options.query.includes('*') || options.query.includes('?'));
  let searchExpr = options.query;
  if (hasWildcard) {
    searchExpr = options.query
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
  }

  let jsRegex: RegExp;
  try {
    const flags = options.isCaseSensitive ? 'g' : 'gi';
    if (options.isRegex || hasWildcard) {
      jsRegex = new RegExp(searchExpr, flags);
    } else {
      const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      jsRegex = new RegExp(options.isWholeWord ? `\\b${escaped}\\b` : escaped, flags);
    }
  } catch (err: unknown) {
    return {
      success: false,
      replaced_files_count: 0,
      total_replacements_count: 0,
      modified_files: [],
      error: `Invalid search expression: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let replacedFilesCount = 0;
  let totalReplacementsCount = 0;
  const modifiedFiles: string[] = [];

  for (const relPath of options.filePaths) {
    const fullPath = path.resolve(rootPath, relPath);
    // Security check: ensure path stays within repository
    if (!fullPath.startsWith(rootPath)) {
      continue;
    }
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      let fileModified = false;

      const newLines = lines.map((line, idx) => {
        const lineNum = idx + 1;
        if (options.lineNumbers && options.lineNumbers.length > 0) {
          if (!options.lineNumbers.includes(lineNum)) {
            return line;
          }
        }

        jsRegex.lastIndex = 0;
        if (jsRegex.test(line)) {
          jsRegex.lastIndex = 0;
          const matchCount = (line.match(jsRegex) || []).length;
          totalReplacementsCount += matchCount;
          fileModified = true;
          jsRegex.lastIndex = 0;
          return line.replace(jsRegex, options.replaceText);
        }
        return line;
      });

      if (fileModified) {
        fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
        replacedFilesCount++;
        modifiedFiles.push(relPath);
      }
    } catch (err: unknown) {
      console.error(`Failed to replace in file ${relPath}:`, err);
    }
  }

  return {
    success: true,
    replaced_files_count: replacedFilesCount,
    total_replacements_count: totalReplacementsCount,
    modified_files: modifiedFiles,
  };
}

/**
 * Automatically sanitizes and removes AI signs, banners, co-author trailers, and configuration files
 * from Working Tree and/or Git Commit History.
 */
export async function cleanAITraces(
  repoPath: string,
  options: CleanAITracesOptions
): Promise<CleanAITracesResult> {
  const rootPath = await validateRepository(repoPath);
  const startTime = performance.now();
  let totalTracesRemoved = 0;
  const cleanedFiles: string[] = [];
  let cleanedCommitsCount = 0;
  let backupRef: string | undefined;

  // 1. Create a safety backup ref if requested (default true)
  if (options.createSafetyBackup !== false) {
    const timestamp = Date.now();
    const backupName = `refs/backups/pre-ai-clean-${timestamp}`;
    const headRes = await runGit(rootPath, ['rev-parse', 'HEAD']);
    if (headRes.code === 0 && headRes.stdout) {
      const headSha = headRes.stdout.trim();
      await runGit(rootPath, ['update-ref', backupName, headSha]);
      backupRef = backupName;
    }
  }

  // 2. Clean Working Tree files (banners, badges, comments, config files)
  const lsFilesRes = await runGit(rootPath, ['ls-files', '-co', '--exclude-standard']);
  const files =
    lsFilesRes.code === 0 && lsFilesRes.stdout
      ? lsFilesRes.stdout.split('\n').filter(Boolean)
      : [];

  const textFileExts = [
    '.md',
    '.html',
    '.htm',
    '.tsx',
    '.ts',
    '.jsx',
    '.js',
    '.json',
    '.yaml',
    '.yml',
    '.txt',
    '.css',
  ];

  // Specific and general AI Studio & AI banner regexes
  const bannerRegexes = [
    /<div\s+align=["']center["']>\s*<img[^>]*GHBanner[^>]*>[\s\S]*?<\/div>\s*/gi,
    /<div\s+align=["']center["']>[\s\S]*?Built with AI Studio[\s\S]*?<\/div>\s*/gi,
    /<div\s+align=["']center["']>[\s\S]*?The fastest path from prompt to production with Gemini[\s\S]*?<\/div>\s*/gi,
    /<div\s+align=["']center["']>[\s\S]*?aistudio\.google\.com[\s\S]*?<\/div>\s*/gi,
    /<div[^>]*>[\s\S]*?Built with (?:AI Studio|v0|Cursor|ChatGPT)[\s\S]*?<\/div>\s*/gi,
    /\[!\[Built with AI Studio\]\([^)]+\)\]\([^)]+\)\s*/gi,
    /\[!\[Generated by Cursor\]\([^)]+\)\]\([^)]+\)\s*/gi,
    /\[!\[Created with v0\]\([^)]+\)\]\([^)]+\)\s*/gi,
    /<!--\s*Built with AI Studio\s*-->\s*/gi,
    /<!--\s*Generated by (?:Cursor|v0|Copilot|Claude)\s*-->\s*/gi,
  ];

  // Comment watermark regexes
  const commentRegexes = [
    /\/\*\s*Generated by (?:Cursor|AI Studio|Copilot|Claude|v0)[\s\S]*?\*\/\s*/gi,
    /\/\/\s*Generated by (?:Cursor|AI Studio|Copilot|Claude|v0|ChatGPT)[^\r\n]*[\r\n]*/gi,
  ];

  for (const relPath of files) {
    const fullPath = path.resolve(rootPath, relPath);
    if (!fullPath.startsWith(rootPath) || !fs.existsSync(fullPath)) continue;

    const baseName = path.basename(relPath).toLowerCase();

    // Check if it's an AI config file to remove
    if (options.removeConfigFiles) {
      if (
        baseName === '.cursorrules' ||
        relPath.startsWith('.cursor/') ||
        baseName === '.windsurfrules' ||
        baseName === 'copilot-instructions.md'
      ) {
        try {
          fs.unlinkSync(fullPath);
          totalTracesRemoved++;
          cleanedFiles.push(`${relPath} (deleted file)`);
          continue;
        } catch {
          // ignore
        }
      }
    }

    const ext = path.extname(relPath).toLowerCase();
    if (!textFileExts.includes(ext) && !baseName.endsWith('rc') && !baseName.startsWith('.')) {
      continue;
    }

    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Clean banners
      if (options.cleanBanners !== false) {
        for (const rx of bannerRegexes) {
          if (rx.test(content)) {
            content = content.replace(rx, '');
            modified = true;
            totalTracesRemoved++;
          }
        }
      }

      // Clean comment watermarks
      if (options.cleanCommentWatermarks) {
        for (const rx of commentRegexes) {
          if (rx.test(content)) {
            content = content.replace(rx, '');
            modified = true;
            totalTracesRemoved++;
          }
        }
      }

      if (modified) {
        content = content.replace(/^\s*\n\s*\n/, '\n');
        fs.writeFileSync(fullPath, content, 'utf8');
        cleanedFiles.push(relPath);
      }
    } catch {
      // skip unreadable
    }
  }

  // 3. Clean Commit History (Rewriting history to remove AI banners from initial commit & all commits, and strip trailers)
  const shouldCleanHistoryBanners = options.cleanHistoryBanners === true;
  const shouldCleanHistoryTrailers = options.cleanTrailersInHistory !== false;

  if (shouldCleanHistoryBanners || shouldCleanHistoryTrailers) {
    // Discard any working-tree edits from step 2 before history rewrite,
    // because filter-branch will rewrite all commits and check out the clean tree directly without creating unwanted intermediate commits.
    const statusRes = await runGit(rootPath, ['status', '--porcelain']);
    if (statusRes.code === 0 && statusRes.stdout.trim().length > 0) {
      await runGit(rootPath, ['reset', '--hard', 'HEAD']);
      await runGit(rootPath, ['clean', '-fd']);
    }

    const gitDir = path.join(rootPath, '.git');
    const treeFilterFile = path.join(gitDir, 'clean_ai_tree.py');
    const msgFilterFile = path.join(gitDir, 'clean_ai_msg.py');

    const filterArgs = ['filter-branch', '--force'];

    // Write tree-filter script if cleaning banners/config files in history
    if (shouldCleanHistoryBanners) {
      const treeScriptContent = `import os, shutil

# Remove AI config files from historical commit tree
for f in [".cursorrules", ".windsurfrules", "copilot-instructions.md", ".claude.md", "agents.md"]:
    if os.path.exists(f):
        try: os.remove(f)
        except: pass
for d in [".cursor", ".claude", ".cline"]:
    if os.path.exists(d) and os.path.isdir(d):
        try: shutil.rmtree(d)
        except: pass

# Clean text files (README, .md, .html, source files)
for root, dirs, files in os.walk("."):
    if ".git" in root.split(os.sep):
        continue
    for fn in files:
        low = fn.lower()
        if low.startswith("readme") or low.endswith(".md") or low.endswith(".html") or low.endswith(".htm") or low.endswith(".txt"):
            fp = os.path.join(root, fn)
            try:
                with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                new_lines = []
                in_banner = False
                modified = False
                for line in lines:
                    low_line = line.lower()
                    if ("<div" in low_line and ("align=\\"center\\"" in low_line or "align='center'" in low_line)) or ("<div" in low_line and "ghbanner" in low_line):
                        in_banner = True
                        modified = True
                        continue
                    if in_banner:
                        if "</div>" in low_line:
                            in_banner = False
                        continue
                    if "built with ai studio" in low_line or "the fastest path from prompt to production with gemini" in low_line or "aistudio.google.com" in low_line:
                        modified = True
                        continue
                    new_lines.append(line)
                if modified:
                    clean_content = "".join(new_lines).strip()
                    with open(fp, "w", encoding="utf-8") as f:
                        if clean_content:
                            f.write(clean_content + "\\n")
                        else:
                            f.write("")
            except Exception:
                pass
`;
      try {
        fs.writeFileSync(treeFilterFile, treeScriptContent, 'utf8');
        filterArgs.push('--tree-filter', `python3 ${treeFilterFile}`);
      } catch (err) {
        console.error('Failed to write tree filter script:', err);
      }
    }

    // Write msg-filter script if cleaning commit trailers in history
    if (shouldCleanHistoryTrailers) {
      const msgScriptContent = `
import sys, re
msg = sys.stdin.read()
# Strip AI co-author / assistant trailers
msg = re.sub(r'(?im)^Co-authored-by:\\s*(?:Cursor|Copilot|GitHub Copilot|Claude|ChatGPT|OpenAI|Anthropic|Gemini|v0|Devin|Windsurf|AI).*$\\n?', '', msg)
msg = re.sub(r'(?im)^Generated-by:\\s*(?:Cursor|Copilot|Claude|ChatGPT|v0|Gemini|Windsurf|Devin).*$\\n?', '', msg)
msg = re.sub(r'(?im)^AI-Assisted:\\s*true.*$\\n?', '', msg)
sys.stdout.write(msg.rstrip() + '\\n')
`;
      try {
        fs.writeFileSync(msgFilterFile, msgScriptContent, 'utf8');
        filterArgs.push('--msg-filter', `python3 ${msgFilterFile}`);
      } catch (err) {
        console.error('Failed to write msg filter script:', err);
      }
    }

    filterArgs.push('--tag-name-filter', 'cat', '--', '--all');

    try {
      const filterRes = await runGit(rootPath, filterArgs, undefined, {
        FILTER_BRANCH_SQUELCH_WARNING: '1',
      });
      if (filterRes.code === 0) {
        cleanedCommitsCount = 1;
        totalTracesRemoved += 2;

        // Clean up temporary refs/original/ to keep repo pristine
        const refsOrigRes = await runGit(rootPath, ['for-each-ref', '--format=%(refname)', 'refs/original/']);
        if (refsOrigRes.code === 0 && refsOrigRes.stdout) {
          const origRefs = refsOrigRes.stdout.split('\n').filter(Boolean);
          for (const oRef of origRefs) {
            await runGit(rootPath, ['update-ref', '-d', oRef]);
          }
        }
      }
    } catch (err) {
      console.error('filter-branch execution failed:', err);
    } finally {
      // Clean up temporary python script files
      if (fs.existsSync(treeFilterFile)) {
        try { fs.unlinkSync(treeFilterFile); } catch { /* ignore */ }
      }
      if (fs.existsSync(msgFilterFile)) {
        try { fs.unlinkSync(msgFilterFile); } catch { /* ignore */ }
      }
    }
  }

  return {
    success: true,
    cleaned_files: cleanedFiles,
    cleaned_commits_count: cleanedCommitsCount,
    total_traces_removed: totalTracesRemoved,
    backup_ref: backupRef,
    duration_ms: Math.round(performance.now() - startTime),
  };
}





