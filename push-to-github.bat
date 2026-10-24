@echo off
title Push SwingGuard to GitHub
cd /d "%~dp0"
echo ========================================================
echo   Push SwingGuard to GitHub
echo ========================================================
echo.
git add .
git commit -m "Update SwingGuard app and Vercel configuration" 2>nul
echo.
echo Select your target GitHub Account / Repo:
echo  [1] Push to aakashkharwar (Recommended: Matches your Vercel account)
echo  [2] Push to aakash1234566
echo  [3] Custom Repo URL
echo.
set /p CHOICE="Enter choice (1, 2, or 3) [Default 1]: "
if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" (
    set REPO_URL=https://github.com/aakashkharwar/swing-trading-system.git
)
if "%CHOICE%"=="2" (
    set REPO_URL=https://github.com/aakash1234566/swing-trading-system.git
)
if "%CHOICE%"=="3" (
    set /p REPO_URL="Enter custom repository URL: "
)

echo.
echo Setting remote to %REPO_URL%...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main

echo.
echo Pushing to GitHub...
git push -u origin main

echo.
echo ========================================================
echo Done! If push succeeded, open Vercel to deploy.
echo ========================================================
pause
