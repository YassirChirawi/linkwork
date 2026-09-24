#!/bin/bash
cd "$(dirname "$0")"

echo "================================================================"
echo "   Mise a jour automatique de l'Orchestrateur (Git Pull)"
echo "================================================================"
echo ""

if ! command -v git &> /dev/null; then
    echo "[INFO] Git n'est pas installe sur votre Mac."
    echo "Pour mettre a jour, remplacez simplement les fichiers avec le nouveau ZIP."
    read -p "Appuyez sur Entree pour fermer..."
    exit 0
fi

echo "[1/2] Telechargement des dernieres modifications..."
git pull

if [ $? -eq 0 ]; then
    echo ""
    echo "[2/2] Mise a jour des dependances..."
    npm install --no-audit --no-fund
    echo ""
    echo "================================================================"
    echo " Mise a jour terminee avec succes !"
    echo "================================================================"
else
    echo ""
    echo "[INFO] Si ce dossier a ete extrait d'un fichier ZIP,"
    echo "remplacez simplement les fichiers par le nouveau ZIP."
fi

echo ""
read -p "Appuyez sur Entree pour continuer..."
