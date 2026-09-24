@echo off
title Creation du Pack de Partage - LinkedIn Orchestrator
color 0B
echo ================================================================
echo    Creation du Pack Securise pour Partage a un autre utilisateur
echo ================================================================
echo.
echo Ce script va preparer une archive ZIP propre et securisee
echo SANS vos cookies prives (state.json), SANS vos mots de passe
echo et SANS votre CV personnel.
echo.
pause

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "scripts\package_all_packs.ps1"

echo.
echo ================================================================
echo  SUCCES ! Vos archives pretes a envoyer ont ete generees :
echo.
echo  1. Pour Windows uniquement :
echo     -> LinkedIn-Orchestrator-Windows.zip
echo.
echo  2. Pour Mac uniquement :
echo     -> LinkedIn-Orchestrator-Mac.zip
echo.
echo  3. Pack Universel (Windows + Mac) :
echo     -> LinkedIn-Orchestrator-Pack.zip
echo.
echo  Vous pouvez envoyer ces fichiers ZIP par WeTransfer, Google Drive,
echo  WhatsApp, Cle USB ou Email !
echo ================================================================
echo.
pause
