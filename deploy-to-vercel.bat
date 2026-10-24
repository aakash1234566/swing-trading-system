@echo off
title Deploy SwingGuard to Vercel
cd /d %~dp0
echo ========================================================
echo   Deploy SwingGuard to Vercel (1-Click)
echo ========================================================
echo.
echo Deploying your project to Vercel...
echo If this is your first time, it may ask you to login in your browser.
echo Press Enter on all default questions (Y/N).
echo.
call npx --yes vercel --prod
echo.
echo ========================================================
echo Deployment finished! Check the URL above to view your site.
echo ========================================================
pause
