@echo off
title Connexion HelloWork - Session Setup
color 0E
echo ================================================================
echo       Connexion Securisee a votre compte HelloWork
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
call npm run auth:hellowork

echo.
echo ================================================================
echo  Session HelloWork terminee. Vous pouvez fermer cette fenetre.
echo ================================================================
pause
