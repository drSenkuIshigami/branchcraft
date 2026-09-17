import React, { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Columns, AlignJustify, FileCode, Check } from 'lucide-react';
import type { FileDiff, Theme } from '../types';

interface DiffViewerProps {
  diff: FileDiff | null;
  loading: boolean;
  theme: Theme;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff, loading, theme }) => {
  const [sideBySide, setSideBySide] = useState(true);
  const [copied, setCopied] = useState(false);

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
          Inspect side-by-side or unified code changes line-by-line with syntax highlighting.
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

          <div className="flex items-center rounded bg-zinc-200/60 dark:bg-zinc-800 p-0.5 border border-zinc-300 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setSideBySide(true)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                sideBySide
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
              title="Side-by-Side Diff"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setSideBySide(false)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                !sideBySide
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
              title="Unified Inline Diff"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unified</span>
            </button>
          </div>
        </div>
      </div>

      {/* Monaco Diff Editor with fallback */}
      <div className="flex-1 w-full min-h-[300px] relative">
        <DiffEditor
          height="100%"
          language={getLanguage(diff.path)}
          original={diff.old_content}
          modified={diff.new_content}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            readOnly: true,
            renderSideBySide: sideBySide,
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
    </div>
  );
};
