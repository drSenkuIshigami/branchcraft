import React from 'react';
import { Terminal, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { OperationResult, Theme } from '../types';

export interface LoggedCommand {
  id: string;
  timestamp: string;
  result: OperationResult;
}

interface CommandLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LoggedCommand[];
  theme: Theme;
}

export const CommandLogModal: React.FC<CommandLogModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-500" />
            <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Audit &amp; Command Log
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <div className="px-5 py-2.5 bg-zinc-100/50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 text-[11px] shrink-0">
          Every Git command executed is recorded with exact argument vectors, duration, and exit
          code. Zero shell interpreters are used.
        </div>

        {/* Log Entries */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              No Git commands recorded in this session yet.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    {log.result.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span className="text-zinc-700 dark:text-zinc-300 font-semibold">
                      Exit Code {log.result.exit_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {log.result.duration_ms} ms
                    </span>
                    <span>{log.timestamp}</span>
                  </div>
                </div>

                <div className="p-2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 text-emerald-600 dark:text-emerald-400 text-xs overflow-x-auto">
                  <span className="text-zinc-400 select-none">$ </span>
                  git {log.result.command_run.join(' ')}
                </div>

                {log.result.stderr && (
                  <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {log.result.stderr}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
