@echo off
title Mise a jour de l'Orchestrateur
color 0B
echo ================================================================
echo    Mise a jour automatique de l'Orchestrateur (Git Pull)
echo ================================================================
echo.
cd /d "%~dp0"

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Git n'est pas installe sur votre ordinateur.
    echo Pour mettre a jour, remplacez simplement les fichiers avec le nouveau ZIP.
    pause
    exit /b 0
)

echo [1/2] Telechargement des dernieres modifications...
git pull
if %errorlevel% equ 0 (
    echo.
    echo [2/2] Mise a jour des composants...
    call npm install --no-audit --no-fund
    echo.
    echo ================================================================
    echo  Mise a jour terminee avec succes !
    echo ================================================================
) else (
    echo.
    echo [INFO] Si ce dossier a ete extrait d'un fichier ZIP,
    echo remplacez simplement les fichiers avec le nouveau ZIP.
)
echo.
pause
