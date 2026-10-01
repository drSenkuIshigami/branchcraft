import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import type { WorkloadPlan } from '../src/types';
import { planFileWorkload } from './workloadPlan.ts';

function workerScriptPath(): string {
  const beside = fileURLToPath(new URL('./fileWorker.cjs', import.meta.url));
  if (fs.existsSync(beside)) return beside;
  const fromCwd = path.resolve(process.cwd(), 'server', 'fileWorker.cjs');
  if (fs.existsSync(fromCwd)) return fromCwd;
  throw new Error('File worker script is missing');
}

function splitPaths(filePaths: string[], workers: number): string[][] {
  const chunks: string[][] = Array.from({ length: workers }, () => []);
  filePaths.forEach((filePath, index) => {
    chunks[index % workers].push(filePath);
  });
  return chunks.filter((chunk) => chunk.length > 0);
}

function runWorker(workerData: object): Promise<Record<string, unknown>> {
  const script = workerScriptPath();
  return new Promise((resolve, reject) => {
    const worker = new Worker(script, { workerData });
    let settled = false;
    worker.once('message', (message: { ok?: boolean; result?: Record<string, unknown>; error?: string }) => {
      settled = true;
      if (!message || message.ok === false) {
        reject(new Error(message?.error || 'File worker failed'));
        return;
      }
      resolve(message.result || {});
    });
    worker.once('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    worker.once('exit', (code) => {
      if (!settled && code !== 0) {
        settled = true;
        reject(new Error(`File worker exited with code ${code}`));
      }
    });
  });
}

export async function runReplacePool(input: {
  rootPath: string;
  filePaths: string[];
  query: string;
  replaceText: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  hasWildcard: boolean;
  searchExpr: string;
  lineNumbers?: number[];
}): Promise<{
  plan: WorkloadPlan;
  replacedFilesCount: number;
  totalReplacementsCount: number;
  modifiedFiles: string[];
}> {
  const plan = await planFileWorkload(input.filePaths.length);
  const chunks = splitPaths(input.filePaths, plan.workers);
  const parts = await Promise.all(
    chunks.map((filePaths) =>
      runWorker({
        job: 'replace',
        rootPath: input.rootPath,
        filePaths,
        query: input.query,
        replaceText: input.replaceText,
        isRegex: input.isRegex,
        isCaseSensitive: input.isCaseSensitive,
        isWholeWord: input.isWholeWord,
        hasWildcard: input.hasWildcard,
        searchExpr: input.searchExpr,
        lineNumbers: input.lineNumbers || [],
      })
    )
  );
  const modifiedFiles: string[] = [];
  let replacedFilesCount = 0;
  let totalReplacementsCount = 0;
  for (const part of parts) {
    replacedFilesCount += Number(part.replacedFilesCount) || 0;
    totalReplacementsCount += Number(part.totalReplacementsCount) || 0;
    const files = part.modifiedFiles;
    if (Array.isArray(files)) {
      for (const file of files) {
        if (typeof file === 'string') modifiedFiles.push(file);
      }
    }
  }
  return { plan, replacedFilesCount, totalReplacementsCount, modifiedFiles };
}

export async function runCleanPool(input: {
  rootPath: string;
  filePaths: string[];
  removeConfigFiles: boolean;
  cleanBanners: boolean;
  cleanCommentWatermarks: boolean;
  textExts: string[];
  bannerRegexes: { source: string; flags: string }[];
  commentRegexes: { source: string; flags: string }[];
}): Promise<{
  plan: WorkloadPlan;
  cleanedFiles: string[];
  totalTracesRemoved: number;
}> {
  const plan = await planFileWorkload(input.filePaths.length);
  const chunks = splitPaths(input.filePaths, plan.workers);
  const parts = await Promise.all(
    chunks.map((filePaths) =>
      runWorker({
        job: 'clean',
        rootPath: input.rootPath,
        filePaths,
        removeConfigFiles: input.removeConfigFiles,
        cleanBanners: input.cleanBanners,
        cleanCommentWatermarks: input.cleanCommentWatermarks,
        textExts: input.textExts,
        bannerRegexes: input.bannerRegexes,
        commentRegexes: input.commentRegexes,
      })
    )
  );
  const cleanedFiles: string[] = [];
  let totalTracesRemoved = 0;
  for (const part of parts) {
    totalTracesRemoved += Number(part.totalTracesRemoved) || 0;
    const files = part.cleanedFiles;
    if (Array.isArray(files)) {
      for (const file of files) {
        if (typeof file === 'string') cleanedFiles.push(file);
      }
    }
  }
  return { plan, cleanedFiles, totalTracesRemoved };
}
