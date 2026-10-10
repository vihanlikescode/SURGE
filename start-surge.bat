@echo off
title Surge - local server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js was not found on this computer.
  echo  Install the LTS version from https://nodejs.org/ then double-click this file again.
  echo  ^(Or skip Node entirely: just double-click index.html to open Surge in your browser.^)
  echo.
  pause
  exit /b 1
)

rem First run: create config.js from the template so the page never asks for a missing file.
if not exist config.js copy config.example.js config.js >nul

echo.
echo  Starting Surge...
echo  Surge opens in your browser at http://127.0.0.1:4173
echo  Keep this window open while you use Surge. Close it or press Ctrl+C to stop.
echo.

node server.js
if errorlevel 1 (
  echo.
  echo  Surge stopped with an error. If the port is busy, close the other Surge window and try again.
  pause
)
