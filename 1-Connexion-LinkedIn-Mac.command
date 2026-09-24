#!/bin/bash
cd "$(dirname "$0")"

echo "================================================================"
echo "       Connexion Securisee a votre compte LinkedIn (Mac)"
echo "================================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERREUR] Node.js n'est pas installe. Veuillez executer '0-Installation-Mac.command'."
    read -p "Appuyez sur Entree pour quitter..."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[INFO] Premier lancement detecte : installation automatique..."
    npm install --no-audit --no-fund
fi

echo "Lancement du navigateur Chromium visible pour connexion..."
npm run auth

echo ""
echo "================================================================"
echo "  Session enregistree avec succes dans state.json !"
echo "================================================================"
read -p "Appuyez sur Entree pour fermer cette fenetre..."
