@echo off
setlocal enabledelayedexpansion

:: Git Workbench - WebUI Launcher
title Git Workbench - WebUI

echo ========================================================
echo              Git Workbench - WebUI Launcher
echo ========================================================
echo.

:: 1. Check Git
echo [1/3] Checking Git prerequisite...
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed or not available in PATH.
    echo Git Workbench requires Git to be installed.
    echo Please install Git from: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%g in ('git --version 2^>^&1') do set GIT_VERSION=%%g
echo [OK] !GIT_VERSION!

:: 2. Check Node.js and npm
echo.
echo [2/3] Checking Node.js prerequisite...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not available in PATH.
    echo Please install Node.js (version 18, 20, or newer LTS) from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%n in ('node -v 2^>^&1') do set NODE_VERSION=%%n
echo [OK] Node.js !NODE_VERSION!

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found in your system PATH.
    echo Please check your Node.js installation.
    echo.
    pause
    exit /b 1
)

:: 3. Check node_modules dependencies
echo.
echo [3/3] Checking installed dependencies...
if not exist "node_modules\" (
    echo [NOTICE] 'node_modules' directory not found.
    echo Running automatic installation of requirements...
    echo.
    if exist "install.bat" (
        call install.bat
    ) else (
        call npm install
    )
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b %ERRORLEVEL%
    )
) else (
    echo [OK] Dependencies are present.
)

:: Start WebUI
echo.
echo ========================================================
echo Starting Git Workbench WebUI on http://localhost:3000
echo Press Ctrl+C in this terminal to stop the server.
echo ========================================================
echo.

:: Launch browser in background after short delay
start "" http://localhost:3000 >nul 2>&1

:: Run Vite Dev Server
call npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] WebUI server stopped unexpectedly with error code %ERRORLEVEL%.
    pause
)
