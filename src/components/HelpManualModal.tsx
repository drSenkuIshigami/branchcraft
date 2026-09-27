import React, { useState, useMemo, useEffect } from 'react';
import {
  HelpCircle,
  Search,
  X,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  GitMerge,
  GitBranch,
  GitCommit,
  RotateCcw,
  Layers,
  FolderGit2,
  Terminal,
  FileText,
  Sliders,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { Theme } from '../types';

export type HelpActionId =
  | 'view_working_tree'
  | 'view_graph'
  | 'view_stashes'
  | 'view_reflog'
  | 'view_worktrees'
  | 'view_health'
  | 'open_repo_modal'
  | 'open_sync_modal'
  | 'open_purge_wizard'
  | 'open_system_audit'
  | 'open_command_log'
  | 'open_bisect_rerere'
  | 'open_submodules';

export interface HelpTopic {
  id: string;
  title: string;
  category: 'emergency' | 'conflicts' | 'commits' | 'branches' | 'remotes' | 'worktrees' | 'audit' | 'shortcuts';
  keywords: string[];
  severity: 'safe' | 'caution' | 'destructive';
  symptom: string;
  solutionSteps: string[];
  actionId?: HelpActionId;
  actionLabel?: string;
  cliCommand?: string;
  tips?: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
  // --- CONFLICTS ---
  {
    id: 'resolve-conflicts',
    title: 'Resolve Merge / Rebase Conflicts Step-by-Step',
    category: 'conflicts',
    keywords: ['conflict', 'merge conflict', 'rebase conflict', 'both modified', 'conflict markers', 'theirs', 'ours', 'rerere'],
    severity: 'caution',
    symptom: 'Git paused during a merge or rebase because the same lines were modified in both branches, displaying "Unmerged paths" or conflict markers (<<<<<<< HEAD).',
    solutionSteps: [
      'In Git Workbench, look at the top conflict banner or open the "Working Tree" panel from the left sidebar.',
      'Under the "Conflicted Files" section, click on any conflicted file to inspect its 3-way diff view.',
      'Use the resolution helper buttons: select "Accept Ours (Current Branch)", "Accept Theirs (Incoming Branch)", or edit the file in Monaco Editor to manually combine both changes.',
      'Once the conflict markers are resolved, click the "Mark Resolved (Stage)" button next to the file.',
      'Repeat for all conflicted files. When all files are staged, click "Continue Merge" or "Continue Rebase" in the top banner.',
    ],
    actionId: 'view_working_tree',
    actionLabel: 'Go to Working Tree & Conflicts',
    cliCommand: 'git status\n# Edit conflicted files, then:\ngit add <resolved-file>\ngit merge --continue  # or: git rebase --continue',
    tips: [
      'Git Workbench enables git rerere (Reuse Recorded Resolution) automatically so if you encounter this exact conflict again, Git resolves it for you.',
      'If you ever get stuck or want to cancel the merge safely, click the "Abort Merge" or "Abort Rebase" button in the conflict banner.',
    ],
  },
  {
    id: 'abort-stuck-merge-rebase',
    title: 'Abort a Stuck Rebase or Merge Safely',
    category: 'conflicts',
    keywords: ['abort', 'cancel merge', 'cancel rebase', 'stuck rebase', 'stop merge', 'quit rebase', 'bail out'],
    severity: 'safe',
    symptom: 'You started a rebase or merge that has messy conflicts or unexpected changes, and you just want to cancel everything and return to the clean state before you started.',
    solutionSteps: [
      'Notice the amber/red status banner at the top of Git Workbench indicating an in-progress merge or rebase.',
      'Click the red "Abort Rebase" or "Abort Merge" button in the active banner.',
      'Git Workbench runs the safe abort operation immediately.',
      'Your working tree and HEAD will cleanly return to the exact commit you were on before the operation started.',
    ],
    actionId: 'view_working_tree',
    actionLabel: 'Check Active Operation Banner',
    cliCommand: 'git merge --abort\n# or for rebase:\ngit rebase --abort',
    tips: [
      'Aborting a rebase or merge does not delete any of your previous commits. It simply restores the pre-operation state.',
    ],
  },

  // --- COMMITS & STAGING ---
  {
    id: 'remove-file-from-commit',
    title: 'Remove a File from the Latest Commit (Keep Changes)',
    category: 'commits',
    keywords: ['remove file from commit', 'delete file from commit', 'uncommit file', 'exclude file', 'remove committed file', 'accidentally committed', 'amend'],
    severity: 'caution',
    symptom: 'You just made a commit, but accidentally included a file that should not have been in it (e.g. a secret, a temporary log, or an unrelated file). You want to take it out of the commit without losing your work.',
    solutionSteps: [
      'In Git Workbench, navigate to the "Working Tree" panel in the left sidebar.',
      'In the Commit Box at the bottom of the Working Tree panel, check the "Amend Previous Commit" checkbox. Your latest commit message will load automatically.',
      'Now, unstage the file you want to exclude: In the "Staged Changes" list, click the minus icon (-) or "Unstage" button next to that specific file.',
      'The file moves back to "Unstaged Changes", preserving all of your edits safely in your working directory.',
      'Click "Amend Commit". The commit is now updated without that file!',
      'You can now add the file to .gitignore, discard it, or commit it separately.',
    ],
    actionId: 'view_working_tree',
    actionLabel: 'Open Working Tree & Amend',
    cliCommand: '# Take the file out of the latest commit while keeping your edits:\ngit reset HEAD~1 -- path/to/file\ngit commit --amend --no-edit',
    tips: [
      'If you have already pushed this commit to a shared public remote (like main on GitHub), amending rewrites history and will require a force-push. Only amend commits that have not been shared yet.',
    ],
  },
  {
    id: 'undo-last-commit-keep-changes',
    title: 'Undo the Last Commit but Keep All Changes (Soft Reset)',
    category: 'commits',
    keywords: ['undo commit', 'uncommit', 'soft reset', 'keep changes', 'cancel commit', 'rewind commit', 'redo commit'],
    severity: 'safe',
    symptom: 'You made a commit too early or want to reorganize your staged files, but you do NOT want to lose any code or edits.',
    solutionSteps: [
      'In Git Workbench, look at the Commit Graph and find your latest commit (HEAD).',
      'Right-click the parent commit (the commit immediately below HEAD), or open the commit menu.',
      'Select "Reset to this commit..." and choose "Soft Reset (Keep staged changes)" or "Mixed Reset (Keep unstaged changes)".',
      'All your changes from that commit will immediately reappear in your Working Tree ready to be restaged or edited, with zero loss of code.',
    ],
    actionId: 'view_graph',
    actionLabel: 'View Commit Graph',
    cliCommand: 'git reset --soft HEAD~1\n# or to unstage as well:\ngit reset --mixed HEAD~1',
    tips: [
      'Soft reset is completely safe: no files or code edits are touched or deleted.',
    ],
  },
  {
    id: 'stage-hunks-line-by-line',
    title: 'Stage Specific Lines or Hunks (Partial File Staging)',
    category: 'commits',
    keywords: ['stage hunks', 'partial stage', 'stage lines', 'split commit', 'interactive staging', 'diff chunk'],
    severity: 'safe',
    symptom: 'You have modified a single file in several places, but only want to include some specific lines/functions in the next commit while leaving others unstaged.',
    solutionSteps: [
      'In the Working Tree panel, click on the modified file to open the Diff Viewer in the center screen.',
      'In the Diff Viewer toolbar, look at individual changed hunks (blocks of additions/deletions).',
      'Click the "Stage Hunk" button located above the specific hunk you wish to stage.',
      'That hunk will be moved to the Staged index, while the remaining changes stay in your Working Tree.',
      'Commit your staged changes, then review or stage the remaining hunks whenever you are ready.',
    ],
    actionId: 'view_working_tree',
    actionLabel: 'Open Working Tree Diff',
    cliCommand: 'git add -p path/to/file',
    tips: [
      'You can also unstage individual hunks from already staged files by clicking "Unstage Hunk" in the staged diff view.',
    ],
  },
  {
    id: 'change-author-date-message',
    title: 'Change Commit Message, Author, Email, or Date',
    category: 'commits',
    keywords: ['amend author', 'change commit message', 'change email', 'change date', 'fix author', 'reword commit'],
    severity: 'caution',
    symptom: 'You noticed a typo in your commit message, or committed with the wrong email address or name.',
    solutionSteps: [
      'To amend the latest commit: Open the "Working Tree" panel, check "Amend Previous Commit", update the commit message text, and click "Amend Commit".',
      'To change author or date on any commit: In the Commit Graph or Commit Details panel, click the "Edit Metadata" / "Author & Date" button.',
      'Specify the corrected author name, email address, or commit timestamp.',
      'Click "Apply Changes". Git Workbench will reword or amend the commit cleanly.',
    ],
    actionId: 'view_working_tree',
    actionLabel: 'Open Commit Box',
    cliCommand: 'git commit --amend -m "New commit message"\n# or change author:\ngit commit --amend --author="Name <email@example.com>" --no-edit',
    tips: [
      'If you need to change messages for older commits in your history, use the "Interactive Rebase" modal to select "reword" for the desired commit.',
    ],
  },
  {
    id: 'discard-unwanted-changes',
    title: 'Discard Unwanted Changes in Working Tree',
    category: 'commits',
    keywords: ['discard changes', 'revert file', 'clean file', 'undo changes', 'checkout file', 'restore file', 'drop changes'],
    severity: 'destructive',
    symptom: 'You experimented with code in a file and want to throw away all uncommitted modifications, restoring the file to the exact state of the latest commit.',
    solutionSteps: [
      'In the "Working Tree" panel on the left, locate the file in "Unstaged Changes".',
      'Click the trash can / "Discard Changes" icon next to the file, or right-click and choose "Discard Changes".',
      'A confirmation modal will appear warning you that this action cannot be undone.',
      'Click "Confirm Discard". The file will immediately revert to its clean HEAD state.',
    ],
    actionId: 'view_working_tree',
    actionLabel: 'Open Working Tree',
    cliCommand: 'git restore path/to/file\n# or for all unstaged files:\ngit restore .',
    tips: [
      'Warning: Discarding changes permanently deletes uncommitted edits. If you are not 100% sure, create a Stash first to save a backup!',
    ],
  },

  // --- EMERGENCY & RECOVERY ---
  {
    id: 'undo-accidental-reset-hard',
    title: 'Recover Lost Commits after "git reset --hard" (Reflog)',
    category: 'emergency',
    keywords: ['recover lost commits', 'undo reset hard', 'reflog', 'lost branch', 'deleted commit', 'accidentally deleted', 'restore commit'],
    severity: 'safe',
    symptom: 'You or a script accidentally ran a hard reset, deleted a branch with work on it, or lost your place in history and think your commits are gone.',
    solutionSteps: [
      'Do not panic: Git rarely deletes committed data immediately! Every commit HEAD has pointed to is recorded in the Git Reflog.',
      'In Git Workbench, click the "Reflog" tab in the left sidebar or the "Reflog Viewer" button.',
      'You will see a chronological log of all recent actions (e.g. "reset: moving to HEAD~1", "commit: ...", "checkout: ...").',
      'Find the entry right before the accidental reset occurred.',
      'Click "Create Branch Here" or "Restore HEAD to this entry". Git Workbench will recreate a branch at that exact SHA, recovering all your commits!',
    ],
    actionId: 'view_reflog',
    actionLabel: 'Open Reflog Viewer',
    cliCommand: 'git reflog\n# Find the SHA before the reset, e.g. abc1234, then:\ngit branch recovery-branch abc1234\ngit checkout recovery-branch',
    tips: [
      'Reflog entries are preserved locally by Git for at least 30 to 90 days. As long as you committed your work, it can almost always be recovered.',
    ],
  },
  {
    id: 'detached-head-fix',
    title: 'Fix "Detached HEAD" State (You are not on any branch)',
    category: 'emergency',
    keywords: ['detached head', 'detached', 'no branch', 'headless', 'commit not on branch', 'switch back to branch'],
    severity: 'safe',
    symptom: 'Git Workbench shows "Detached HEAD @ <sha>" in the branch indicator. You checked out a specific commit or tag directly instead of a branch name.',
    solutionSteps: [
      'If you have NOT made new commits while detached: Simply open the Branches sidebar on the left and double-click your desired branch (e.g. "main" or "dev") to switch back.',
      'If you DID make new commits while detached and want to keep them: Click the "Create Branch" button in the sidebar or commit details.',
      'Enter a name for your new branch (e.g. "my-feature") and click Create & Checkout.',
      'Your commits are now safely saved on the new branch, and you are no longer in a detached HEAD state!',
    ],
    actionId: 'view_graph',
    actionLabel: 'Open Branches & Graph',
    cliCommand: '# To save your commits into a new branch:\ngit branch my-new-branch\ngit switch my-new-branch\n# Or to abandon and go back to main:\ngit switch main',
    tips: [
      'Always remember: Never switch away from a detached HEAD without creating a branch first if you have made commits you want to keep!',
    ],
  },

  // --- BRANCHES & REMOTES ---
  {
    id: 'push-rejected-non-fast-forward',
    title: 'Fix "Push Rejected (Non-Fast-Forward / Fetch First)"',
    category: 'remotes',
    keywords: ['push rejected', 'non-fast-forward', 'fetch first', 'remote contains work', 'push failed', 'failed to push', 'force push'],
    severity: 'caution',
    symptom: 'When trying to push your branch, Git refuses with "error: failed to push some refs... Updates were rejected because the remote contains work that you do not have locally."',
    solutionSteps: [
      'This happens when someone else pushed commits to the remote branch, or you amended commits that were already pushed.',
      'In Git Workbench, click the "Sync" button in the top navigation bar.',
      'Select "Pull (Rebase)" or "Pull (Merge)" to incorporate the remote changes into your local branch first.',
      'If any merge conflicts arise, resolve them using the Conflict Resolution Section, then continue.',
      'Once your branch is cleanly up-to-date with upstream, click "Push" to publish your commits.',
    ],
    actionId: 'open_sync_modal',
    actionLabel: 'Open Remote Sync Modal',
    cliCommand: 'git pull --rebase origin <branch-name>\n# Resolve conflicts if any, then:\ngit push origin <branch-name>',
    tips: [
      'Avoid using "Force Push" unless you are working exclusively on a private feature branch that nobody else is collaborating on.',
    ],
  },
  {
    id: 'force-relocate-branch',
    title: 'Force Relocate / Move a Branch Pointer to Another Commit',
    category: 'branches',
    keywords: ['move branch', 'relocate branch', 'point branch to commit', 'reset branch to sha', 'force branch pointer'],
    severity: 'caution',
    symptom: 'You want to point an existing branch to a different commit without checking it out or running manual git reset commands.',
    solutionSteps: [
      'In the Commit Graph, find the target commit you want the branch to point to.',
      'Right-click the commit or open its context menu, then select "Relocate Branch Here...".',
      'Select the branch you wish to move from the dropdown list.',
      'Review the safety preview showing ahead/behind count.',
      'Confirm the relocation. The branch reference immediately moves to that commit.',
    ],
    actionId: 'view_graph',
    actionLabel: 'Open Commit Graph',
    cliCommand: 'git branch -f <branch-name> <target-commit-sha>',
    tips: [
      'Git Workbench prevents accidentally force-relocating the active checked-out branch without an explicit confirmation warning.',
    ],
  },

  // --- REBASE & SQUASH ---
  {
    id: 'squash-commits-interactive-rebase',
    title: 'Squash Multiple Commits into One (Interactive Rebase)',
    category: 'conflicts',
    keywords: ['squash', 'combine commits', 'interactive rebase', 'reword', 'reorder commits', 'drop commit', 'clean history'],
    severity: 'caution',
    symptom: 'You have multiple small commits (e.g. "fix typo", "wip", "update") that you want to combine into one clean, professional commit before creating a Pull Request.',
    solutionSteps: [
      'In the Commit Graph, identify the base commit right before the commits you want to squash.',
      'Right-click that commit and select "Interactive Rebase on this commit...".',
      'The Interactive Rebase Modal will open, displaying each commit with rebase action selectors.',
      'Keep the first commit as "Pick", and change subsequent commits to "Squash" (combine into previous) or "Fixup" (combine and discard commit message).',
      'You can also drag and drop rows to reorder commits, or set action to "Drop" to remove a commit entirely.',
      'Click "Start Interactive Rebase". Git Workbench executes the rebase cleanly and updates your branch history!',
    ],
    actionId: 'view_graph',
    actionLabel: 'Select Commit in Graph',
    cliCommand: 'git rebase -i HEAD~3\n# Mark commits as squash/fixup in the editor, save and close',
    tips: [
      'Never squash or rewrite commits that have already been merged into a production or shared main branch.',
    ],
  },

  // --- STASHES & WORKTREES ---
  {
    id: 'stash-save-and-restore',
    title: 'Save Work Temporarily with Stash (Switching tasks cleanly)',
    category: 'worktrees',
    keywords: ['stash', 'save work', 'stash pop', 'switch branch with changes', 'stash drop', 'branch from stash'],
    severity: 'safe',
    symptom: 'You are in the middle of a feature and have uncommitted changes, but need to quickly switch to another branch to review a bug without committing half-finished code.',
    solutionSteps: [
      'In the left sidebar, click the "Stashes" tab or click "Stash Working Changes" in the Working Tree panel.',
      'Enter an optional descriptive message (e.g. "WIP on auth form") and choose whether to include untracked files.',
      'Click "Create Stash". Your working tree is immediately reset to a clean state, and your changes are safely stored in your stash list.',
      'You can now switch branches or pull updates with zero conflicts.',
      'When you want your work back: Open the Stashes tab, select your stash, and click "Pop Stash" or "Apply Stash".',
    ],
    actionId: 'view_stashes',
    actionLabel: 'Open Stashes Panel',
    cliCommand: 'git stash push -u -m "WIP changes"\n# When ready to restore:\ngit stash pop',
    tips: [
      'You can also use "Branch from Stash" in Git Workbench to create a brand-new branch containing your stashed changes if the original branch changed too much!',
    ],
  },
  {
    id: 'worktrees-simultaneous-branches',
    title: 'Work on Two Branches at the Same Time (Git Worktrees)',
    category: 'worktrees',
    keywords: ['worktree', 'multiple branches', 'concurrent branches', 'separate directory', 'isolated branch', 'worktree add'],
    severity: 'safe',
    symptom: 'You need to test or compile a release branch while simultaneously keeping your main development branch active, without constantly switching branches or re-installing dependencies.',
    solutionSteps: [
      'In Git Workbench, click the "Worktrees" tab in the left sidebar or select Worktree Manager.',
      'Click "Add Worktree".',
      'Select which branch you want to check out, and choose or accept the target folder path on your computer.',
      'Click "Create Worktree". Git creates a linked working tree folder on your filesystem.',
      'Both directories can now be opened, built, and edited independently without touching each other!',
      'When finished, select the worktree in the manager and click "Remove Worktree" to clean it up.',
    ],
    actionId: 'view_worktrees',
    actionLabel: 'Open Worktree Manager',
    cliCommand: 'git worktree add ../my-repo-hotfix hotfix-branch\n# List worktrees:\ngit worktree list\n# Clean up:\ngit worktree remove ../my-repo-hotfix',
    tips: [
      'Worktrees share the same underlying .git database, so all commits, stashes, and remotes are instantly synchronized between them with minimal disk space.',
    ],
  },

  // --- AUDIT & HEALTH ---
  {
    id: 'bisect-find-bug-commit',
    title: 'Find Which Commit Introduced a Bug (Git Bisect)',
    category: 'audit',
    keywords: ['bisect', 'binary search', 'find bug', 'regression', 'when did it break', 'broken commit'],
    severity: 'safe',
    symptom: 'A test or feature is broken in HEAD, but you know it was working properly a few weeks ago, and there are dozens or hundreds of commits in between.',
    solutionSteps: [
      'In Git Workbench, open the "Bisect & Rerere" modal from the header tools or sidebar.',
      'Mark the current commit (or a known bad SHA) as "Bad".',
      'Select an older commit where everything was working fine and mark it as "Good".',
      'Click "Start Bisect Session". Git will automatically check out the middle commit via binary search.',
      'Test your app. In the Bisect panel, click "Mark Current as Good" or "Mark Current as Bad".',
      'Git Bisect cuts the search space in half each time, identifying the exact culprit commit within ~7 steps even in large codebases!',
    ],
    actionId: 'open_bisect_rerere',
    actionLabel: 'Open Bisect & Rerere Tools',
    cliCommand: 'git bisect start\ngit bisect bad HEAD\ngit bisect good <known-good-sha>\n# Test, then repeat:\ngit bisect good   # or git bisect bad\n# When done:\ngit bisect reset',
    tips: [
      'Git Bisect is mathematically the fastest possible way to identify regressions across large git histories.',
    ],
  },
  {
    id: 'history-purge-large-files-secrets',
    title: 'Clean Large Files & Leaked Secrets from Git History',
    category: 'audit',
    keywords: ['purge', 'large files', 'secret leak', 'api key leaked', 'clean history', 'filter-repo', 'bfg', 'repo size'],
    severity: 'destructive',
    symptom: 'Someone accidentally committed a large binary file (.zip, .mp4, model weights) or an API secret key into git, bloating the repository or posing a security risk even if deleted in a later commit.',
    solutionSteps: [
      'In Git Workbench, open the "History Purge Wizard" from the header or Repository Health Audit.',
      'The tool scans the entire history of all branches and tags to find oversized blobs and sensitive file patterns.',
      'Select the specific file or path you want completely eradicated from all historical commits.',
      'Review the safety checklist (ensure your team is aware of history rewrite).',
      'Run the purge operation. Git Workbench strips the blob from all commits and runs git gc to shrink the repository.',
    ],
    actionId: 'open_purge_wizard',
    actionLabel: 'Launch History Purge Wizard',
    cliCommand: '# Git Workbench provides an automated wizard. Underlying command:\ngit filter-repo --path <bad-file> --invert-paths',
    tips: [
      'Remember: If an API secret or password was committed to a public repository, consider it compromised immediately and rotate/revoke the key right away.',
    ],
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Topics', icon: BookOpen },
  { id: 'emergency', label: '🚨 Emergency & Undo', icon: RotateCcw },
  { id: 'conflicts', label: '⚔️ Conflicts & Rebase', icon: GitMerge },
  { id: 'commits', label: '📝 Commits & Staging', icon: GitCommit },
  { id: 'branches', label: '🌿 Branches & Pointers', icon: GitBranch },
  { id: 'remotes', label: '🌐 Remotes & Sync', icon: FolderGit2 },
  { id: 'worktrees', label: '📦 Stashes & Worktrees', icon: Layers },
  { id: 'audit', label: '🔍 Audit & Diagnostics', icon: ShieldCheck },
  { id: 'shortcuts', label: '⌨️ Shortcuts & Tips', icon: Terminal },
];

interface HelpManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPerformAction?: (actionId: HelpActionId) => void;
  theme: Theme;
}

export const HelpManualModal: React.FC<HelpManualModalProps> = ({
  isOpen,
  onClose,
  onPerformAction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(HELP_TOPICS[0].id);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

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

  // Filter topics based on search query and category
  const filteredTopics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return HELP_TOPICS.filter((topic) => {
      // Category match
      if (selectedCategory !== 'all' && topic.category !== selectedCategory) {
        return false;
      }
      // Query match
      if (!query) return true;

      const titleMatch = topic.title.toLowerCase().includes(query);
      const symptomMatch = topic.symptom.toLowerCase().includes(query);
      const keywordMatch = topic.keywords.some((k) => k.toLowerCase().includes(query));
      const stepsMatch = topic.solutionSteps.some((step) => step.toLowerCase().includes(query));
      const cliMatch = topic.cliCommand?.toLowerCase().includes(query);

      return titleMatch || symptomMatch || keywordMatch || stepsMatch || cliMatch;
    });
  }, [searchQuery, selectedCategory]);

  // Keep selected topic valid when filtering
  useEffect(() => {
    if (filteredTopics.length > 0) {
      const exists = filteredTopics.some((t) => t.id === selectedTopicId);
      if (!exists) {
        setSelectedTopicId(filteredTopics[0].id);
      }
    }
  }, [filteredTopics, selectedTopicId]);

  if (!isOpen) return null;

  const currentTopic = HELP_TOPICS.find((t) => t.id === selectedTopicId) || filteredTopics[0] || null;

  const handleCopyCli = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => {
      setCopiedCmd(null);
    }, 2000);
  };

  const handleActionClick = (actionId?: HelpActionId) => {
    if (!actionId || !onPerformAction) return;
    onClose();
    onPerformAction(actionId);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={i}
              className="bg-amber-400/30 text-amber-900 dark:text-amber-200 px-0.5 rounded font-medium"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 overflow-hidden">
      <div className="w-full max-w-5xl h-[88vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Git Workbench - Problem Solving & Manual</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-medium">
                  Interactive Guide
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Step-by-step solutions for Git errors, accidental commits, merge conflicts, and undo operations.
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
              title="Close Manual"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          {/* Search Input */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search problem: 'Conflict', 'Remove file from commit', 'Undo', 'Reflog'..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-xs"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body: Left Column List & Right Column Step-by-Step Guide */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
          {/* Left Column: Topics List */}
          <div className="w-full md:w-80 lg:w-96 flex flex-col shrink-0 min-h-0 bg-zinc-50/30 dark:bg-zinc-900/20">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
              <span>{filteredTopics.length} Problem Guides</span>
              {searchQuery && (
                <span className="text-blue-600 dark:text-blue-400 font-mono text-[10px]">
                  Filtered by &quot;{searchQuery}&quot;
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredTopics.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 dark:text-zinc-500 space-y-2">
                  <HelpCircle className="w-8 h-8 mx-auto stroke-1" />
                  <p className="text-xs">No matching guides found for &quot;{searchQuery}&quot;.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Reset search filters
                  </button>
                </div>
              ) : (
                filteredTopics.map((topic) => {
                  const isSelected = currentTopic?.id === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedTopicId(topic.id)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer group flex flex-col gap-1 border ${
                        isSelected
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'bg-white dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200/80 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="font-semibold text-xs leading-snug">
                          {highlightMatch(topic.title, searchQuery)}
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isSelected
                              ? 'text-blue-500 translate-x-0.5'
                              : 'text-zinc-400 group-hover:translate-x-0.5'
                          }`}
                        />
                      </div>

                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {highlightMatch(topic.symptom, searchQuery)}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-medium ${
                            topic.severity === 'safe'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : topic.severity === 'caution'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {topic.severity.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {topic.solutionSteps.length} Steps
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Step-by-Step Problem Solving Guide */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5 space-y-5 bg-white dark:bg-zinc-900">
            {currentTopic ? (
              <>
                {/* Topic Header */}
                <div className="space-y-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Git Workbench Solution Guide
                    </span>

                    {/* Safety Badge */}
                    <div className="flex items-center gap-1.5">
                      {currentTopic.severity === 'safe' && (
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>100% Safe (No Code Loss)</span>
                        </div>
                      )}
                      {currentTopic.severity === 'caution' && (
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-medium border border-amber-500/20">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Caution (Rewrites Local Commit History)</span>
                        </div>
                      )}
                      {currentTopic.severity === 'destructive' && (
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-medium border border-rose-500/20">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Destructive (Permanently Discards Uncommitted Edits)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {currentTopic.title}
                  </h1>

                  <div className="p-3 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-0.5">
                      When does this happen?
                    </span>
                    {currentTopic.symptom}
                  </div>
                </div>

                {/* Step-by-Step Instructions */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-500" />
                    How to solve this in Git Workbench (Step-by-Step)
                  </h3>

                  <div className="space-y-2.5">
                    {currentTopic.solutionSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                      >
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          {idx + 1}
                        </span>
                        <div className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">
                          {highlightMatch(step, searchQuery)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Direct In-App Action Button */}
                {currentTopic.actionId && (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Jump Directly to the Tool in this App
                      </span>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        Click below to close this guide and immediately open the relevant feature.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleActionClick(currentTopic.actionId)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <span>{currentTopic.actionLabel || 'Open Feature in App'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* CLI Command Equivalent with Copy */}
                {currentTopic.cliCommand && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                        <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                        Terminal CLI Equivalent:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCli(currentTopic.cliCommand!)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedCmd === currentTopic.cliCommand ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Command</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="p-3.5 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto border border-zinc-800 leading-relaxed select-all">
                      {currentTopic.cliCommand}
                    </pre>
                  </div>
                )}

                {/* Important Tips / Notes */}
                {currentTopic.tips && currentTopic.tips.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                    <span className="font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Pro Tip & Safety Note
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[11px] opacity-95">
                      {currentTopic.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400">
                <FileText className="w-10 h-10 mb-2 stroke-1" />
                <p className="text-sm font-medium">Select a topic from the left to view step-by-step guidance.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Quick Keyboard Shortcuts & Help Status */}
        <div className="px-5 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>Tip: Press <kbd className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">F1</kbd> or <kbd className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">?</kbd> anytime to open this manual</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Git Workbench Documentation & Troubleshooting</span>
          </div>
        </div>
      </div>
    </div>
  );
};
