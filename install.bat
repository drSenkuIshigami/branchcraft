@echo off
setlocal enabledelayedexpansion

:: Git Workbench - Windows Installation Script
title Git Workbench - Installer

echo ========================================================
echo           Git Workbench - Setup ^& Installer
echo ========================================================
echo.

:: 1. Check Git
echo [1/3] Checking Git prerequisite...
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed or not in your system PATH.
    echo Git Workbench requires Git to be installed on your system.
    echo Please download and install Git from: https://git-scm.com/download/win
    echo After installing, restart this script.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%g in ('git --version 2^>^&1') do set GIT_VERSION=%%g
echo [OK] Found !GIT_VERSION!

:: 2. Check Node.js and npm
echo.
echo [2/3] Checking Node.js prerequisite...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in your system PATH.
    echo Please download and install Node.js (version 18, 20, or newer LTS) from:
    echo https://nodejs.org/
    echo After installing, restart this script.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%n in ('node -v 2^>^&1') do set NODE_VERSION=%%n
echo [OK] Found Node.js !NODE_VERSION!

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found in your system PATH.
    echo Please verify your Node.js installation.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%m in ('npm -v 2^>^&1') do set NPM_VERSION=%%m
echo [OK] Found npm !NPM_VERSION!

:: 3. Install NPM Dependencies
echo.
echo [3/3] Installing application dependencies via npm...
echo Running 'npm install'... Please wait...
echo.

call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] npm install encountered errors during setup.
    echo Please review the error log above.
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo           Installation Completed Successfully!
echo ========================================================
echo.
echo You can now start Git Workbench by running:
echo   webui.bat
echo.
pause
exit /b 0
