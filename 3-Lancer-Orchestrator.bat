@echo off
title LinkedIn et BayIIn Growth Orchestrator
color 0B
echo ================================================================
echo       LinkedIn et BayIIn Growth Orchestrator - Lanceur
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

echo [1/3] Verification et liberation du port 3000...
powershell -NoProfile -Command "try { Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction Stop).OwningProcess -Force -ErrorAction SilentlyContinue } catch {}" >nul 2>nul

echo [2/3] Planification de l'ouverture du navigateur...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

echo [3/3] Demarrage du serveur Dashboard...
echo.
echo ================================================================
echo  Le Dashboard est accessible sur : http://localhost:3000
echo  Laissez cette fenetre ouverte pendant l'utilisation du bot.
echo  Pour arreter l'orchestrateur : fermez simplement cette fenetre.
echo ================================================================
echo.

call npm run dashboard

echo.
echo [INFO] Le serveur s'est arrete.
pause
