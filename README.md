# Git Workbench 🛠️⚡

<p align="center">
  <img src="https://raw.githubusercontent.com/github/explore/main/topics/git/git.png" alt="Git Workbench Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>The Blazing-Fast, Local-First Visual Git Client, Interactive Rebasing Workbench & Repository Rescue Tool</strong>
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-blue?style=flat-square" alt="Platform" /></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/Runtime-Tauri%202.0%20%2B%20Rust%20%2F%20Vite-orange?style=flat-square" alt="Runtime" /></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/UI-React%2019%20%2B%20Tailwind%20v4-38bdf8?style=flat-square" alt="Frontend" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-MIT-emerald?style=flat-square" alt="License" /></a>
  <a href="#security"><img src="https://img.shields.io/badge/Security-100%25%20Local--First%20%7C%20No%20Telemetry-purple?style=flat-square" alt="Local First" /></a>
  <a href="https://github.com/drSenkuIshigami/branchcraft"><img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square" alt="PRs Welcome" /></a>
</p>

<p align="center">
  Git Workbench (<code>branchcraft</code>) is a local-first visual Git client for Windows, macOS, and Linux. The commit graph, interactive rebase, conflict resolver, reflog recovery, and repository search run on your machine and call the Git executable you already have. Repository contents are not uploaded.
</p>

<p align="center">
  <a href="https://github.com/drSenkuIshigami/branchcraft">github.com/drSenkuIshigami/branchcraft</a>
</p>

---

## 🚀 Why Git Workbench?

Most traditional Git GUIs are either **bloated Electron resource hogs**, paywalled with subscription traps, or send your repository analytics to third-party servers. 

**Git Workbench** is engineered from the ground up to be:
* ⚡ **Instant & Ultra-Lightweight:** Powered by native Rust (`src-tauri`) and a razor-sharp React 19 + Vite frontend. No sluggish lag on 50,000+ commit repositories.
* 🛡️ **100% Local-First & Private:** Zero telemetry, zero cloud tracking, zero network requirements. Your code, keys, and commit history never leave your machine.
* 🚑 **Built-in Emergency Rescue (Reflog & Undo):** Accidental `git reset --hard`? Lost commit? Detached HEAD? Git Workbench provides 1-click point-in-time recovery.
* ⚔️ **Visual Conflict Resolution & Rerere:** Side-by-side 3-way conflict resolver powered by Monaco Editor with automatic *Reuse Recorded Resolution* (`rerere`).
* 🔀 **Visual Interactive Rebase:** Drag-and-drop commit squashing, reordering, dropping, and rewording without memorizing terminal commands.
* 💻 **Hybrid Flexibility:** Run as a standalone native desktop app (via Tauri 2 / Rust) or as a local browser-based WebUI with 1-click start scripts for Windows (`.bat`) and Unix (`.sh`).

---

## 🌟 Key Features at a Glance

### 1. 📊 Topological Commit Graph & Visual History
- High-performance canvas-based commit graph displaying merge branches, swimlanes, tags, and HEAD indicators.
- Instant search and filtering across commits, commit SHAs, authors, commit dates, and commit messages.
- Full support for multiple parent merge commits, branch forks, and detached HEAD states.

### 2. ⚔️ 3-Way Conflict Resolver & Auto Rerere
- Visual conflict resolver when merges, cherry-picks, or rebases encounter conflicts.
- 1-Click **Accept Ours (Current Branch)** or **Accept Theirs (Incoming Branch)** per file or per hunk.
- Integrated **Monaco Editor** for manual conflict marker editing with syntax highlighting.
- Built-in Git `rerere` (Reuse Recorded Resolution) cache automatically saves your conflict resolutions so you never resolve the same conflict twice.

### 3. 🔀 Visual Interactive Rebase & Squash Studio
- Effortlessly rebase feature branches onto target branches with a visual studio interface.
- 1-Click actions: **Pick**, **Squash**, **Fixup**, **Reword**, **Edit**, or **Drop**.
- Drag-and-drop to reorder commits intuitively before applying history rewrites.
- Safety check prevents destructive rebases on protected shared branches.

### 4. 🚑 Emergency Recovery & Reflog Explorer
- Built-in visual **Git Reflog** timeline tracking every checkout, commit, reset, rebase, and stash operation.
- **Recover Lost Commits:** Accidental `git reset --hard`? Create a new branch right from the previous reflog entry with 1 click.
- Restore deleted files or past revisions directly from any historical commit.

### 5. 📝 Granular Staging & Line-by-Line Hunk Control
- Stage or unstage entire files, specific directories, or individual diff hunks.
- **Remove File from Commit:** Easily exclude an accidentally committed file from your latest commit while keeping all your edits intact in the working tree.
- Amend commit message, author name, email, or commit date with a single toggle.

### 6. 📦 Git Worktree Manager
- Manage multiple parallel working trees simultaneously.
- Work on hotfixes or long-running feature branches in isolated disk folders without stashing or switching branches.
- Add, inspect, and safely remove worktrees directly from the UI.

### 7. 🛡️ Repository Health, Security & History Purge
- **Repository Health Audit:** Scans for object store bloat (`git fsck`), loose objects, and dangling blobs.
- **Secret & Large File Scanner:** Identifies leaked API keys, tokens, `.env` files, and oversized binary assets.
- **History Purge Wizard:** Cleanly and permanently strip oversized blobs or sensitive files across all commits, branches, and tags.

### 8. 🔍 Global Search & Replace (Code, Wildcards, Branches & History)
- **Multi-Scope Search:** Find patterns across Working Tree (disk files), specific branches, or commit history (`git log -S / -G` pickaxe).
- **Wildcard & Regex:** Search for wildcards like `*code*`, `*.com`, full regular expressions (`.*`), match case (`Aa`), or whole word (`\b`).
- **Branch Filtering:** Filter branches using wildcard patterns (e.g. `*main` to match all branches ending with `main`) or multi-select with checkboxes.
- **File Type & Path Filter:** Narrow searches by extension (e.g. `*.ts, *.tsx, !*.lock`) or directory prefixes (`src/`).
- **Safe In-Place Replacement:** Real-time line-by-line diff preview (old line vs replacement) with 1-click **Replace Line**, **Replace in File**, or **Replace All** in Working Tree.

### 9. 📖 Interactive In-App Problem-Solving Manual
- Stuck on a Git problem? Press <kbd>F1</kbd> or click **Help & Manual** to open the interactive troubleshooting guide.
- Live search for real-world problems: *"Conflict"*, *"Remove file from commit"*, *"Undo reset --hard"*, *"Detached HEAD"*, *"Push rejected"*, *"Stash changes"*.
- Step-by-step guidance tailored directly to Git Workbench buttons, plus 1-click terminal CLI equivalent commands.

### 10. 🎨 Modern Dark / Light Mode & Native OS File Dialogs
- Complete theme support (Dark Mode and Light Mode) across all components, diff inspectors, and dialogs.
- Native operating system folder browser dialogs for Windows Explorer, macOS Finder, and Linux file managers.

---

## 📦 Quick Start & Installation

### Windows (1-Click Run)

1. Clone or download this repository:
   ```cmd
   git clone https://github.com/drSenkuIshigami/branchcraft.git
   cd branchcraft
   ```
2. Run the automated installer:
   ```cmd
   install.bat
   ```
3. Launch the Git Workbench WebUI:
   ```cmd
   webui.bat
   ```
   *Your default browser will automatically open to `http://localhost:3000`.*

---

### macOS & Linux (1-Click Run)

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/drSenkuIshigami/branchcraft.git
   cd branchcraft
   ```
2. Make the scripts executable and run the setup:
   ```bash
   chmod +x Install.sh webui.sh
   ./Install.sh
   ```
3. Start the WebUI launcher:
   ```bash
   ./webui.sh
   ```

---

### Run as Native Desktop App (Tauri 2 + Rust)

To build and run Git Workbench as a compiled native desktop executable with native Rust IPC:

```bash
# Ensure Rust and Cargo are installed (https://rustup.rs)
npm install
npm run tauri:dev
```

To compile production release binaries (`.exe`, `.dmg`, or `.AppImage` / `.deb`):
```bash
npm run tauri:build
```

---

## 🛠️ Tech Stack & Architecture

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Desktop Shell** | [Tauri 2.0](https://v2.tauri.app/) & [Rust](https://www.rust-lang.org/) | Blazing-fast native desktop integration, tiny binary size, minimal RAM usage. |
| **Web Server** | [Express](https://expressjs.com/) & [Node.js](https://nodejs.org/) | Local-first REST proxy and Git IPC bridge for browser mode (`/api/git/*`). |
| **Frontend Framework**| [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/) | Modern declarative UI with hooks, strict typings, and zero runtime crashes. |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Rapid, zero-runtime CSS with custom dark/light theme variants. |
| **Diff & Code Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Industry-standard VS Code diff engine with syntax highlighting and 3-way merge. |
| **Icons & Motion** | [Lucide React](https://lucide.dev/) & [Motion](https://motion.dev/) | Crisp iconography and smooth UI transitions. |
| **Bundler** | [Vite 8](https://vitejs.dev/) | Ultra-fast Hot Module Replacement and production bundling. |

---

## 📚 Problem-Solving Guide (Common Scenarios)

| Problem | How to Solve in Git Workbench | Underlying Git Command |
| :--- | :--- | :--- |
| **Merge / Rebase Conflict** | Open **Working Tree**, select conflicted file, choose *Accept Ours* / *Accept Theirs*, or edit in Monaco Editor, then click *Continue*. | `git add <file> && git merge --continue` |
| **Accidentally committed a file** | Open **Working Tree**, check *Amend Previous Commit*, click `-` to unstage the file, then click *Amend Commit*. | `git reset HEAD~1 -- <file> && git commit --amend --no-edit` |
| **Accidental `git reset --hard`** | Open **Reflog & Recovery**, locate the SHA before the reset, and click *Create Branch Here*. | `git reflog` & `git branch recovery <sha>` |
| **Undo last commit (keep work)** | Right-click the parent commit in the graph and select *Soft Reset (Keep staged changes)*. | `git reset --soft HEAD~1` |
| **Stuck in Detached HEAD** | Switch back to your branch in the sidebar, or click *Create Branch* to save your new commits. | `git switch -c new-feature-branch` |
| **Push Rejected (Non-fast-forward)** | Click **Sync** in top header, choose *Pull (Rebase)*, resolve any conflicts, and *Push*. | `git pull --rebase origin <branch>` |
| **Parallel Branch Development** | Open **Worktrees** tab, click *Add Worktree*, and open a separate isolated folder for concurrent tasks. | `git worktree add ../feature-folder feature-branch` |

---

## 🔒 Security & Privacy Manifesto

- **100% Offline-Capable:** No internet connection is ever required to operate Git Workbench.
- **Zero Cloud Storage:** Your code, commits, and secrets remain strictly on your local disk.
- **No Analytics / Telemetry:** No user tracking, fingerprinting, or telemetry pinging.
- **Audit-Ready:** Full command log available in the UI displaying every Git subprocess command executed with execution duration in milliseconds.

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are warmly welcomed!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/amazing-feature`)
3. Commit your Changes (`git commit -m 'Add amazing feature'`)
4. Push to the Branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for developers who love clean Git history, fast tools, and peace of mind.
</p>

---

<div align="center">

<br/>

**10,000,000,000%**

### Ten billion percent: every impossible system is just an unsolved problem.

<sub>Senku Ishigami · <a href="https://github.com/drSenkuIshigami">drSenkuIshigami</a></sub>

</div>

