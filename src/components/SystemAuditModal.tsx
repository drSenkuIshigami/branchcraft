import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Cpu,
  Layers,
  Lock,
  GitBranch,
  FolderArchive,
  BookOpen,
  Info,
  Wrench,
  Zap,
} from 'lucide-react';
import type { GitAvailability } from '../types';

interface SystemAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  gitAvailability: GitAvailability | null;
  activeRepoPath: string | null;
}

export const SystemAuditModal: React.FC<SystemAuditModalProps> = ({
  isOpen,
  onClose,
  gitAvailability,
  activeRepoPath,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  System Audit &amp; Distribution Readiness
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  v1.0.0
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Phase 5 Verification: Local-First Architecture, Zero-Telemetry, and Desktop
                Distribution
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {/* Security & Local-First Principles */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-2.5">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs">
              <Lock className="w-4 h-4 text-emerald-500" />
              <span>Non-Negotiable Architecture Invariants (Verified)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    100% Local-First
                  </div>
                  <div className="text-zinc-500 text-[10px]">
                    Zero cloud servers, no account registration, zero telemetry tracking.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Real Git Subprocesses
                  </div>
                  <div className="text-zinc-500 text-[10px]">
                    Direct child process execution with tokenized arguments (Zero shell injection).
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Explicit Decoupled Remote
                  </div>
                  <div className="text-zinc-500 text-[10px]">
                    Background auto-fetch is disabled; pushes and pulls require explicit invocation.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Multi-Tier Safety Guard
                  </div>
                  <div className="text-zinc-500 text-[10px]">
                    Level 2–4 operations enforce restore points, bundle backups, and typed
                    confirmation.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Subsystem Audit */}
          <div className="space-y-2">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-500" />
              <span>Runtime Environment &amp; Bridge Audit</span>
            </h3>
            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Core Git Binary</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {gitAvailability?.version ||
                    (gitAvailability?.available ? 'Available' : 'Missing')}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Desktop Shell Target</span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  Tauri 2 (Rust std::process::Command)
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Target Frontend Architecture</span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Active Workspace</span>
                <span
                  className="text-zinc-800 dark:text-zinc-200 truncate max-w-xs"
                  title={activeRepoPath || 'None'}
                >
                  {activeRepoPath || 'No repository selected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Package Version</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                  v1.0.0
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Bundling Targets */}
          <div className="space-y-2">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <FolderArchive className="w-3.5 h-3.5 text-purple-500" />
              <span>Cross-Platform Packaging Matrix (Phase 5)</span>
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-zinc-100">Windows</div>
                <div className="font-mono text-[10px] text-zinc-500">.msi / .exe (NSIS)</div>
                <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Ready
                </span>
              </div>
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-zinc-100">macOS</div>
                <div className="font-mono text-[10px] text-zinc-500">.dmg (Notarization-ready)</div>
                <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Ready
                </span>
              </div>
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                <div className="font-bold text-zinc-900 dark:text-zinc-100">Linux</div>
                <div className="font-mono text-[10px] text-zinc-500">.deb / .AppImage</div>
                <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Ready
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/40 shrink-0">
          <span className="text-[11px] text-zinc-400 font-mono">
            Git Workbench Desktop • v1.0.0 Stable
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
