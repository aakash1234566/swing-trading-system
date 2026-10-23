@echo off
title Push SwingGuard to GitHub
cd /d "%~dp0"
echo ========================================================
echo   Push SwingGuard to GitHub
echo ========================================================
echo.
echo Please create an empty repository on GitHub first:
echo https://github.com/new
echo.
set /p REPO_URL="Enter your GitHub Repo URL (e.g. https://github.com/aakash1234566/swing-trading-system.git): "
if "%REPO_URL%"=="" set REPO_URL=https://github.com/aakash1234566/swing-trading-system.git

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
echo.
echo Pushing to %REPO_URL%...
git push -u origin main

echo.
echo Done! Now you can import this repository into Vercel.
pause
