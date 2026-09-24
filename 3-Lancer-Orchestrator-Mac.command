#!/bin/bash
cd "$(dirname "$0")"

echo "================================================================"
echo "      LinkedIn & BayIIn Growth Orchestrator - Lanceur Mac"
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

# Liberation du port 3000 si deja utilise
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Ouverture automatique du Dashboard dans le navigateur
(sleep 2 && open "http://localhost:3000") &

echo "================================================================"
echo "  Le Dashboard est accessible sur : http://localhost:3000"
echo "  Laissez cette fenetre Terminal ouverte pendant l'utilisation."
echo "  Pour arreter l'orchestrateur : fermez la fenetre ou faites Ctrl+C."
echo "================================================================"
echo ""

npm run dashboard
