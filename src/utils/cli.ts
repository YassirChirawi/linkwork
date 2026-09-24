import readline from 'readline';
import { emitLog } from './events.js';
import { CONFIG } from '../config.js';

/**
 * Couleurs simples ANSI pour éviter les soucis de compatibilité ESM/CJS de chalk
 */
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgYellow: '\x1b[43m',
};

export const log = {
  info: (msg: string) => {
    console.log(`${colors.cyan}ℹ [INFO]${colors.reset} ${msg}`);
    emitLog('info', msg);
  },
  success: (msg: string) => {
    console.log(`${colors.green}✔ [SUCCÈS]${colors.reset} ${msg}`);
    emitLog('success', msg);
  },
  warn: (msg: string) => {
    console.log(`${colors.yellow}⚠ [ATTENTION]${colors.reset} ${msg}`);
    emitLog('warn', msg);
  },
  error: (msg: string) => {
    console.log(`${colors.red}✖ [ERREUR]${colors.reset} ${msg}`);
    emitLog('error', msg);
  },
  human: (msg: string) => {
    console.log(`${colors.magenta}🤖 [ACTION]${colors.reset} ${msg}`);
    emitLog('human', msg);
  },
  step: (msg: string) => {
    console.log(`\n${colors.bold}${colors.blue}===> ${msg}${colors.reset}`);
    emitLog('system', msg);
  },
};

/**
 * Pose une question à l'utilisateur dans le terminal de manière asynchrone
 */
export async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.bold}${colors.yellow}? ${question}${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export type SemiAutoDecision = 'resume' | 'skip' | 'abort';

let pendingSemiAutoResolver: ((decision: SemiAutoDecision) => void) | null = null;

/**
 * Résout une intervention semi-automatique en attente depuis l'API / Dashboard.
 */
export function resolvePendingSemiAuto(decision: SemiAutoDecision): boolean {
  if (pendingSemiAutoResolver) {
    pendingSemiAutoResolver(decision);
    pendingSemiAutoResolver = null;
    return true;
  }
  return false;
}

/**
 * Arrêt d'urgence / Gestion semi-automatique :
 * Interrompt le script lorsqu'un champ inconnu ou une question complexe se présente
 * et invite l'utilisateur à choisir l'action à mener.
 * En mode 100% Automatique (autoMode), n'interrompt JAMAIS et saute proprement l'offre.
 */
export async function promptSemiAutoChoice(details: {
  fieldIdentifier: string;
  fieldLabel?: string;
  jobTitle?: string;
}): Promise<SemiAutoDecision> {
  // 1. En mode 100% Automatique, aucun blocage console
  if (CONFIG.autoMode) {
    log.warn(`[AutoMode 100%] Champ non franchissable pour "${details.jobTitle || 'offre'}" (${details.fieldLabel || details.fieldIdentifier}) -> Saut automatique et continuation fluide.`);
    return 'skip';
  }

  // Alerte sonore dans le terminal
  try {
    process.stdout.write('\x07');
  } catch {}

  console.log(`\n${colors.bgYellow}${colors.bold} 🛑 [MODE SEMI-AUTO : INTERVENTION REQUISE] ${colors.reset}`);
  if (details.jobTitle) {
    console.log(`${colors.bold}Offre :${colors.reset} ${details.jobTitle}`);
  }
  console.log(`${colors.bold}Champ non résolu :${colors.reset} ${details.fieldLabel || details.fieldIdentifier}`);

  // 2. Si non-interactif (serveur dashboard en arrière-plan)
  if (!process.stdin.isTTY) {
    log.warn('[Dashboard] Attente d\'intervention via le Tableau de bord (délai max 30s)...');
    return new Promise((resolve) => {
      pendingSemiAutoResolver = resolve;
      setTimeout(() => {
        if (pendingSemiAutoResolver === resolve) {
          log.warn('[AutoTimeout] Aucune action Dashboard reçue en 30s -> Saut automatique sécurisé.');
          pendingSemiAutoResolver = null;
          resolve('skip');
        }
      }, 30000);
    });
  }

  // 3. Mode TTY interactif standard
  console.log(`${colors.dim}Vous avez la main sur le navigateur pour compléter ou corriger manuellement.${colors.reset}\n`);
  console.log(`  ${colors.green}[1]${colors.reset} J'ai complété le champ manuellement dans le navigateur -> Continuer le formulaire`);
  console.log(`  ${colors.yellow}[2]${colors.reset} Passer cette offre sans postuler (ignorer proprement)`);
  console.log(`  ${colors.red}[3]${colors.reset} Arrêter immédiatement la session d'automatisation`);

  while (true) {
    const choice = await promptUser('Votre choix (1, 2 ou 3) :');
    if (choice === '1') return 'resume';
    if (choice === '2') return 'skip';
    if (choice === '3') return 'abort';
    console.log(`${colors.red}Choix invalide. Veuillez saisir 1, 2 ou 3.${colors.reset}`);
  }
}
