import React, { useState, useMemo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  Columns,
  AlignJustify,
  FileCode,
  Check,
  Layers,
  Plus,
  Minus,
  Trash2,
  Code2,
} from 'lucide-react';
import type { FileDiff, Theme } from '../types';
import { parseDiffHunks } from '../utils/diffParser';

interface DiffViewerProps {
  diff: FileDiff | null;
  loading: boolean;
  theme: Theme;
  isStaged?: boolean;
  onStageHunk?: (patch: string) => Promise<void>;
  onUnstageHunk?: (patch: string) => Promise<void>;
  onDiscardHunk?: (patch: string) => Promise<void>;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  loading,
  theme,
  isStaged = false,
  onStageHunk,
  onUnstageHunk,
  onDiscardHunk,
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified' | 'hunks'>('split');
  const [copied, setCopied] = useState(false);
  const [hunkActionLoading, setHunkActionLoading] = useState<string | null>(null);
  const [confirmDiscardHunkId, setConfirmDiscardHunkId] = useState<string | null>(null);

  const hunks = useMemo(() => {
    if (!diff?.raw_diff) return [];
    return parseDiffHunks(diff.path, diff.raw_diff);
  }, [diff?.path, diff?.raw_diff]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs">Generating file diff...</span>
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-zinc-400 p-6 text-center">
        <FileCode className="w-8 h-8 stroke-1 text-zinc-500 mb-2" />
        <p className="text-sm font-medium">Select a modified file to inspect diff</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
          Inspect side-by-side or unified code changes line-by-line with interactive hunk controls.
        </p>
      </div>
    );
  }

  const handleCopyRaw = () => {
    if (diff?.raw_diff) {
      navigator.clipboard.writeText(diff.raw_diff);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleHunkStage = async (hunkId: string, patch: string) => {
    if (!onStageHunk) return;
    setHunkActionLoading(hunkId);
    try {
      await onStageHunk(patch);
    } finally {
      setHunkActionLoading(null);
    }
  };

  const handleHunkUnstage = async (hunkId: string, patch: string) => {
    if (!onUnstageHunk) return;
    setHunkActionLoading(hunkId);
    try {
      await onUnstageHunk(patch);
    } finally {
      setHunkActionLoading(null);
    }
  };

  const handleHunkDiscard = async (hunkId: string, patch: string) => {
    if (!onDiscardHunk) return;
    setHunkActionLoading(hunkId);
    try {
      await onDiscardHunk(patch);
      setConfirmDiscardHunkId(null);
    } finally {
      setHunkActionLoading(null);
    }
  };

  // Determine file language extension
  const getLanguage = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'rs':
        return 'rust';
      case 'py':
        return 'python';
      default:
        return 'plaintext';
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      {/* Diff Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs shrink-0">
        <div className="flex items-center gap-2 font-mono text-zinc-700 dark:text-zinc-300 truncate">
          <FileCode className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="font-semibold truncate">{diff.path}</span>
          {hunks.length > 0 && (
            <span className="hidden sm:inline px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {hunks.length} hunk{hunks.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyRaw}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Copy patch diff"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : null}
            <span>{copied ? 'Copied' : 'Copy Patch'}</span>
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center rounded bg-zinc-200/60 dark:bg-zinc-800 p-0.5 border border-zinc-300 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
              title="Side-by-Side Split View"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                viewMode === 'unified'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
              title="Unified Inline View"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unified</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('hunks')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                viewMode === 'hunks'
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
              title="Interactive Hunk Staging / Discarding"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hunks ({hunks.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'hunks' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-950/40">
          {hunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400">
              <Code2 className="w-8 h-8 stroke-1 text-zinc-500 mb-2" />
              <p className="text-xs">No discrete hunks available for this file.</p>
            </div>
          ) : (
            hunks.map((hunk, idx) => {
              const isLoading = hunkActionLoading === hunk.id;
              const isConfirmingDiscard = confirmDiscardHunkId === hunk.id;

              return (
                <div
                  key={hunk.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm text-xs"
                >
                  {/* Hunk Header */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
                        Hunk #{idx + 1}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500 px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700">
                        {hunk.header}
                      </span>
                    </div>

                    {/* Hunk Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {isStaged ? (
                        onUnstageHunk && (
                          <button
                            type="button"
                            onClick={() => handleHunkUnstage(hunk.id, hunk.patch)}
                            disabled={isLoading}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-[11px] font-medium transition-colors cursor-pointer"
                            title="Unstage this specific hunk from index (git apply --cached --reverse)"
                          >
                            <Minus className="w-3 h-3" />
                            <span>{isLoading ? 'Unstaging...' : 'Unstage Hunk'}</span>
                          </button>
                        )
                      ) : (
                        <div className="flex items-center gap-1">
                          {onDiscardHunk && (
                            isConfirmingDiscard ? (
                              <div className="flex items-center gap-1 bg-rose-500/10 p-0.5 rounded text-[10px]">
                                <span className="text-rose-600 dark:text-rose-400 px-1">Discard?</span>
                                <button
                                  type="button"
                                  onClick={() => handleHunkDiscard(hunk.id, hunk.patch)}
                                  disabled={isLoading}
                                  className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-medium hover:bg-rose-700"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDiscardHunkId(null)}
                                  className="px-1 py-0.2 rounded text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDiscardHunkId(hunk.id)}
                                disabled={isLoading}
                                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-500/10 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] transition-colors cursor-pointer"
                                title="Discard this hunk's changes from working tree (git apply --reverse)"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Discard</span>
                              </button>
                            )
                          )}

                          {onStageHunk && (
                            <button
                              type="button"
                              onClick={() => handleHunkStage(hunk.id, hunk.patch)}
                              disabled={isLoading}
                              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-xs"
                              title="Stage this specific hunk into index (git apply --cached)"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{isLoading ? 'Staging...' : 'Stage Hunk'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hunk Lines */}
                  <div className="p-2 font-mono text-[11px] overflow-x-auto leading-relaxed bg-zinc-50/50 dark:bg-zinc-950">
                    {hunk.content.split('\n').map((line, lineIdx) => {
                      const isAdd = line.startsWith('+');
                      const isDel = line.startsWith('-');
                      return (
                        <div
                          key={lineIdx}
                          className={`px-1 rounded-xs whitespace-pre ${
                            isAdd
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : isDel
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Monaco Diff Editor */
        <div className="flex-1 w-full min-h-[300px] relative">
          <DiffEditor
            height="100%"
            language={getLanguage(diff.path)}
            original={diff.old_content}
            modified={diff.new_content}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            options={{
              readOnly: true,
              renderSideBySide: viewMode === 'split',
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
            loading={
              <div className="p-4 text-xs font-mono whitespace-pre overflow-auto h-full text-zinc-300 bg-zinc-950">
                {diff.raw_diff || 'No diff content'}
              </div>
            }
          />
        </div>
      )}
    </div>
  );
};
