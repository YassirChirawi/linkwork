@echo off
title Connexion LinkedIn - Session Setup
color 0A
echo ================================================================
echo       Connexion Securisee a votre compte LinkedIn
echo ================================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe.
    echo Veuillez executer "0-Installation-Rapide.bat" d'abord.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Premier lancement detecte : installation automatique...
    call npm install --no-audit --no-fund
)

echo [1/2] Lancement du navigateur Chromium visible...
npm run auth

echo.
echo ================================================================
echo  Session terminee. Vous pouvez fermer cette fenetre.
echo ================================================================
pause
