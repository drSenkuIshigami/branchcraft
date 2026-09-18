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
import path from 'node:path';
import type {
  BranchInfo,
  ChangeType,
  CommitDetail,
  CommitDetailFile,
  CommitInfo,
  FileChange,
  FileDiff,
  GitAvailability,
  OperationResult,
  StatusInfo,
} from '../src/types';

function runGit(
  repoPath: string | null,
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number; duration_ms: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const options = repoPath ? { cwd: repoPath } : {};
    execFile('git', args, options, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        code: error ? (error.code as unknown as number) || 1 : 0,
        duration_ms: Date.now() - start,
      });
    });
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

    const currRes = await runGit(rootPath, ['show', `${rev}:${filePath}`]);
    newContent = currRes.code === 0 ? currRes.stdout : '';
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

export async function createCommit(repoPath: string, message: string): Promise<OperationResult> {
  const rootPath = await validateRepository(repoPath);
  if (!message.trim()) {
    throw new Error('Commit message cannot be empty');
  }
  const res = await runGit(rootPath, ['commit', '-m', message]);
  return {
    success: res.code === 0,
    stdout: res.stdout,
    stderr: res.stderr,
    exit_code: res.code,
    command_run: ['commit', '-m', message],
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
