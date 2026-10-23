@echo off
title SwingGuard - Swing Trading & Risk Analysis System
cd /d "%~dp0"
echo ========================================================
echo   Launching SwingGuard Trading System
echo   URL: http://localhost:3000
echo ========================================================
start http://localhost:3000
node server.js
pause
