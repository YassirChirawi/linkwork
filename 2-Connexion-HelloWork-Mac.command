#!/bin/bash
cd "$(dirname "$0")"

echo "================================================================"
echo "      Connexion Securisee a votre compte HelloWork (Mac)"
echo "================================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERREUR] Node.js n'est pas installe. Veuillez executer '0-Installation-Mac.command'."
    read -p "Appuyez sur Entree pour quitter..."
    exit 1
fi

echo "Lancement du navigateur Chromium visible pour HelloWork..."
npm run auth:hellowork

echo ""
echo "================================================================"
echo "  Session HelloWork enregistree dans hellowork_state.json !"
echo "================================================================"
read -p "Appuyez sur Entree pour fermer cette fenetre..."
