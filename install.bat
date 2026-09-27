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

:: Check if node is directly in PATH
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    node -v >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        if exist "%ProgramFiles%\nodejs\node.exe" (
            set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;!PATH!"
        ) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
            set "PATH=%ProgramFiles(x86)%\nodejs;%APPDATA%\npm;!PATH!"
        ) else if exist "%LocalAppData%\Programs\nodejs\node.exe" (
            set "PATH=%LocalAppData%\Programs\nodejs;!PATH!"
        ) else if exist "%LocalAppData%\Programs\node\nodejs\node.exe" (
            set "PATH=%LocalAppData%\Programs\node\nodejs;!PATH!"
        )
    )
)

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    node -v >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Node.js is not detected in your system PATH.
        echo If you just installed Node.js, please close and reopen this
        echo terminal window so Windows can load the updated PATH.
        echo.
        echo If Node.js is not yet installed, download LTS from:
        echo   https://nodejs.org/
        echo Recommended: Node.js 18, 20, or 22 LTS
        echo.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%n in ('node -v 2^>^&1') do set NODE_VERSION=%%n
echo [OK] Found Node.js !NODE_VERSION!

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    npm -v >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        if exist "%ProgramFiles%\nodejs\npm.cmd" (
            set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;!PATH!"
        )
    )
)

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    npm -v >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm is not found in your system PATH.
        echo Please verify your Node.js installation.
        echo.
        pause
        exit /b 1
    )
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
