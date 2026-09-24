#!/bin/bash
cd "$(dirname "$0")"

echo "================================================================"
echo "    INSTALLATION AUTOMATIQUE - LINKEDIN ET HELLOWORK BOT (MAC)"
echo "================================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERREUR] Node.js n'est pas encore installe sur votre Mac."
    echo "Ouverture du site officiel de telechargement..."
    open "https://nodejs.org/en/download/"
    echo "Veuillez installer Node.js (version LTS recommandee) puis relancer ce fichier."
    read -p "Appuyez sur Entree pour quitter..."
    exit 1
fi

NODE_VER=$(node -v)
echo " -> Node.js detecte : $NODE_VER (OK)"
echo ""

echo "[1/3] Installation des modules (npm install)..."
npm install --no-audit --no-fund

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp ".env.example" ".env"
    echo " -> Fichier .env initialise par defaut."
fi

echo ""
echo "[2/3] Installation du navigateur Chromium furtif (Playwright)..."
npx playwright install chromium

echo ""
echo "================================================================"
echo "               INSTALLATION REUSSIE SUR VOTRE MAC !"
echo "================================================================"
echo "Voici la marche a suivre pour postuler :"
echo " 1. Glissez votre CV PDF dans le dossier 'assets/'"
echo " 2. Double-cliquez sur '1-Connexion-LinkedIn-Mac.command'"
echo " 3. Double-cliquez sur '3-Lancer-Orchestrator-Mac.command'"
echo "================================================================"
read -p "Appuyez sur Entree pour terminer..."
