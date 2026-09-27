import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Replace,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
  Check,
  RotateCw,
  GitBranch,
  FolderGit2,
  FileCode,
  History,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  SlidersHorizontal,
  FileText,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import type {
  BranchInfo,
  SearchQueryOptions,
  SearchResponse,
  SearchFileResult,
  ReplaceResponse,
  Theme,
} from '../types';
import { searchRepository, replaceInFiles } from '../ipc';

interface SearchAndReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string;
  branches: BranchInfo[];
  theme: Theme;
  onSelectCommit?: (sha: string) => void;
  onSelectFile?: (filePath: string) => void;
  onRefresh?: () => void;
}

export const SearchAndReplaceModal: React.FC<SearchAndReplaceModalProps> = ({
  isOpen,
  onClose,
  repoPath,
  branches,
  theme: _theme,
  onSelectCommit,
  onSelectFile,
  onRefresh,
}) => {
  // Search query inputs
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWord, setIsWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  // Scope: 'working_tree' | 'selected_branches' | 'all_commits'
  const [searchScope, setSearchScope] = useState<'working_tree' | 'selected_branches' | 'all_commits'>('working_tree');

  // Branch filters
  const [branchPattern, setBranchPattern] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [showBranchSelector, setShowBranchSelector] = useState(false);

  // File filters
  const [fileFilter, setFileFilter] = useState('');
  const [pathPrefix, setPathPrefix] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Results & status
  const [isSearching, setIsSearching] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Collapsed files map
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

  // Auto-init selected branches to current HEAD or main
  useEffect(() => {
    if (branches && branches.length > 0 && selectedBranches.length === 0) {
      const head = branches.find((b) => b.is_head);
      if (head) {
        setSelectedBranches([head.name]);
      } else {
        setSelectedBranches([branches[0].name]);
      }
    }
  }, [branches, selectedBranches.length]);

  // Keyboard shortcut listener (Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Execute Search
  const handleExecuteSearch = useCallback(async () => {
    if (!query.trim() || !repoPath) return;

    setIsSearching(true);
    setError(null);
    setSuccessToast(null);

    const options: SearchQueryOptions = {
      query: query.trim(),
      replaceText: replaceText,
      isCaseSensitive,
      isWholeWord,
      isRegex,
      searchScope,
      branches: searchScope === 'selected_branches' ? selectedBranches : undefined,
      branchPattern: searchScope === 'selected_branches' && branchPattern.trim() ? branchPattern.trim() : undefined,
      fileFilter: fileFilter.trim() || undefined,
      pathPrefix: pathPrefix.trim() || undefined,
      maxResults: 500,
    };

    try {
      const res = await searchRepository(repoPath, options);
      setSearchResult(res);
      // Expand all files initially
      setCollapsedFiles({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  }, [
    query,
    repoPath,
    replaceText,
    isCaseSensitive,
    isWholeWord,
    isRegex,
    searchScope,
    selectedBranches,
    branchPattern,
    fileFilter,
    pathPrefix,
  ]);

  // Execute Replace in specific file or across all matching files
  const handleExecuteReplace = async (targetFiles?: string[], lineNumbers?: number[]) => {
    if (!query.trim() || !repoPath || replaceText === undefined) return;

    const filesToModify = targetFiles || (searchResult ? searchResult.results.map((r) => r.file_path) : []);
    if (filesToModify.length === 0) return;

    setIsReplacing(true);
    setError(null);
    setSuccessToast(null);

    try {
      const res: ReplaceResponse = await replaceInFiles(repoPath, {
        repoPath,
        filePaths: filesToModify,
        query: query.trim(),
        replaceText,
        isCaseSensitive,
        isWholeWord,
        isRegex,
        lineNumbers,
      });

      if (res.success) {
        setSuccessToast(
          `Replaced ${res.total_replacements_count} occurrence(s) across ${res.replaced_files_count} file(s).`
        );
        // Refresh working tree in background
        if (onRefresh) {
          onRefresh();
        }
        // Re-run search to update matches
        await handleExecuteSearch();
      } else {
        setError(res.error || 'Replace failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsReplacing(false);
    }
  };

  const toggleFileCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
  };

  // Branch list filtered by branchPattern
  const filteredBranches = useMemo(() => {
    if (!branchPattern.trim()) return branches;
    const pat = branchPattern.trim().toLowerCase();
    return branches.filter((b) => {
      const name = b.name.toLowerCase();
      if (pat.startsWith('*') && pat.endsWith('*')) {
        return name.includes(pat.slice(1, -1));
      }
      if (pat.startsWith('*')) {
        return name.endsWith(pat.slice(1));
      }
      if (pat.endsWith('*')) {
        return name.startsWith(pat.slice(0, -1));
      }
      return name.includes(pat);
    });
  }, [branches, branchPattern]);

  const handleToggleBranch = (name: string) => {
    setSelectedBranches((prev) =>
      prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]
    );
  };

  const handleSelectAllBranches = () => {
    setSelectedBranches(filteredBranches.map((b) => b.name));
  };

  const handleDeselectAllBranches = () => {
    setSelectedBranches([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-hidden">
      <div className="w-full max-w-5xl h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Global Search &amp; Replace</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-medium">
                  Repository Finder
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Find text, wildcards, or regex across Working Tree, all branches, and commit history.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded">
              Esc to close
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close Search & Replace"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Inputs & Control Bar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 space-y-3 shrink-0">
          {/* Row 1: Search & Replace text inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteSearch();
                }}
                placeholder="Find: code, *code*, *.com, function..."
                className="w-full pl-9 pr-24 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-xs"
                autoFocus
              />
              {/* Option toggles inside Search field */}
              <div className="absolute right-2 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                    isCaseSensitive
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Match Case (Case Sensitive)"
                >
                  Aa
                </button>
                <button
                  type="button"
                  onClick={() => setIsWholeWord(!isWholeWord)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                    isWholeWord
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Match Whole Word"
                >
                  \b
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegex(!isRegex)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                    isRegex
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Use Regular Expression (or wildcards like *code*)"
                >
                  .*
                </button>
              </div>
            </div>

            {/* Replace Input */}
            <div className="relative flex items-center">
              <Replace className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with (e.g. newCode, example.org)..."
                disabled={searchScope !== 'working_tree'}
                className="w-full pl-9 pr-24 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-xs disabled:opacity-50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/40"
              />
              {/* Replace Action Buttons */}
              {searchScope === 'working_tree' && searchResult && searchResult.total_matches > 0 && (
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleExecuteReplace()}
                    disabled={isReplacing || !replaceText}
                    className="px-2 py-0.5 rounded text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                    title="Replace all matching occurrences in all files"
                  >
                    {isReplacing ? 'Replacing...' : 'Replace All'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Scope Tabs & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            {/* Scope Selector */}
            <div className="flex items-center gap-1 bg-zinc-200/70 dark:bg-zinc-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setSearchScope('working_tree')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  searchScope === 'working_tree'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Working Tree (Find &amp; Replace)</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchScope('selected_branches')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  searchScope === 'selected_branches'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>All Branches / Specific</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchScope('all_commits')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  searchScope === 'all_commits'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>All Commits (History Pickaxe)</span>
              </button>
            </div>

            {/* Filter Toggle & Find Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  showAdvancedFilters || fileFilter || pathPrefix || branchPattern
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                    : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters {fileFilter || pathPrefix || branchPattern ? '(Active)' : ''}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleExecuteSearch}
                disabled={isSearching || !query.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Find All</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Advanced Filters (Branch wildcard, file types, directory prefix) */}
          {showAdvancedFilters && (
            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-100/60 dark:bg-zinc-800/40 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-100 text-xs">
              {/* Branch Pattern Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>Branch Filter (Pattern):</span>
                  <span className="text-[10px] text-zinc-400 font-mono">*main, dev*, feat*</span>
                </label>
                <input
                  type="text"
                  value={branchPattern}
                  onChange={(e) => setBranchPattern(e.target.value)}
                  placeholder="e.g. *main (branches ending with main)"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* File / Extension Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>File Types / Globs:</span>
                  <span className="text-[10px] text-zinc-400 font-mono">*.ts, *.tsx, !*.lock</span>
                </label>
                <input
                  type="text"
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  placeholder="e.g. *.ts, *.tsx, *.json, !*.min.js"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Path / Directory Prefix */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>Directory / Path:</span>
                  <span className="text-[10px] text-zinc-400 font-mono">src/, components/</span>
                </label>
                <input
                  type="text"
                  value={pathPrefix}
                  onChange={(e) => setPathPrefix(e.target.value)}
                  placeholder="e.g. src/ or docs/"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Branch Checkboxes Popover toggle if in branches mode */}
              {searchScope === 'selected_branches' && (
                <div className="sm:col-span-3 pt-1 border-t border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">
                      Selected Branches: <strong className="text-zinc-800 dark:text-zinc-200">{selectedBranches.length}</strong> of {branches.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBranchSelector(!showBranchSelector)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 underline cursor-pointer"
                    >
                      {showBranchSelector ? 'Hide branch checklist' : 'Choose branches with checkboxes...'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllBranches}
                      className="text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-blue-500 cursor-pointer"
                    >
                      Select All Filtered
                    </button>
                    <span className="text-zinc-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllBranches}
                      className="text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-blue-500 cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>

                  {showBranchSelector && (
                    <div className="w-full max-h-36 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {filteredBranches.map((b) => (
                        <label
                          key={b.name}
                          className="flex items-center gap-1.5 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-xs truncate"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBranches.includes(b.name)}
                            onChange={() => handleToggleBranch(b.name)}
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-mono text-[11px] truncate" title={b.name}>
                            {b.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mx-5 my-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successToast && (
          <div className="mx-5 my-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Results Area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-zinc-50/20 dark:bg-zinc-950">
          {/* Results Summary Bar */}
          {searchResult && (
            <div className="px-5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/40 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between shrink-0 font-mono">
              <div className="flex items-center gap-3">
                <span>
                  Found <strong className="text-zinc-800 dark:text-zinc-100">{searchResult.total_matches}</strong> matches across{' '}
                  <strong className="text-zinc-800 dark:text-zinc-100">{searchResult.files_matched}</strong> files
                </span>
                {searchResult.commit_results && searchResult.commit_results.length > 0 && (
                  <span className="text-purple-600 dark:text-purple-400">
                    ({searchResult.commit_results.length} historical commits found)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span>{searchResult.duration_ms}ms</span>
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!searchResult && !isSearching && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400 dark:text-zinc-500 space-y-2">
                <Search className="w-10 h-10 stroke-1 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  Search Code, Commits &amp; Branches
                </p>
                <p className="text-xs max-w-md">
                  Type any search term, wildcard (like <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">*code*</code> or <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">*.com</code>), or regex pattern above and press <strong>Find All</strong>.
                </p>
              </div>
            )}

            {isSearching && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400 space-y-3">
                <RotateCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-xs">Searching repository records...</p>
              </div>
            )}

            {searchResult && searchResult.results.length === 0 && (!searchResult.commit_results || searchResult.commit_results.length === 0) && (
              <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 space-y-1">
                <p className="text-sm font-medium">No results found for &quot;{searchResult.query}&quot;.</p>
                <p className="text-xs">Try adjusting case sensitivity, branch filters, or file glob patterns.</p>
              </div>
            )}

            {/* Commit History Pickaxe Results */}
            {searchResult?.commit_results && searchResult.commit_results.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 px-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <History className="w-4 h-4" />
                  <span>Commits that modified &quot;{query}&quot; ({searchResult.commit_results.length})</span>
                </div>
                <div className="rounded-xl border border-purple-500/20 divide-y divide-purple-500/10 bg-purple-500/5 overflow-hidden">
                  {searchResult.commit_results.slice(0, 50).map((c, i) => (
                    <div
                      key={i}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-purple-500/10 transition-colors group cursor-pointer"
                      onClick={() => {
                        if (onSelectCommit) {
                          onSelectCommit(c.sha);
                          onClose();
                        }
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                          {c.short_sha}
                        </span>
                        <span className="text-zinc-800 dark:text-zinc-200 truncate font-medium">
                          {c.subject}
                        </span>
                        {c.file_path && (
                          <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                            in {c.file_path}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        View Commit <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Results */}
            {searchResult?.results.map((fileRes) => {
              const isCollapsed = Boolean(collapsedFiles[fileRes.file_path]);
              return (
                <div
                  key={`${fileRes.branch_or_commit}:${fileRes.file_path}`}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden"
                >
                  {/* File Header */}
                  <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleFileCollapse(fileRes.file_path)}
                      className="flex items-center gap-2 min-w-0 text-left font-mono font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                      <FileCode className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="truncate text-zinc-800 dark:text-zinc-200">
                        {fileRes.file_path}
                      </span>
                      {fileRes.branch_or_commit && fileRes.branch_or_commit !== 'Working Tree' && (
                        <span className="px-1.5 py-0.2 rounded font-sans text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium">
                          {fileRes.branch_or_commit}
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800">
                        {fileRes.matches.length} {fileRes.matches.length === 1 ? 'match' : 'matches'}
                      </span>

                      {/* Replace All in this specific file */}
                      {searchScope === 'working_tree' && replaceText !== undefined && replaceText !== '' && (
                        <button
                          type="button"
                          onClick={() => handleExecuteReplace([fileRes.file_path])}
                          disabled={isReplacing}
                          className="px-2 py-0.5 rounded text-[11px] bg-zinc-200 hover:bg-emerald-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-emerald-600 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
                          title={`Replace all ${fileRes.matches.length} occurrences in this file`}
                        >
                          Replace in File
                        </button>
                      )}

                      {/* Open file in explorer */}
                      {onSelectFile && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectFile(fileRes.file_path);
                            onClose();
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                          title="Open file in Working Tree diff view"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Matches List */}
                  {!isCollapsed && (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-mono text-[11px]">
                      {fileRes.matches.map((m, mIdx) => (
                        <div
                          key={mIdx}
                          className="p-2.5 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors group"
                        >
                          {/* Line Number */}
                          <span className="w-10 text-right text-zinc-400 dark:text-zinc-500 select-none shrink-0 font-medium pt-0.5">
                            {m.line_number}
                          </span>

                          {/* Line Content or Replacement Diff Preview */}
                          <div className="flex-1 min-w-0 overflow-x-auto space-y-1">
                            {/* Original matched line */}
                            <div className="text-zinc-700 dark:text-zinc-300 whitespace-pre">
                              {m.replaced_content && replaceText !== '' ? (
                                <span className="bg-rose-500/15 text-rose-800 dark:text-rose-300 px-1 py-0.2 rounded line-through decoration-rose-500/50 mr-2">
                                  {m.line_content.trimEnd()}
                                </span>
                              ) : (
                                m.line_content
                              )}
                            </div>

                            {/* Replacement preview if replaceText provided */}
                            {m.replaced_content && replaceText !== '' && (
                              <div className="text-emerald-700 dark:text-emerald-400 whitespace-pre font-medium flex items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-emerald-500 px-1 py-0.2 rounded bg-emerald-500/10">
                                  Will replace with:
                                </span>
                                <span>{m.replaced_content.trimEnd()}</span>
                              </div>
                            )}
                          </div>

                          {/* Replace this individual line */}
                          {searchScope === 'working_tree' && replaceText !== '' && (
                            <button
                              type="button"
                              onClick={() => handleExecuteReplace([fileRes.file_path], [m.line_number])}
                              disabled={isReplacing}
                              className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:text-emerald-400 font-medium transition-all shrink-0 cursor-pointer"
                              title={`Replace only line ${m.line_number}`}
                            >
                              Replace Line
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>Tip: Enter <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 rounded">*code*</code> to match anything containing code, or <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 rounded">*.com</code> for domains.</span>
          </div>

          <div className="flex items-center gap-3">
            {searchScope === 'working_tree' && searchResult && searchResult.total_matches > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Replacements modify disk files &amp; appear in your Working Tree
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
