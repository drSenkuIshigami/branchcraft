const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');

function inside(root, full) {
  const rootPath = path.resolve(root);
  const fullPath = path.resolve(full);
  const rootCmp = process.platform === 'win32' ? rootPath.toLowerCase() : rootPath;
  const fullCmp = process.platform === 'win32' ? fullPath.toLowerCase() : fullPath;
  return fullCmp === rootCmp || fullCmp.startsWith(rootCmp + path.sep);
}

function compile(source, flags) {
  return new RegExp(source, flags);
}

function replaceFlags(data) {
  return data.isCaseSensitive ? 'g' : 'gi';
}

function replacePattern(data) {
  const flags = replaceFlags(data);
  if (data.isRegex || data.hasWildcard) {
    return compile(data.searchExpr, flags);
  }
  const escaped = data.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = data.isWholeWord ? `\\b${escaped}\\b` : escaped;
  return compile(source, flags);
}

function replaceJob(data) {
  let replacedFilesCount = 0;
  let totalReplacementsCount = 0;
  const modifiedFiles = [];
  for (const relPath of data.filePaths) {
    const fullPath = path.resolve(data.rootPath, relPath);
    if (!inside(data.rootPath, fullPath) || !fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      let fileModified = false;
      let fileReplacements = 0;
      const newLines = lines.map((line, idx) => {
        const lineNum = idx + 1;
        if (data.lineNumbers && data.lineNumbers.length > 0 && !data.lineNumbers.includes(lineNum)) {
          return line;
        }
        const testRx = replacePattern(data);
        if (!testRx.test(line)) return line;
        const matches = line.match(replacePattern(data)) || [];
        fileReplacements += matches.length;
        fileModified = true;
        return line.replace(replacePattern(data), data.replaceText);
      });
      if (fileModified) {
        fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
        replacedFilesCount += 1;
        totalReplacementsCount += fileReplacements;
        modifiedFiles.push(relPath);
      }
    } catch {
      // Skip a file that cannot be read or written.
    }
  }
  return { replacedFilesCount, totalReplacementsCount, modifiedFiles };
}

function cleanJob(data) {
  const cleanedFiles = [];
  let totalTracesRemoved = 0;
  for (const relPath of data.filePaths) {
    const fullPath = path.resolve(data.rootPath, relPath);
    if (!inside(data.rootPath, fullPath) || !fs.existsSync(fullPath)) continue;
    const baseName = path.basename(relPath).toLowerCase();
    if (data.removeConfigFiles) {
      if (
        baseName === '.cursorrules' ||
        relPath.startsWith('.cursor/') ||
        baseName === '.windsurfrules' ||
        baseName === 'copilot-instructions.md'
      ) {
        try {
          fs.unlinkSync(fullPath);
          totalTracesRemoved += 1;
          cleanedFiles.push(`${relPath} (deleted file)`);
          continue;
        } catch {
          // ignore
        }
      }
    }
    const ext = path.extname(relPath).toLowerCase();
    if (!data.textExts.includes(ext) && !baseName.endsWith('rc') && !baseName.startsWith('.')) {
      continue;
    }
    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      if (data.cleanBanners) {
        for (const spec of data.bannerRegexes) {
          if (compile(spec.source, spec.flags).test(content)) {
            content = content.replace(compile(spec.source, spec.flags), '');
            modified = true;
            totalTracesRemoved += 1;
          }
        }
      }
      if (data.cleanCommentWatermarks) {
        for (const spec of data.commentRegexes) {
          if (compile(spec.source, spec.flags).test(content)) {
            content = content.replace(compile(spec.source, spec.flags), '');
            modified = true;
            totalTracesRemoved += 1;
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
  return { cleanedFiles, totalTracesRemoved };
}

try {
  const result = workerData.job === 'replace' ? replaceJob(workerData) : cleanJob(workerData);
  parentPort.postMessage({ ok: true, result });
} catch (err) {
  parentPort.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
}
