import React from 'react';
import { GitBranch, Shield, Terminal, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import type { GitAvailability, Theme } from '../types';
import { GitStatusBadge } from '../components/GitStatusBadge';
import { ThemeToggle } from '../components/ThemeToggle';

interface Phase0ShellProps {
  gitStatus: GitAvailability | null;
  loading: boolean;
  theme: Theme;
  onToggleTheme: () => void;
}

export const Phase0Shell: React.FC<Phase0ShellProps> = ({
  gitStatus,
  loading,
  theme,
  onToggleTheme,
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      id="app-root-shell"
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      }`}
    >
      {/* Top Application Bar */}
      <header
        id="app-header"
        className={`h-14 border-b px-5 flex items-center justify-between select-none ${
          isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/90 border-zinc-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            id="app-logo-badge"
            className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-semibold shadow-sm"
          >
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Git Workbench</h1>
            <p className="text-[11px] text-zinc-500 leading-none">Native Desktop Shell</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GitStatusBadge status={gitStatus} loading={loading} theme={theme} />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      {/* Main Empty State Content */}
      <main
        id="main-stage"
        className="flex-1 flex flex-col items-center justify-center p-6 text-center"
      >
        <div
          id="phase0-empty-card"
          className={`max-w-xl w-full p-8 rounded-2xl border text-left shadow-sm ${
            isDark ? 'bg-zinc-900/60 border-zinc-800/90' : 'bg-white border-zinc-200'
          }`}
        >
          {/* Header section of card */}
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Git Workbench</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 mt-1">
                Phase 0 — Application Shell Ready
              </span>
            </div>
          </div>

          <p
            className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
          >
            The foundational desktop architecture and security framework have been established.
            Repository features will be introduced in Phase 1.
          </p>

          {/* Git Environment Status Box */}
          <div
            id="git-environment-box"
            className={`p-4 rounded-xl border mb-6 ${
              gitStatus?.available
                ? isDark
                  ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : isDark
                  ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-3">
              {gitStatus?.available ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <p className="font-medium mb-0.5">
                  {gitStatus?.available
                    ? 'System Git Executable Verified'
                    : 'System Git Dependency Notice'}
                </p>
                <p className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                  {gitStatus?.available
                    ? `Detected runtime: ${gitStatus.version}. In accordance with local-first architectural standards, all Git operations execute the user-installed binary directly.`
                    : gitStatus?.error ||
                      'Git was not found in your system PATH. Please ensure git is installed locally and accessible.'}
                </p>
              </div>
            </div>
          </div>

          {/* Architectural Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div
              className={`p-3 rounded-lg border text-xs ${
                isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2 font-medium mb-1 text-blue-500">
                <Shield className="w-3.5 h-3.5" />
                <span>5-Tier Risk Engine</span>
              </div>
              <p className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                Strict allowlist policy preventing shell injection or unverified destructive
                execution.
              </p>
            </div>

            <div
              className={`p-3 rounded-lg border text-xs ${
                isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2 font-medium mb-1 text-emerald-500">
                <Terminal className="w-3.5 h-3.5" />
                <span>Real Git CLI Adapter</span>
              </div>
              <p className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                Full compatibility with user SSH keys, credential managers, hooks, and signing.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <footer
        id="app-footer"
        className={`h-7 border-t px-4 flex items-center justify-between text-[11px] select-none ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-500'
            : 'bg-white border-zinc-200 text-zinc-500'
        }`}
      >
        <div className="flex items-center gap-3">
          <span>Git Workbench v0.1.0</span>
          <span>•</span>
          <span>Phase 0: Scaffold & Architecture</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Local-first architecture</span>
        </div>
      </footer>
    </div>
  );
};
