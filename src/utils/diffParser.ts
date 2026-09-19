import type { DiffHunk } from '../types';

/**
 * Parses raw unified diff string into individual actionable DiffHunks.
 */
export function parseDiffHunks(filePath: string, rawDiff: string): DiffHunk[] {
  if (!rawDiff || !rawDiff.trim()) return [];

  const lines = rawDiff.split('\n');
  const hunks: DiffHunk[] = [];

  let currentHunkLines: string[] = [];
  let currentHeader = '';
  let oldStart = 0;
  let oldLines = 1;
  let newStart = 0;
  let newLines = 1;
  let hunkIndex = 0;

  const headerRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

  const flushHunk = () => {
    if (!currentHeader || currentHunkLines.length === 0) return;

    // Construct a canonical patch that git apply accepts
    const cleanPath = filePath.replace(/^[ab]\//, '');
    const patchHeader = [
      `diff --git a/${cleanPath} b/${cleanPath}`,
      `--- a/${cleanPath}`,
      `+++ b/${cleanPath}`,
    ].join('\n');

    const patchBody = currentHunkLines.join('\n');
    const fullPatch = `${patchHeader}\n${currentHeader}\n${patchBody}\n`;

    hunks.push({
      id: `hunk-${hunkIndex++}`,
      header: currentHeader,
      old_start: oldStart,
      old_lines: oldLines,
      new_start: newStart,
      new_lines: newLines,
      content: patchBody,
      patch: fullPatch,
    });
  };

  for (const line of lines) {
    const match = line.match(headerRegex);
    if (match) {
      // Flush previous hunk if open
      flushHunk();
      currentHeader = line;
      currentHunkLines = [];
      oldStart = parseInt(match[1], 10) || 0;
      oldLines = match[2] !== undefined ? parseInt(match[2], 10) : 1;
      newStart = parseInt(match[3], 10) || 0;
      newLines = match[4] !== undefined ? parseInt(match[4], 10) : 1;
    } else if (currentHeader) {
      // Inside a hunk
      currentHunkLines.push(line);
    }
  }

  // Flush the final hunk
  flushHunk();

  return hunks;
}
