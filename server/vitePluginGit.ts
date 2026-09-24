import type { Plugin } from 'vite';
import url from 'node:url';
import {
  amendCommit,
  applyStash,
  branchFromStash,
  checkGitAvailability,
  cherryPickAbort,
  cherryPickCommit,
  cherryPickContinue,
  cherryPickSkip,
  clearStashes,
  createBranch,
  createCommit,
  createDemoCherryPickConflict,
  createOrGetSampleRepo,
  createStash,
  deleteBranch,
  discardPath,
  abortConflictOperation,
  continueConflictOperation,
  createDemoConflict,
  discardHunk,
  dropStash,
  executeInteractiveRebase,
  getBranches,
  getCommitDetail,
  getCommitGraph,
  getConflictState,
  getDetailedRebaseStatus,
  getFileDiff,
  getGitUserConfig,
  getRebaseCandidates,
  getReflog,
  getRemotes,
  getStashDetail,
  getStashes,
  getStatus,
  getSyncStatus,
  gitFetch,
  gitPull,
  gitPush,
  launchMergetool,
  modifyCommitAuthorDate,
  openSystemLocation,
  popStash,
  rebaseSkip,
  renameBranch,
  resetHard,
  resetToTarget,
  resolveConflict,
  restoreFileFromCommit,
  revertAbort,
  revertCommit,
  revertContinue,
  revertSkip,
  createDemoRevertConflict,
  stageAll,
  stageHunk,
  stagePath,
  switchBranch,
  unstageAll,
  unstageHunk,
  unstagePath,
  getWorktrees,
  addWorktree,
  removeWorktree,
  lockWorktree,
  unlockWorktree,
  pruneWorktrees,
  createBackup,
  getBackups,
  runGitFsck,
  auditRepositoryHistory,
  setupIsolatedMirrorClone,
  executeHistoryPurge,
  pushMirrorToRemote,
  runManualAggressiveGC,
  getGitHooksStatus,
  installCommitMsgHook,
  installPreCommitHook,
  updateGitignoreAIDirectories,
  getTags,
  createTag,
  deleteTag,
  getSubmodules,
  updateSubmodules,
  getBisectStatus,
  runBisectCommand,
  getRerereStatus,
  toggleRerere,
  getLfsDiagnostics,
} from './gitService';

export function gitApiPlugin(): Plugin {
  return {
    name: 'git-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;

        const sendJson = (statusCode: number, data: unknown) => {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = statusCode;
          res.end(JSON.stringify(data));
        };

        const readBody = (): Promise<Record<string, unknown>> => {
          return new Promise((resolve) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch {
                resolve({});
              }
            });
          });
        };

        try {
          if (pathname === '/api/git-availability') {
            const status = await checkGitAvailability();
            return sendJson(200, status);
          }

          if (pathname === '/api/git/sample_repo' && req.method === 'POST') {
            const samplePath = await createOrGetSampleRepo();
            const status = await getStatus(samplePath);
            return sendJson(200, { path: samplePath, status });
          }

          if (pathname === '/api/git/open_repository' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.path === 'string' ? body.path : '';
            if (!repoPath) {
              return sendJson(400, { error: 'Repository path is required' });
            }
            const status = await getStatus(repoPath);
            return sendJson(200, status);
          }

          if (pathname === '/api/git/status' && req.method === 'GET') {
            const repoPath = typeof parsedUrl.query.path === 'string' ? parsedUrl.query.path : '';
            if (!repoPath) return sendJson(400, { error: 'path query required' });
            const status = await getStatus(repoPath);
            return sendJson(200, status);
          }

          if (pathname === '/api/git/branches' && req.method === 'GET') {
            const repoPath = typeof parsedUrl.query.path === 'string' ? parsedUrl.query.path : '';
            if (!repoPath) return sendJson(400, { error: 'path query required' });
            const branches = await getBranches(repoPath);
            return sendJson(200, branches);
          }

          if (pathname === '/api/git/commit_graph' && req.method === 'GET') {
            const repoPath = typeof parsedUrl.query.path === 'string' ? parsedUrl.query.path : '';
            const limit = parseInt(parsedUrl.query.limit as string, 10) || 100;
            const skip = parseInt(parsedUrl.query.skip as string, 10) || 0;
            if (!repoPath) return sendJson(400, { error: 'path query required' });
            const commits = await getCommitGraph(repoPath, limit, skip);
            return sendJson(200, commits);
          }

          if (pathname === '/api/git/commit_detail' && req.method === 'GET') {
            const repoPath = typeof parsedUrl.query.path === 'string' ? parsedUrl.query.path : '';
            const sha = typeof parsedUrl.query.sha === 'string' ? parsedUrl.query.sha : '';
            if (!repoPath || !sha) return sendJson(400, { error: 'path and sha required' });
            const detail = await getCommitDetail(repoPath, sha);
            return sendJson(200, detail);
          }

          if (pathname === '/api/git/file_diff' && req.method === 'GET') {
            const repoPath = typeof parsedUrl.query.path === 'string' ? parsedUrl.query.path : '';
            const filePath = typeof parsedUrl.query.file === 'string' ? parsedUrl.query.file : '';
            const rev = typeof parsedUrl.query.rev === 'string' ? parsedUrl.query.rev : null;
            if (!repoPath || !filePath) return sendJson(400, { error: 'path and file required' });
            const diff = await getFileDiff(repoPath, filePath, rev);
            return sendJson(200, diff);
          }

          if (pathname === '/api/git/stashes' && req.method === 'GET') {
            const repoPath = typeof parsedUrl.query.path === 'string' ? parsedUrl.query.path : '';
            if (!repoPath) return sendJson(400, { error: 'path query required' });
            const stashes = await getStashes(repoPath);
            return sendJson(200, stashes);
          }

          if (pathname === '/api/git/stash_detail' && req.method === 'GET') {
            const repoPath = typeof parsedUrl.query.path === 'string' ? parsedUrl.query.path : '';
            const stashRef =
              typeof parsedUrl.query.stash_ref === 'string' ? parsedUrl.query.stash_ref : '';
            if (!repoPath || !stashRef) {
              return sendJson(400, { error: 'path and stash_ref required' });
            }
            const detail = await getStashDetail(repoPath, stashRef);
            return sendJson(200, detail);
          }

          if (pathname === '/api/git/stage_path' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const filePath = typeof body.path === 'string' ? body.path : '';
            if (!repoPath || !filePath) return sendJson(400, { error: 'repo_path and path required' });
            const resData = await stagePath(repoPath, filePath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/unstage_path' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const filePath = typeof body.path === 'string' ? body.path : '';
            if (!repoPath || !filePath) return sendJson(400, { error: 'repo_path and path required' });
            const resData = await unstagePath(repoPath, filePath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/discard_path' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const filePath = typeof body.path === 'string' ? body.path : '';
            const isUntracked = Boolean(body.is_untracked);
            if (!repoPath || !filePath) return sendJson(400, { error: 'repo_path and path required' });
            const resData = await discardPath(repoPath, filePath, isUntracked);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/stage_all' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await stageAll(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/unstage_all' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await unstageAll(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/commit' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const message = typeof body.message === 'string' ? body.message : '';
            if (!repoPath || !message) return sendJson(400, { error: 'repo_path and message required' });
            const options = {
              authorName: typeof body.author_name === 'string' ? body.author_name : undefined,
              authorEmail: typeof body.author_email === 'string' ? body.author_email : undefined,
              authorDate: typeof body.author_date === 'string' ? body.author_date : undefined,
              committerDate: typeof body.committer_date === 'string' ? body.committer_date : undefined,
            };
            const resData = await createCommit(repoPath, message, options);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/config/user' && req.method === 'GET') {
            const repoPath =
              typeof parsedUrl.query.repo_path === 'string'
                ? parsedUrl.query.repo_path
                : typeof parsedUrl.query.path === 'string'
                ? parsedUrl.query.path
                : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getGitUserConfig(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/commit/modify_author_date' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await modifyCommitAuthorDate(repoPath, body);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/commit_amend' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const message = typeof body.message === 'string' ? body.message : '';
            if (!repoPath || !message) return sendJson(400, { error: 'repo_path and message required' });
            const resData = await amendCommit(repoPath, message);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/create_branch' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const name = typeof body.name === 'string' ? body.name : '';
            const startSha = typeof body.start_sha === 'string' ? body.start_sha : undefined;
            if (!repoPath || !name) return sendJson(400, { error: 'repo_path and name required' });
            const resData = await createBranch(repoPath, name, startSha);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/switch_branch' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const name = typeof body.name === 'string' ? body.name : '';
            if (!repoPath || !name) return sendJson(400, { error: 'repo_path and name required' });
            const resData = await switchBranch(repoPath, name);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/rename_branch' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const oldName = typeof body.old_name === 'string' ? body.old_name : '';
            const newName = typeof body.new_name === 'string' ? body.new_name : '';
            if (!repoPath || !oldName || !newName) {
              return sendJson(400, { error: 'repo_path, old_name, and new_name required' });
            }
            const resData = await renameBranch(repoPath, oldName, newName);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/delete_branch' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const name = typeof body.name === 'string' ? body.name : '';
            const force = Boolean(body.force);
            if (!repoPath || !name) return sendJson(400, { error: 'repo_path and name required' });
            const resData = await deleteBranch(repoPath, name, force);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/stash_push' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const message = typeof body.message === 'string' ? body.message : undefined;
            const includeUntracked = Boolean(body.include_untracked);
            const keepIndex = Boolean(body.keep_index);
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await createStash(repoPath, message, includeUntracked, keepIndex);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/stash_apply' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const stashRef = typeof body.stash_ref === 'string' ? body.stash_ref : '';
            const reinstateIndex = Boolean(body.reinstate_index);
            if (!repoPath || !stashRef) {
              return sendJson(400, { error: 'repo_path and stash_ref required' });
            }
            const resData = await applyStash(repoPath, stashRef, reinstateIndex);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/stash_pop' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const stashRef = typeof body.stash_ref === 'string' ? body.stash_ref : '';
            const reinstateIndex = Boolean(body.reinstate_index);
            if (!repoPath || !stashRef) {
              return sendJson(400, { error: 'repo_path and stash_ref required' });
            }
            const resData = await popStash(repoPath, stashRef, reinstateIndex);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/stash_drop' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const stashRef = typeof body.stash_ref === 'string' ? body.stash_ref : '';
            if (!repoPath || !stashRef) {
              return sendJson(400, { error: 'repo_path and stash_ref required' });
            }
            const resData = await dropStash(repoPath, stashRef);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/stash_clear' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await clearStashes(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/stash_branch' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const branchName = typeof body.branch_name === 'string' ? body.branch_name : '';
            const stashRef = typeof body.stash_ref === 'string' ? body.stash_ref : '';
            if (!repoPath || !branchName || !stashRef) {
              return sendJson(400, { error: 'repo_path, branch_name, and stash_ref required' });
            }
            const resData = await branchFromStash(repoPath, branchName, stashRef);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/reset_hard' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await resetHard(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/remotes' && req.method === 'GET') {
            const repoPath = typeof parsedUrl.query.path === 'string' ? parsedUrl.query.path : '';
            if (!repoPath) return sendJson(400, { error: 'path query required' });
            const remotes = await getRemotes(repoPath);
            return sendJson(200, remotes);
          }

          if (pathname === '/api/git/sync_status' && req.method === 'GET') {
            const repoPath = typeof parsedUrl.query.path === 'string' ? parsedUrl.query.path : '';
            if (!repoPath) return sendJson(400, { error: 'path query required' });
            const syncStatus = await getSyncStatus(repoPath);
            return sendJson(200, syncStatus);
          }

          if (pathname === '/api/git/fetch' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const remote = typeof body.remote === 'string' ? body.remote : 'origin';
            const prune = body.prune !== undefined ? Boolean(body.prune) : true;
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await gitFetch(repoPath, remote, prune);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/pull' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const remote = typeof body.remote === 'string' ? body.remote : 'origin';
            const branch = typeof body.branch === 'string' ? body.branch : undefined;
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await gitPull(repoPath, remote, branch);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/push' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const remote = typeof body.remote === 'string' ? body.remote : 'origin';
            const branch = typeof body.branch === 'string' ? body.branch : undefined;
            const forceWithLease = Boolean(body.force_with_lease);
            const setUpstream = Boolean(body.set_upstream);
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await gitPush(repoPath, remote, branch, forceWithLease, setUpstream);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/restore_from_commit' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const sha = typeof body.sha === 'string' ? body.sha : '';
            const filePath = typeof body.file_path === 'string' ? body.file_path : '';
            if (!repoPath || !sha || !filePath) {
              return sendJson(400, { error: 'repo_path, sha, and file_path required' });
            }
            const resData = await restoreFileFromCommit(repoPath, sha, filePath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/open_system' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const target = body.target === 'file_manager' ? 'file_manager' : 'terminal';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await openSystemLocation(repoPath, target);
            return sendJson(200, resData);
          }

          // Hunk Staging / Discarding
          if (pathname === '/api/git/hunk/stage' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const patch = typeof body.patch === 'string' ? body.patch : '';
            if (!repoPath || !patch) return sendJson(400, { error: 'repo_path and patch required' });
            const resData = await stageHunk(repoPath, patch);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/hunk/unstage' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const patch = typeof body.patch === 'string' ? body.patch : '';
            if (!repoPath || !patch) return sendJson(400, { error: 'repo_path and patch required' });
            const resData = await unstageHunk(repoPath, patch);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/hunk/discard' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const patch = typeof body.patch === 'string' ? body.patch : '';
            if (!repoPath || !patch) return sendJson(400, { error: 'repo_path and patch required' });
            const resData = await discardHunk(repoPath, patch);
            return sendJson(200, resData);
          }

          // Conflict Resolution
          if (pathname === '/api/git/conflict/state' && req.method === 'GET') {
            const repoPath =
              typeof parsedUrl.query.repo_path === 'string'
                ? parsedUrl.query.repo_path
                : typeof parsedUrl.query.path === 'string'
                ? parsedUrl.query.path
                : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getConflictState(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/conflict/resolve' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const filePath = typeof body.file_path === 'string' ? body.file_path : '';
            const resolution = body.resolution as 'ours' | 'theirs' | 'mark_resolved';
            if (!repoPath || !filePath || !resolution) {
              return sendJson(400, { error: 'repo_path, file_path, and resolution required' });
            }
            const resData = await resolveConflict(repoPath, filePath, resolution);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/conflict/mergetool' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const filePath = typeof body.file_path === 'string' ? body.file_path : undefined;
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await launchMergetool(repoPath, filePath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/conflict/continue' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await continueConflictOperation(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/conflict/abort' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await abortConflictOperation(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/conflict/create_demo' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await createDemoConflict(repoPath);
            return sendJson(200, resData);
          }

          // Interactive Rebase (Phase 3 Step 1)
          if (pathname === '/api/git/rebase/candidates' && req.method === 'GET') {
            const repoPath =
              typeof parsedUrl.query.repo_path === 'string'
                ? parsedUrl.query.repo_path
                : typeof parsedUrl.query.path === 'string'
                ? parsedUrl.query.path
                : '';
            const baseSha = typeof parsedUrl.query.base_sha === 'string' ? parsedUrl.query.base_sha : '';
            if (!repoPath || !baseSha) {
              return sendJson(400, { error: 'repo_path and base_sha required' });
            }
            const resData = await getRebaseCandidates(repoPath, baseSha);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/rebase/status' && req.method === 'GET') {
            const repoPath =
              typeof parsedUrl.query.repo_path === 'string'
                ? parsedUrl.query.repo_path
                : typeof parsedUrl.query.path === 'string'
                ? parsedUrl.query.path
                : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getDetailedRebaseStatus(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/rebase/start' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const baseSha = typeof body.base_sha === 'string' ? body.base_sha : '';
            const items = Array.isArray(body.items) ? body.items : [];
            if (!repoPath || !baseSha || items.length === 0) {
              return sendJson(400, { error: 'repo_path, base_sha, and non-empty items required' });
            }
            const resData = await executeInteractiveRebase(repoPath, baseSha, items);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/rebase/skip' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await rebaseSkip(repoPath);
            return sendJson(200, resData);
          }

          // Cherry-Pick Workflow (Phase 3 Step 3)
          if (pathname === '/api/git/cherry_pick' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const sha = typeof body.sha === 'string' ? body.sha : '';
            const options = body.options && typeof body.options === 'object' ? body.options : undefined;
            if (!repoPath || !sha) {
              return sendJson(400, { error: 'repo_path and sha required' });
            }
            const resData = await cherryPickCommit(repoPath, sha, options);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/cherry_pick/continue' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await cherryPickContinue(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/cherry_pick/skip' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await cherryPickSkip(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/cherry_pick/abort' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await cherryPickAbort(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/cherry_pick/create_demo' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await createDemoCherryPickConflict(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/revert' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const sha = typeof body.sha === 'string' ? body.sha : '';
            const options = body.options && typeof body.options === 'object' ? body.options : undefined;
            if (!repoPath || !sha) {
              return sendJson(400, { error: 'repo_path and sha required' });
            }
            const resData = await revertCommit(repoPath, sha, options);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/revert/continue' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await revertContinue(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/revert/skip' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await revertSkip(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/revert/abort' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await revertAbort(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/revert/create_demo' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await createDemoRevertConflict(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/reflog' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const limit = typeof body.limit === 'number' ? body.limit : 100;
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getReflog(repoPath, limit);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/reflog/reset' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const target = typeof body.target === 'string' ? body.target : '';
            const mode = body.mode === 'soft' || body.mode === 'hard' ? body.mode : 'mixed';
            if (!repoPath || !target) return sendJson(400, { error: 'repo_path and target required' });
            const resData = await resetToTarget(repoPath, target, mode);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/worktrees' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getWorktrees(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/worktrees/add' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const path = typeof body.path === 'string' ? body.path : '';
            if (!repoPath || !path) return sendJson(400, { error: 'repo_path and path required' });
            const resData = await addWorktree(repoPath, {
              path,
              branch: typeof body.branch === 'string' ? body.branch : undefined,
              new_branch: typeof body.new_branch === 'string' ? body.new_branch : undefined,
              commit_ish: typeof body.commit_ish === 'string' ? body.commit_ish : undefined,
              lock: Boolean(body.lock),
              lock_reason: typeof body.lock_reason === 'string' ? body.lock_reason : undefined,
            });
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/worktrees/remove' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const worktreePath = typeof body.worktree_path === 'string' ? body.worktree_path : '';
            const force = Boolean(body.force);
            if (!repoPath || !worktreePath) return sendJson(400, { error: 'repo_path and worktree_path required' });
            const resData = await removeWorktree(repoPath, worktreePath, force);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/worktrees/lock' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const worktreePath = typeof body.worktree_path === 'string' ? body.worktree_path : '';
            const reason = typeof body.reason === 'string' ? body.reason : undefined;
            if (!repoPath || !worktreePath) return sendJson(400, { error: 'repo_path and worktree_path required' });
            const resData = await lockWorktree(repoPath, worktreePath, reason);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/worktrees/unlock' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const worktreePath = typeof body.worktree_path === 'string' ? body.worktree_path : '';
            if (!repoPath || !worktreePath) return sendJson(400, { error: 'repo_path and worktree_path required' });
            const resData = await unlockWorktree(repoPath, worktreePath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/worktrees/prune' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await pruneWorktrees(repoPath);
            return sendJson(200, resData);
          }

          // Phase 4: Safety, Backups, Health & Purging Endpoints
          if (pathname === '/api/git/backups/create' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const reason = typeof body.reason === 'string' ? body.reason : 'Manual safety backup';
            const kind = body.kind === 'bundle' ? 'bundle' : 'branch';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await createBackup(repoPath, reason, kind);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/backups/list' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getBackups(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/fsck' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await runGitFsck(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/audit' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const limit = typeof body.limit === 'number' ? body.limit : 100;
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await auditRepositoryHistory(repoPath, limit);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/purge/setup-mirror' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await setupIsolatedMirrorClone(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/purge/execute' && req.method === 'POST') {
            const body = await readBody();
            const mirrorPath = typeof body.mirror_path === 'string' ? body.mirror_path : '';
            const options = body.options || {};
            if (!mirrorPath) return sendJson(400, { error: 'mirror_path required' });
            const resData = await executeHistoryPurge(mirrorPath, options);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/purge/push-remote' && req.method === 'POST') {
            const body = await readBody();
            const mirrorPath = typeof body.mirror_path === 'string' ? body.mirror_path : '';
            const remoteUrl = typeof body.remote_url === 'string' ? body.remote_url : '';
            if (!mirrorPath || !remoteUrl) return sendJson(400, { error: 'mirror_path and remote_url required' });
            const resData = await pushMirrorToRemote(mirrorPath, remoteUrl);
            return sendJson(200, resData);
          }

          // Phase 4 Hardening: Isolated manual git gc
          if (pathname === '/api/git/maintenance/gc' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await runManualAggressiveGC(repoPath);
            return sendJson(200, resData);
          }

          // Phase 4 Hardening: Hooks and gitignore inspection
          if (pathname === '/api/git/hooks/status' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getGitHooksStatus(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/hooks/install-commit-msg' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const mode = body.mode === 'reject' ? 'reject' : 'strip';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await installCommitMsgHook(repoPath, mode);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/hooks/install-pre-commit' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await installPreCommitHook(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/gitignore/add-ai-rules' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await updateGitignoreAIDirectories(repoPath);
            return sendJson(200, resData);
          }

          // Tags API (Phase 3 Extension)
          if (pathname === '/api/git/tags' && req.method === 'GET') {
            const repoPath =
              typeof parsedUrl.query.repo_path === 'string'
                ? parsedUrl.query.repo_path
                : typeof parsedUrl.query.path === 'string'
                ? parsedUrl.query.path
                : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getTags(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/tags/create' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const name = typeof body.name === 'string' ? body.name : '';
            if (!repoPath || !name) return sendJson(400, { error: 'repo_path and name required' });
            const resData = await createTag(repoPath, {
              name,
              target_sha: typeof body.target_sha === 'string' ? body.target_sha : undefined,
              message: typeof body.message === 'string' ? body.message : undefined,
              force: Boolean(body.force),
            });
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/tags/delete' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const tagName = typeof body.tag_name === 'string' ? body.tag_name : '';
            if (!repoPath || !tagName) return sendJson(400, { error: 'repo_path and tag_name required' });
            const resData = await deleteTag(repoPath, tagName);
            return sendJson(200, resData);
          }

          // Submodules API (Phase 3 Extension)
          if (pathname === '/api/git/submodules' && req.method === 'GET') {
            const repoPath =
              typeof parsedUrl.query.repo_path === 'string'
                ? parsedUrl.query.repo_path
                : typeof parsedUrl.query.path === 'string'
                ? parsedUrl.query.path
                : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getSubmodules(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/submodules/update' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await updateSubmodules(repoPath, body.recursive !== false);
            return sendJson(200, resData);
          }

          // Bisect API (Phase 3 Extension)
          if (pathname === '/api/git/bisect/status' && req.method === 'GET') {
            const repoPath =
              typeof parsedUrl.query.repo_path === 'string'
                ? parsedUrl.query.repo_path
                : typeof parsedUrl.query.path === 'string'
                ? parsedUrl.query.path
                : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getBisectStatus(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/bisect/command' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            const action = body.action;
            const validActions = ['start', 'good', 'bad', 'reset', 'skip'] as const;
            if (
              !repoPath ||
              typeof action !== 'string' ||
              !validActions.includes(action as (typeof validActions)[number])
            ) {
              return sendJson(400, { error: 'Valid repo_path and action (start, good, bad, reset, skip) required' });
            }
            const resData = await runBisectCommand(
              repoPath,
              action as (typeof validActions)[number],
              typeof body.commit_sha === 'string' ? body.commit_sha : undefined
            );
            return sendJson(200, resData);
          }

          // Rerere API (Phase 3 Extension)
          if (pathname === '/api/git/rerere/status' && req.method === 'GET') {
            const repoPath =
              typeof parsedUrl.query.repo_path === 'string'
                ? parsedUrl.query.repo_path
                : typeof parsedUrl.query.path === 'string'
                ? parsedUrl.query.path
                : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getRerereStatus(repoPath);
            return sendJson(200, resData);
          }

          if (pathname === '/api/git/rerere/toggle' && req.method === 'POST') {
            const body = await readBody();
            const repoPath = typeof body.repo_path === 'string' ? body.repo_path : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await toggleRerere(repoPath, Boolean(body.enable));
            return sendJson(200, resData);
          }

          // LFS Diagnostics (Phase 3 Extension)
          if (pathname === '/api/git/lfs/diagnostics' && req.method === 'GET') {
            const repoPath =
              typeof parsedUrl.query.repo_path === 'string'
                ? parsedUrl.query.repo_path
                : typeof parsedUrl.query.path === 'string'
                ? parsedUrl.query.path
                : '';
            if (!repoPath) return sendJson(400, { error: 'repo_path required' });
            const resData = await getLfsDiagnostics(repoPath);
            return sendJson(200, resData);
          }




          next();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          sendJson(500, { error: message });
        }
      });
    },
  };
}
