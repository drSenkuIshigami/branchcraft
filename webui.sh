#!/usr/bin/env bash

# Git Workbench - WebUI Launcher
set -e

# ANSI color codes
CLR_RESET="\033[0m"
CLR_RED="\033[0;31m"
CLR_GREEN="\033[0;32m"
CLR_YELLOW="\033[0;33m"
CLR_CYAN="\033[0;36m"
CLR_BOLD="\033[1m"

echo -e "${CLR_CYAN}${CLR_BOLD}========================================================${CLR_RESET}"
echo -e "${CLR_CYAN}${CLR_BOLD}             Git Workbench - WebUI Launcher             ${CLR_RESET}"
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
    echo "Please install Git or run ./Install.sh"
    exit 1
fi
GIT_VER=$(git --version)
echo -e "${CLR_GREEN}[OK] ${GIT_VER}${CLR_RESET}"
echo ""

# 2. Check Node.js and npm
echo -e "${CLR_BOLD}[2/3] Checking Node.js prerequisite...${CLR_RESET}"
if ! command -v node &> /dev/null; then
    echo -e "${CLR_RED}[ERROR] Node.js is not installed or not in your PATH.${CLR_RESET}"
    echo "Please install Node.js (v18, v20, or newer LTS) or run ./Install.sh"
    exit 1
fi

NODE_VER=$(node -v)
NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${CLR_YELLOW}[WARNING] Found Node.js ${NODE_VER}. Node.js 18 or newer is recommended.${CLR_RESET}"
else
    echo -e "${CLR_GREEN}[OK] Node.js ${NODE_VER}${CLR_RESET}"
fi

if ! command -v npm &> /dev/null; then
    echo -e "${CLR_RED}[ERROR] npm is not found in your PATH.${CLR_RESET}"
    exit 1
fi
echo -e "${CLR_GREEN}[OK] npm $(npm -v)${CLR_RESET}"
echo ""

# 3. Check node_modules dependencies
echo -e "${CLR_BOLD}[3/3] Checking installed dependencies...${CLR_RESET}"
if [ ! -d "node_modules" ]; then
    echo -e "${CLR_YELLOW}[NOTICE] 'node_modules' directory not found.${CLR_RESET}"
    echo "Running automatic installation of dependencies..."
    echo ""
    if [ -f "./Install.sh" ]; then
        bash ./Install.sh
    else
        npm install
    fi
else
    echo -e "${CLR_GREEN}[OK] Dependencies are present.${CLR_RESET}"
fi

echo ""
echo -e "${CLR_GREEN}${CLR_BOLD}========================================================${CLR_RESET}"
echo -e "${CLR_GREEN}${CLR_BOLD} Starting Git Workbench WebUI on http://localhost:3000  ${CLR_RESET}"
echo -e "${CLR_GREEN}${CLR_BOLD} Press Ctrl+C to stop the server.                       ${CLR_RESET}"
echo -e "${CLR_GREEN}${CLR_BOLD}========================================================${CLR_RESET}"
echo ""

# Optionally open browser if GUI environment and xdg-open/open is available
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ] || [[ "$OSTYPE" == "darwin"* ]]; then
    (
        sleep 1.5
        if command -v xdg-open &> /dev/null; then
            xdg-open "http://localhost:3000" &> /dev/null || true
        elif command -v open &> /dev/null; then
            open "http://localhost:3000" &> /dev/null || true
        fi
    ) &
fi

exec npm run dev
