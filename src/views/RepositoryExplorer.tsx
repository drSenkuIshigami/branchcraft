import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Terminal,
  FolderOpen,
  SplitSquareVertical,
  AlertCircle,
  FolderGit2,
} from 'lucide-react';
import type { BranchInfo, CommitDetail, CommitInfo, FileDiff, StatusInfo, Theme } from '../types';
import {
  getBranches,
  getCommitDetail,
  getCommitGraph,
  getFileDiff,
  getStatus,
  openRepository,
  openSampleRepository,
} from '../ipc';
import { Sidebar } from '../components/Sidebar';
import { CommitList } from '../components/CommitList';
import { CommitDetailPanel } from '../components/CommitDetailPanel';
import { DiffViewer } from '../components/DiffViewer';
import { WorkingTreePanel } from '../components/WorkingTreePanel';
import { OpenRepoModal } from '../components/OpenRepoModal';
import { CommandLogModal, type LoggedCommand } from '../components/CommandLogModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { GitStatusBadge } from '../components/GitStatusBadge';

interface RepositoryExplorerProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export const RepositoryExplorer: React.FC<RepositoryExplorerProps> = ({ theme, onToggleTheme }) => {
  const [repoPath, setRepoPath] = useState<string | null>(() => {
    return localStorage.getItem('git_workbench_repo_path');
  });
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<CommitDetail | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);

  const [selectedView, setSelectedView] = useState<'graph' | 'working-tree'>('graph');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isCommandLogOpen, setIsCommandLogOpen] = useState(false);
  const [commandLogs, setCommandLogs] = useState<LoggedCommand[]>([]);

  const recordCommand = useCallback(
    (commandRun: string[], durationMs: number, success = true, exitCode = 0, stderr = '') => {
      setCommandLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          result: {
            success,
            stdout: '',
            stderr,
            exit_code: exitCode,
            command_run: commandRun,
            duration_ms: durationMs,
          },
        },
        ...prev.slice(0, 49), // Keep latest 50
      ]);
    },
    []
  );

  const loadRepositoryData = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      const start = performance.now();

      try {
        const newStatus = await getStatus(path);
        recordCommand(
          ['status', '--porcelain=v2', '--branch'],
          Math.round(performance.now() - start)
        );
        setStatus(newStatus);
        setRepoPath(newStatus.root_path);
        localStorage.setItem('git_workbench_repo_path', newStatus.root_path);

        const branchStart = performance.now();
        const newBranches = await getBranches(newStatus.root_path);
        recordCommand(
          ['for-each-ref', 'refs/heads/', 'refs/remotes/'],
          Math.round(performance.now() - branchStart)
        );
        setBranches(newBranches);

        const logStart = performance.now();
        const newCommits = await getCommitGraph(newStatus.root_path, 100);
        recordCommand(
          ['log', '--all', '--topo-order', '-n', '100'],
          Math.round(performance.now() - logStart)
        );
        setCommits(newCommits);

        if (newCommits.length > 0) {
          setSelectedSha(newCommits[0].sha);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        recordCommand(['open_repository', path], 0, false, 1, msg);
      } finally {
        setLoading(false);
      }
    },
    [recordCommand]
  );

  // Load commit details whenever selectedSha changes
  useEffect(() => {
    if (!repoPath || !selectedSha) return;

    let isMounted = true;
    setDetailLoading(true);
    const start = performance.now();

    getCommitDetail(repoPath, selectedSha)
      .then((detail) => {
        if (!isMounted) return;
        recordCommand(
          ['show', '--stat', selectedSha.substring(0, 8)],
          Math.round(performance.now() - start)
        );
        setCommitDetail(detail);

        // Auto-select first changed file for diff preview
        if (detail.files.length > 0) {
          setSelectedFile(detail.files[0].path);
        } else {
          setSelectedFile(null);
          setDiff(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        recordCommand(['show', selectedSha], 0, false, 1, String(err));
      })
      .finally(() => {
        if (isMounted) setDetailLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoPath, selectedSha, recordCommand]);

  // Load diff whenever selectedFile or selectedSha/view changes
  useEffect(() => {
    if (!repoPath || !selectedFile) {
      setDiff(null);
      return;
    }

    let isMounted = true;
    setDiffLoading(true);
    const start = performance.now();

    const rev = selectedView === 'graph' ? selectedSha : null;
    getFileDiff(repoPath, selectedFile, rev)
      .then((d) => {
        if (!isMounted) return;
        recordCommand(
          ['diff', rev ? `${rev}^..${rev}` : 'HEAD', '--', selectedFile],
          Math.round(performance.now() - start)
        );
        setDiff(d);
      })
      .catch((err) => {
        if (!isMounted) return;
        recordCommand(['diff', selectedFile], 0, false, 1, String(err));
      })
      .finally(() => {
        if (isMounted) setDiffLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoPath, selectedFile, selectedSha, selectedView, recordCommand]);

  // Initialize: load existing or auto-open sample sandbox repository
  useEffect(() => {
    if (repoPath) {
      loadRepositoryData(repoPath);
    } else {
      // Auto-open sample repository for instantaneous full experience
      handleOpenSample();
    }
  }, []);

  const handleOpenPath = async (path: string) => {
    await openRepository(path);
    await loadRepositoryData(path);
  };

  const handleOpenSample = async () => {
    setLoading(true);
    try {
      const res = await openSampleRepository();
      setRepoPath(res.path);
      localStorage.setItem('git_workbench_repo_path', res.path);
      await loadRepositoryData(res.path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (repoPath) {
      loadRepositoryData(repoPath);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Top Application Bar */}
      <header className="h-11 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 px-3 flex items-center justify-between shrink-0 select-none">
        {/* Left: App Brand & Current Branch */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
            <span className="hidden sm:inline">Git Workbench</span>
          </div>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

          {/* Repo button / selector */}
          <button
            type="button"
            onClick={() => setIsRepoModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 transition-colors truncate max-w-xs"
            title="Switch repository"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">
              {status ? status.root_path.split('/').pop() : 'Open Repository...'}
            </span>
          </button>
        </div>

        {/* Right: Controls, Audit Log, Git Status, Theme */}
        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
            title="Refresh repository (re-run status, branches, commits)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>

          {/* Audit & Command Log */}
          <button
            type="button"
            onClick={() => setIsCommandLogOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-200/60 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-mono text-zinc-700 dark:text-zinc-300 transition-colors"
            title="View executed Git command log"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden md:inline">Command Log</span>
            <span className="px-1 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px]">
              {commandLogs.length}
            </span>
          </button>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

          {/* Non-blocking Git CLI status badge */}
          <GitStatusBadge />

          {/* Theme switcher */}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      {/* Error banner if repository failed to load */}
      {error && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsRepoModalOpen(true)}
            className="font-medium underline ml-2 shrink-0 hover:text-rose-700 dark:hover:text-rose-300"
          >
            Switch Repository
          </button>
        </div>
      )}

      {/* Main Workspace Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          status={status}
          branches={branches}
          selectedView={selectedView}
          onSelectView={setSelectedView}
          onOpenRepoDialog={() => setIsRepoModalOpen(true)}
          theme={theme}
        />

        {/* Center & Right Work Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-zinc-50/20 dark:bg-zinc-950">
          {selectedView === 'working-tree' ? (
            /* Working tree mode: File status on top/left, Monaco diff on right/bottom */
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              <div className="lg:col-span-4 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden h-full">
                <WorkingTreePanel
                  status={status}
                  selectedFile={selectedFile}
                  onSelectFile={setSelectedFile}
                  onRefresh={handleRefresh}
                  loading={loading}
                  theme={theme}
                />
              </div>
              <div className="lg:col-span-8 p-3 overflow-hidden h-full">
                <DiffViewer diff={diff} loading={diffLoading} theme={theme} />
              </div>
            </div>
          ) : (
            /* Graph mode: Commit Graph on top, Commit details & Monaco diff below */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top half: Topological Commit Graph List */}
              <div className="h-[48%] border-b border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <CommitList
                  commits={commits}
                  selectedSha={selectedSha}
                  onSelectCommit={setSelectedSha}
                  loading={loading}
                  theme={theme}
                />
              </div>

              {/* Bottom half: Selected Commit Details & Diff Inspector */}
              <div className="h-[52%] grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/20">
                {/* Left 4 cols: Commit metadata and changed files list */}
                <div className="lg:col-span-5 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden h-full">
                  <CommitDetailPanel
                    detail={commitDetail}
                    loading={detailLoading}
                    selectedFile={selectedFile}
                    onSelectFile={setSelectedFile}
                    theme={theme}
                  />
                </div>

                {/* Right 7 cols: Monaco Diff Editor */}
                <div className="lg:col-span-7 p-2.5 overflow-hidden h-full">
                  <DiffViewer diff={diff} loading={diffLoading} theme={theme} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Open Repository Modal */}
      <OpenRepoModal
        isOpen={isRepoModalOpen}
        onClose={() => setIsRepoModalOpen(false)}
        onOpenPath={handleOpenPath}
        onOpenSample={handleOpenSample}
        theme={theme}
      />

      {/* Command & Audit Log Modal */}
      <CommandLogModal
        isOpen={isCommandLogOpen}
        onClose={() => setIsCommandLogOpen(false)}
        logs={commandLogs}
        theme={theme}
      />
    </div>
  );
};
