import type { Plugin } from 'vite';
import url from 'node:url';
import {
  amendCommit,
  applyStash,
  branchFromStash,
  checkGitAvailability,
  clearStashes,
  createBranch,
  createCommit,
  createOrGetSampleRepo,
  createStash,
  deleteBranch,
  discardPath,
  dropStash,
  getBranches,
  getCommitDetail,
  getCommitGraph,
  getFileDiff,
  getStashDetail,
  getStashes,
  getStatus,
  popStash,
  renameBranch,
  resetHard,
  stageAll,
  stagePath,
  switchBranch,
  unstageAll,
  unstagePath,
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
            const resData = await createCommit(repoPath, message);
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

          next();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          sendJson(500, { error: message });
        }
      });
    },
  };
}
