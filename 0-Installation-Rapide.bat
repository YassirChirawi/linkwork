@echo off
title Installation Rapide - LinkedIn ET HelloWork Orchestrator
color 0B
echo ================================================================
echo    INSTALLATION AUTOMATIQUE - LINKEDIN ET HELLOWORK BOT
echo ================================================================
echo.

cd /d "%~dp0"

echo [1/3] Verification de Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Node.js n'est pas installe sur votre ordinateur.
    echo Node.js est un moteur gratuit indispensable pour faire tourner l'orchestrateur.
    echo.
    echo Ouverture du site officiel de telechargement dans votre navigateur...
    start https://nodejs.org/en/download/
    echo.
    echo Veuillez telecharger et installer Node.js (version LTS recommandee).
    echo Une fois l'installation terminee, relancez ce fichier "0-Installation-Rapide.bat".
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  -> Node.js detecte : %NODE_VER% (OK)

echo.
echo [2/3] Installation des composants (npm install)...
echo  (Cette operation prend environ 20 a 40 secondes lors du premier lancement...)
call npm install --no-audit --no-fund

if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo  -> Fichier .env initialise par defaut.
    )
)

echo.
echo [3/3] Verification du navigateur furtif Chromium (Playwright)...
call npx playwright install chromium

echo.
echo ================================================================
echo               INSTALLATION REUSSIE A 100%% !
echo ================================================================
echo  Voici ce qu'il vous reste a faire pour postuler :
echo.
echo  1. Mettre votre CV : Glissez votre fichier PDF dans le dossier "assets\"
echo  2. Vous connecter : Double-cliquez sur "1-Connexion-LinkedIn.bat"
echo  3. Lancer le Bot  : Double-cliquez sur "3-Lancer-Orchestrator.bat"
echo.
echo ================================================================
pause
