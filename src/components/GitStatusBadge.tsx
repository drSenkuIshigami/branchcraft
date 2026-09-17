import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { GitAvailability, Theme } from '../types';
import { getGitAvailability } from '../ipc';

interface GitStatusBadgeProps {
  status?: GitAvailability | null;
  loading?: boolean;
  theme?: Theme;
}

export const GitStatusBadge: React.FC<GitStatusBadgeProps> = ({
  status: propStatus,
  loading: propLoading,
  theme = 'dark',
}) => {
  const [internalStatus, setInternalStatus] = useState<GitAvailability | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(true);

  useEffect(() => {
    if (propStatus !== undefined) return;
    let mounted = true;
    getGitAvailability()
      .then((s) => {
        if (mounted) setInternalStatus(s);
      })
      .catch((err) => {
        if (mounted) {
          setInternalStatus({
            available: false,
            version: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
      .finally(() => {
        if (mounted) setInternalLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [propStatus]);

  const status = propStatus !== undefined ? propStatus : internalStatus;
  const loading = propLoading !== undefined ? propLoading : internalLoading;

  if (loading) {
    return (
      <div
        id="git-status-loading"
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
          theme === 'dark'
            ? 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
            : 'bg-zinc-100 border-zinc-200 text-zinc-600'
        }`}
      >
        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
        <span className="text-[11px]">Checking Git...</span>
      </div>
    );
  }

  if (!status || !status.available) {
    return (
      <div
        id="git-status-unavailable"
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-rose-500/30 bg-rose-500/10 text-rose-500"
        title={status?.error || 'Git executable not detected in system PATH'}
      >
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span className="text-[11px]">Git Not Found</span>
      </div>
    );
  }

  return (
    <div
      id="git-status-available"
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      title={status.version || 'Git CLI Ready'}
    >
      <CheckCircle2 className="w-3 h-3 shrink-0" />
      <span className="text-[11px]">Git CLI Ready</span>
      {status.version && (
        <span className="text-[10px] opacity-75 hidden sm:inline">
          ({status.version.replace(/^git version /i, 'v')})
        </span>
      )}
    </div>
  );
};
