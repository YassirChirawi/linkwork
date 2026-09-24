# 🚀 LinkedIn Stealth Orchestrator (Playwright + TypeScript)

Orchestrateur modulaire d'automatisation LinkedIn conçu pour le contournement des détections antibot, l'envoi de candidatures Easy Apply avec gestion semi-automatique, le réseautage ciblé et la prospection SaaS (BayIIn).

---

## 🛡️ Fonctionnalités & Sécurité Anti-Détection

1. **Playwright Stealth (`playwright-extra` + `puppeteer-extra-plugin-stealth`)** :
   - Masquage complet de `navigator.webdriver`.
   - Émulation d'empreintes de navigateur réelles (canvas, webgl, plugins, permissions).
   - Viewport, User-Agent récent et géolocalisation cohérente (Paris, FR).

2. **Session persistante via `storageState` (`state.json`)** :
   - Aucun identifiant ou mot de passe en clair dans le code.
   - Script de connexion interactif unique (`npm run auth`) permettant de résoudre manuellement le 2FA et d'exporter les cookies de session.

3. **Actions Humaines Réalistes (`src/utils/humanize.ts`)** :
   - **Délais Gaussiens** : Distribution normale basée sur l'algorithme de Box-Muller au lieu du `Math.random()` uniforme facilement détectable.
   - **Frappe Caractère par Caractère (`humanType`)** : Rythme irrégulier, pauses physiologiques sur ponctuation et espaces.
   - **Défilement et Souris Fluides (`humanScroll`, `humanMoveAndClick`)** : Simulation de la lecture d'écran et clics décentrés.

4. **Arrêt d'Urgence / Mode Semi-Automatique** :
   - Si un champ inconnu, une question ouverte ou une erreur de validation survient lors d'une candidature : alerte sonore et console, pause du script, et invitation de l'utilisateur à intervenir manuellement dans le navigateur sans risquer un blocage de compte.

---

## 📁 Architecture du Projet

```
linkedin-orchestrator/
├── package.json               # Dépendances exactes et scripts npm
├── tsconfig.json              # Configuration TypeScript ES2022 / NodeNext
├── .env.example               # Modèle de configuration des variables d'environnement
├── .gitignore                 # Exclusion des fichiers sensibles (state.json, CV, logs)
├── README.md                  # Guide d'utilisation et documentation
├── assets/
│   └── sample_cv.txt          # Emplacement pour déposer votre CV PDF
└── src/
    ├── config.ts              # Quotas, délais gaussiens, sélecteurs, profil candidat
    ├── auth.ts                # Connexion manuelle et sauvegarde du storageState
    ├── index.ts               # Menu CLI interactif principal
    ├── utils/
    │   ├── browser.ts         # Lanceur Chromium Stealth et gestion des sessions
    │   ├── humanize.ts        # Algorithme Box-Muller, frappe humaine, scroll réaliste
    │   └── cli.ts             # Interface terminal colorée et prompts semi-auto
    └── modules/
        ├── easyApply.ts       # Module 1 : Candidatures Easy Apply avec résolution dynamique
        ├── networking.ts      # Module 2 : Job Hunting et invitations ciblées (CTO, Recruteurs)
        └── outreach.ts        # Module 3 : Prospection & visibilité SaaS BayIIn (#hashtags)
```

---

## ⚡ Installation & Démarrage

### 1. Cloner et installer les dépendances
```bash
npm install
npx playwright install chromium
```

### 2. Configurer les variables d'environnement
Créez votre fichier `.env` à partir du modèle :
```bash
cp .env.example .env
```
Renseignez vos coordonnées (téléphone, ville, années d'expérience) et le chemin vers votre CV PDF.

### 3. Première utilisation : Authentification
Lancez l'authentification manuelle pour générer votre session `state.json` :
```bash
npm run auth
```
Une fenêtre Chromium s'ouvre : connectez-vous, validez votre 2FA, puis appuyez sur Entrée dans votre console.

### 4. Lancer l'orchestrateur
```bash
npm start
```
Ou lancer directement un module spécifique :
- **Easy Apply** : `npm run easy-apply`
- **Réseautage** : `npm run networking`
- **Prospection SaaS** : `npm run outreach`
