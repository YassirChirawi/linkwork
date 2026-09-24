import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';
import { authenticateInteractive } from './auth.js';
import { EasyApplyModule } from './modules/easyApply.js';
import { NetworkingModule } from './modules/networking.js';
import { OutreachModule } from './modules/outreach.js';
import { colors, log, promptUser } from './utils/cli.js';

/**
 * Affiche la bannière d'accueil de l'orchestrateur
 */
function displayBanner(): void {
  console.clear();
  console.log(`${colors.cyan}${colors.bold}`);
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║       LINKEDIN AUTOMATION ORCHESTRATOR - STEALTH PLAYWRIGHT      ║');
  console.log('║        Anti-detection • Easy Apply • Networking • SaaS Outreach  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  const hasSession = fs.existsSync(CONFIG.sessionStoragePath);
  const hasResume = fs.existsSync(path.resolve(CONFIG.candidate.resumePath));

  console.log(`${colors.bold}Statut de l'environnement :${colors.reset}`);
  console.log(
    `  • Session (state.json) : ${
      hasSession
        ? `${colors.green}✔ Présente (${CONFIG.sessionStoragePath})${colors.reset}`
        : `${colors.red}✖ Absente - Veuillez exécuter l'authentification [1] d'abord${colors.reset}`
    }`
  );
  console.log(
    `  • Fichier CV           : ${
      hasResume
        ? `${colors.green}✔ Détecté (${CONFIG.candidate.resumePath})${colors.reset}`
        : `${colors.yellow}⚠ Non détecté (mode semi-auto actif en cas de besoin)${colors.reset}`
    }`
  );
  console.log(
    `  • Navigateur           : ${
      CONFIG.headless ? `${colors.yellow}Headless (Arrière-plan)${colors.reset}` : `${colors.green}Visible (Surveillance humaine)${colors.reset}`
    }`
  );
  console.log(`  • Quotas par session   : Easy Apply = ${CONFIG.quotas.maxEasyApplyPerSession} | Réseau = ${CONFIG.quotas.maxNetworkingPerSession} | SaaS = ${CONFIG.quotas.maxOutreachPerSession}\n`);
}

/**
 * Menu principal interactif
 */
async function main(): Promise<void> {
  while (true) {
    displayBanner();

    console.log(`${colors.bold}Que souhaitez-vous faire ?${colors.reset}`);
    console.log(`  ${colors.cyan}[1]${colors.reset} 🔑 Connexion manuelle initiale (Générer / Renouveler la session state.json)`);
    console.log(`  ${colors.green}[2]${colors.reset} 📝 Lancer le Module Candidatures (Easy Apply Semi-Auto)`);
    console.log(`  ${colors.blue}[3]${colors.reset} 🤝 Lancer le Module Réseautage (Job Hunting & Invitations ciblées)`);
    console.log(`  ${colors.magenta}[4]${colors.reset} 🚀 Lancer le Module Prospection & Visibilité SaaS (BayIIn)`);
    console.log(`  ${colors.yellow}[5]${colors.reset} ⚙️  Consulter les paramètres et profil candidat`);
    console.log(`  ${colors.red}[6]${colors.reset} 🚪 Quitter`);

    const choice = await promptUser('\nEntrez votre choix (1-6) :');

    switch (choice) {
      case '1':
        await authenticateInteractive();
        await promptUser('\nAppuyez sur ENTRÉE pour revenir au menu principal...');
        break;

      case '2': {
        if (!fs.existsSync(CONFIG.sessionStoragePath)) {
          log.warn('Aucune session active. Veuillez d\'abord exécuter l\'étape 1.');
          await promptUser('\nAppuyez sur ENTRÉE pour continuer...');
          break;
        }
        const easyApply = new EasyApplyModule();
        await easyApply.run();
        await promptUser('\nSession terminée. Appuyez sur ENTRÉE pour revenir au menu...');
        break;
      }

      case '3': {
        if (!fs.existsSync(CONFIG.sessionStoragePath)) {
          log.warn('Aucune session active. Veuillez d\'abord exécuter l\'étape 1.');
          await promptUser('\nAppuyez sur ENTRÉE pour continuer...');
          break;
        }
        const networking = new NetworkingModule();
        await networking.run();
        await promptUser('\nSession terminée. Appuyez sur ENTRÉE pour revenir au menu...');
        break;
      }

      case '4': {
        if (!fs.existsSync(CONFIG.sessionStoragePath)) {
          log.warn('Aucune session active. Veuillez d\'abord exécuter l\'étape 1.');
          await promptUser('\nAppuyez sur ENTRÉE pour continuer...');
          break;
        }
        const outreach = new OutreachModule();
        await outreach.run();
        await promptUser('\nSession terminée. Appuyez sur ENTRÉE pour revenir au menu...');
        break;
      }

      case '5':
        console.log('\n--- Configuration Actuelle ---');
        console.log(JSON.stringify(CONFIG, null, 2));
        await promptUser('\nAppuyez sur ENTRÉE pour revenir au menu...');
        break;

      case '6':
      case 'q':
      case 'exit':
        log.info('Au revoir !');
        process.exit(0);

      default:
        log.error('Choix invalide. Veuillez saisir un nombre entre 1 et 6.');
        await promptUser('\nAppuyez sur ENTRÉE pour continuer...');
        break;
    }
  }
}

// Lancement
main().catch((err) => {
  log.error(`Erreur inattendue : ${(err as Error).message}`);
  process.exit(1);
});
