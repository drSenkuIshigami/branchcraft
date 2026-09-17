import type { Plugin } from 'vite';
import url from 'node:url';
import {
  checkGitAvailability,
  createOrGetSampleRepo,
  getBranches,
  getCommitDetail,
  getCommitGraph,
  getFileDiff,
  getStatus,
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

          next();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          sendJson(500, { error: message });
        }
      });
    },
  };
}
