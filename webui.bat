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
echo [OK] Node.js !NODE_VERSION!

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
