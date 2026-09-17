import React from 'react';
import {
  GitCommit,
  User,
  Calendar,
  Copy,
  Check,
  Plus,
  Minus,
  FileText,
  FilePlus,
  FileMinus,
  FileDiff as FileDiffIcon,
  Tag,
  GitBranch,
} from 'lucide-react';
import type { CommitDetail, CommitDetailFile, Theme } from '../types';

interface CommitDetailPanelProps {
  detail: CommitDetail | null;
  loading: boolean;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  theme: Theme;
}

export const CommitDetailPanel: React.FC<CommitDetailPanelProps> = ({
  detail,
  loading,
  selectedFile,
  onSelectFile,
}) => {
  const [copiedSha, setCopiedSha] = React.useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
        <span className="text-xs">Loading commit details...</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-zinc-400 p-6 text-center">
        <GitCommit className="w-8 h-8 text-zinc-500 mb-2 stroke-1" />
        <p className="text-sm font-medium">Select a commit to view details</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
          View commit metadata, parent links, modified file lists, and diff statistics.
        </p>
      </div>
    );
  }

  const { commit, files, stats } = detail;

  const handleCopySha = () => {
    navigator.clipboard.writeText(commit.sha);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 1500);
  };

  const renderFileIcon = (file: CommitDetailFile) => {
    switch (file.status) {
      case 'Added':
        return <FilePlus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'Deleted':
        return <FileMinus className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      case 'Renamed':
      case 'Copied':
        return <FileDiffIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Header Info */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 leading-snug">
            {commit.subject}
          </h3>
          <button
            type="button"
            onClick={handleCopySha}
            className="flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0 transition-colors"
            title="Copy full SHA"
          >
            {copiedSha ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{commit.sha.substring(0, 8)}</span>
          </button>
        </div>

        {commit.body && (
          <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-mono text-[11px] mb-2 pl-2 border-l-2 border-blue-500/40">
            {commit.body}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] text-zinc-500">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-zinc-400" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {commit.author_name}
            </span>
            <span className="text-[10px] opacity-75">&lt;{commit.author_email}&gt;</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-zinc-400" />
            <span>{new Date(commit.author_date).toLocaleString()}</span>
          </div>
        </div>

        {/* Ref badges if any */}
        {commit.refs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {commit.refs.map((r, i) => {
              const isTag = r.startsWith('tag: ');
              const isHead = r.includes('HEAD');
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] border ${
                    isTag
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : isHead
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {isTag ? <Tag className="w-2.5 h-2.5" /> : <GitBranch className="w-2.5 h-2.5" />}
                  <span>{r.replace('tag: ', '')}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Changes summary */}
        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80 text-[11px]">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {stats.files_changed} {stats.files_changed === 1 ? 'file' : 'files'} changed
          </span>
          <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-mono">
            <Plus className="w-3 h-3" />
            {stats.insertions}
          </span>
          <span className="flex items-center text-rose-600 dark:text-rose-400 font-mono">
            <Minus className="w-3 h-3" />
            {stats.deletions}
          </span>
        </div>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {files.map((file) => {
          const isSelected = selectedFile === file.path;
          return (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelectFile(file.path)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                isSelected
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                {renderFileIcon(file)}
                <span className="truncate font-mono text-[11px]">{file.path}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                {file.additions > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
                )}
                {file.deletions > 0 && (
                  <span className="text-rose-600 dark:text-rose-400">-{file.deletions}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
