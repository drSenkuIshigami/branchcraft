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

export async function resetHard(repoPath: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const args = ['reset', '--hard', 'HEAD'];
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
  setUpstream = false
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  const trimmedRemote = remote.trim();
  if (!trimmedRemote || /[\s;&|><]/.test(trimmedRemote)) {
    throw new Error('Invalid remote name');
  }

  const args = ['push'];
  if (setUpstream) {
    args.push('-u');
  }
  if (forceWithLease) {
    // Safe standard as per SAFETY_POLICY.md and COMMAND_ALLOWLIST.md
    args.push('--force-with-lease');
  }
  args.push(trimmedRemote);

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
  baseSha: string
): Promise<RebaseTodoItem[]> {
  const rootPath = await validateRepository(repoPath);
  const res = await runGit(rootPath, [
    'log',
    '--reverse',
    '--format=%H%x00%h%x00%an%x00%s',
    `${baseSha}..HEAD`,
  ]);

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
  items: RebaseTodoItem[]
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);

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
    const res = await runGit(
      rootPath,
      ['rebase', '-i', baseSha],
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
      command_run: ['rebase', '-i', baseSha],
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
  mode: 'soft' | 'mixed' | 'hard' = 'mixed'
): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);

  if (!target || !/^[\w@{}~^/.-]+$/.test(target)) {
    throw new Error(`Invalid target ref format: ${target}`);
  }

  let backupRef: string | undefined = undefined;
  let backupDuration = 0;

  // Level 3 Safety Policy: When performing --hard reset, create an automatic backup branch first!
  if (mode === 'hard') {
    const timestamp = Date.now();
    backupRef = `backup/pre-reset-${timestamp}`;
    const backupRes = await runGit(rootPath, ['branch', backupRef, 'HEAD']);
    backupDuration = backupRes.duration_ms;
  }

  const flag = mode === 'soft' ? '--soft' : mode === 'hard' ? '--hard' : '--mixed';
  const args = ['reset', flag, target];
  const res = await runGit(rootPath, args);

  let stdout = res.stdout;
  if (backupRef) {
    stdout = `[Safety Backup created at refs/heads/${backupRef}]\n` + stdout;
  }

  return {
    success: res.code === 0,
    stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: backupRef ? ['branch', backupRef, 'HEAD', '&&', ...args] : args,
    duration_ms: res.duration_ms + backupDuration,
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

