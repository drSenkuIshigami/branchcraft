#!/usr/bin/env bash

# Git Workbench - Unix/Linux/macOS Installation Script
set -e

# ANSI color codes
CLR_RESET="\033[0m"
CLR_RED="\033[0;31m"
CLR_GREEN="\033[0;32m"
CLR_YELLOW="\033[0;33m"
CLR_CYAN="\033[0;36m"
CLR_BOLD="\033[1m"

echo -e "${CLR_CYAN}${CLR_BOLD}========================================================${CLR_RESET}"
echo -e "${CLR_CYAN}${CLR_BOLD}          Git Workbench - Setup & Installer            ${CLR_RESET}"
echo -e "${CLR_CYAN}${CLR_BOLD}========================================================${CLR_RESET}"
echo ""

# Ensure we run from the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Check Git
echo -e "${CLR_BOLD}[1/3] Checking Git prerequisite...${CLR_RESET}"
if ! command -v git &> /dev/null; then
    echo -e "${CLR_RED}[ERROR] Git is not installed or not in your PATH.${CLR_RESET}"
    echo "Git Workbench requires Git to function."
    echo "Please install Git via your package manager:"
    echo "  - Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y git"
    echo "  - Fedora:        sudo dnf install -y git"
    echo "  - Arch Linux:    sudo pacman -S git"
    echo "  - macOS:         brew install git (or install Xcode Command Line Tools)"
    echo "Or visit: https://git-scm.com/downloads"
    exit 1
fi
GIT_VER=$(git --version)
echo -e "${CLR_GREEN}[OK] Found ${GIT_VER}${CLR_RESET}"
echo ""

# 2. Check Node.js and npm
echo -e "${CLR_BOLD}[2/3] Checking Node.js prerequisite...${CLR_RESET}"
if ! command -v node &> /dev/null; then
    echo -e "${CLR_RED}[ERROR] Node.js is not installed or not in your PATH.${CLR_RESET}"
    echo "Please install Node.js (v18, v20, or newer LTS):"
    echo "  - Using nvm:     nvm install --lts && nvm use --lts"
    echo "  - macOS:         brew install node"
    echo "  - Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "Or visit: https://nodejs.org/"
    exit 1
fi

NODE_VER=$(node -v)
NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${CLR_YELLOW}[WARNING] Found Node.js ${NODE_VER}. Node.js 18 or newer is recommended.${CLR_RESET}"
else
    echo -e "${CLR_GREEN}[OK] Found Node.js ${NODE_VER}${CLR_RESET}"
fi

if ! command -v npm &> /dev/null; then
    echo -e "${CLR_RED}[ERROR] npm is not found in your PATH.${CLR_RESET}"
    echo "Please verify your Node.js and npm installation."
    exit 1
fi
NPM_VER=$(npm -v)
echo -e "${CLR_GREEN}[OK] Found npm ${NPM_VER}${CLR_RESET}"
echo ""

# 3. Install NPM Dependencies
echo -e "${CLR_BOLD}[3/3] Installing application dependencies via npm...${CLR_RESET}"
echo "Running 'npm install'... Please wait..."
echo ""

if ! npm install; then
    echo ""
    echo -e "${CLR_YELLOW}[NOTICE] Retrying npm install with --legacy-peer-deps...${CLR_RESET}"
    npm install --legacy-peer-deps
fi

# Make scripts executable
chmod +x "$SCRIPT_DIR/Install.sh" 2>/dev/null || true
if [ -f "$SCRIPT_DIR/install.sh" ]; then
    chmod +x "$SCRIPT_DIR/install.sh" 2>/dev/null || true
fi
if [ -f "$SCRIPT_DIR/webui.sh" ]; then
    chmod +x "$SCRIPT_DIR/webui.sh" 2>/dev/null || true
fi

echo ""
echo -e "${CLR_GREEN}${CLR_BOLD}========================================================${CLR_RESET}"
echo -e "${CLR_GREEN}${CLR_BOLD}          Installation Completed Successfully!          ${CLR_RESET}"
echo -e "${CLR_GREEN}${CLR_BOLD}========================================================${CLR_RESET}"
echo ""
echo -e "You can now start Git Workbench by running:"
echo -e "  ${CLR_CYAN}./webui.sh${CLR_RESET}"
echo ""
