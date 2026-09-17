import React from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { GitAvailability, Theme } from '../types';

interface GitStatusBadgeProps {
  status: GitAvailability | null;
  loading: boolean;
  theme: Theme;
}

export const GitStatusBadge: React.FC<GitStatusBadgeProps> = ({ status, loading, theme }) => {
  if (loading) {
    return (
      <div
        id="git-status-loading"
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
          theme === 'dark' ? 'bg-zinc-800/80 border-zinc-700 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-600'
        }`}
      >
        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
        <span>Checking Git environment...</span>
      </div>
    );
  }

  if (!status || !status.available) {
    return (
      <div
        id="git-status-unavailable"
        className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border border-rose-500/30 bg-rose-500/10 text-rose-500"
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Git CLI not detected in system PATH</span>
      </div>
    );
  }

  return (
    <div
      id="git-status-available"
      className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      <span>{status.version || 'Git CLI Ready'}</span>
    </div>
  );
};
