@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Yanhuo Renjian - Qingshi Xiang

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "E:\Node.js\node.exe" set "NODE_EXE=E:\Node.js\node.exe"

if not defined NODE_EXE (
  echo.
  echo   Node.js not found.
  echo   Please install Node.js 18+ from https://nodejs.org/
  echo   Then double-click this file again.
  echo.
  pause
  exit /b 1
)

"%NODE_EXE%" serve.mjs
echo.
echo   Server stopped.
pause
