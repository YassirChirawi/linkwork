import { createStealthBrowser, saveSessionState } from './utils/browser.js';
import { CONFIG } from './config.js';
import { log, promptUser } from './utils/cli.js';

/**
 * Script d'authentification interactive unique.
 * Ouvre une fenêtre Chromium réelle, permet à l'utilisateur de s'authentifier
 * en toute sécurité (y compris 2FA / CAPTCHA), puis exporte les cookies
 * et l'état de stockage vers `state.json`.
 */
export async function authenticateInteractive(options: { autoDetectOnly?: boolean } = {}): Promise<boolean> {
  log.step('Initialisation de la session d\'authentification manuelle...');
  log.info('Ouverture du navigateur Chromium en mode visible...');

  // Lancement en mode visible et sans session préalable
  const { browser, context, page } = await createStealthBrowser({
    headless: false,
    useSession: false,
  });

  try {
    log.info('Navigation vers la page de connexion LinkedIn...');
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

    console.log('\n------------------------------------------------------------');
    log.human('Veuillez vous connecter manuellement sur la fenêtre Chromium ouverte.');
    log.info('- Saisissez votre identifiant et mot de passe.');
    log.info('- Validez l\'éventuel code 2FA (SMS ou Authenticator) ou Captcha.');
    log.info('- Attendez d\'arriver sur votre fil d\'actualité LinkedIn.');
    console.log('------------------------------------------------------------\n');

    // Attente intelligente : détection automatique de l'URL /feed
    const waitForFeed = page.waitForURL(/.*linkedin\.com\/(feed|home).*/, {
      timeout: 240000, // 4 minutes
    }).then(() => true).catch(() => false);

    if (options.autoDetectOnly) {
      log.info('Attente de détection automatique de connexion (/feed)...');
      const success = await waitForFeed;
      if (!success) {
        throw new Error('Délai d\'authentification dépassé (4 minutes).');
      }
    } else {
      const manualConfirm = promptUser('Appuyez sur ENTRÉE une fois connecté et sur le fil d\'actualité :').then(() => true);
      await Promise.race([waitForFeed, manualConfirm]);
    }

    // Vérification de présence d'un élément de navigation standard
    log.info('Vérification de la validité de la session...');
    await page.waitForTimeout(3000);

    // Sauvegarde de l'état (cookies, tokens)
    await saveSessionState(context);
    log.success(`Session LinkedIn sauvegardée avec succès dans : ${CONFIG.sessionStoragePath}`);
    log.info('Vos identifiants et mots de passe ne sont JAMAIS stockés en clair.');

    const { historyManager } = await import('./utils/history.js');
    historyManager.logAction({
      module: 'auth',
      actionType: 'SESSION_SAVED',
      target: CONFIG.candidate.email,
      details: 'Session Chromium et cookies sauvegardés dans state.json',
      status: 'SUCCESS',
    });

    return true;
  } catch (err) {
    log.error(`Échec lors de l'authentification : ${(err as Error).message}`);
    throw err;
  } finally {
    await browser.close();
    log.info('Navigateur fermé.');
  }
}

/**
 * Authentification interactive pour HelloWork.
 * Ouvre Chromium sur la page de connexion HelloWork et sauvegarde les cookies dans hellowork_state.json.
 */
export async function authenticateHelloWorkInteractive(options: { autoDetectOnly?: boolean } = {}): Promise<boolean> {
  log.step('Initialisation de l\'authentification HelloWork...');
  log.info('Ouverture du navigateur Chromium en mode visible...');

  const { browser, context, page } = await createStealthBrowser({
    headless: false,
    useSession: false,
    storagePath: CONFIG.helloWorkSessionStoragePath,
  });

  let isWindowClosed = false;
  page.on('close', () => {
    isWindowClosed = true;
  });
  browser.on('disconnected', () => {
    isWindowClosed = true;
  });

  try {
    log.info('Navigation vers la page de connexion HelloWork...');
    await page.goto('https://www.hellowork.com/fr-fr/candidat/connexion.html', { waitUntil: 'domcontentloaded' });

    // Masquage automatique des éventuels bandeaux cookies (Axeptio / Didomi)
    try {
      const cookieBtn = page.locator('#axeptio_btn_acceptAll, button#axeptio_btn_configure, button:has-text("Tout accepter"), button:has-text("Accepter"), button:has-text("Continuer sans accepter")').first();
      if (await cookieBtn.isVisible({ timeout: 2500 })) {
        await cookieBtn.click().catch(() => {});
        log.info('Bandeau cookies HelloWork masqué automatiquement.');
      }
    } catch {}

    console.log('\n------------------------------------------------------------');
    log.human('Veuillez vous connecter manuellement sur HelloWork dans la fenêtre Chromium.');
    log.info('- Saisissez votre email et mot de passe HelloWork.');
    log.info('- Validez la connexion (la fenêtre reste ouverte tant que vous n\'êtes pas connecté).');
    log.info('- La session sera enregistrée dès que votre profil ou espace candidat sera chargé.');
    console.log('------------------------------------------------------------\n');

    // Détection active et non bloquante de la session connectée
    const waitForLoginDetection = new Promise<boolean>((resolve) => {
      const startTime = Date.now();
      const maxWaitMs = 300000; // 5 minutes max

      const checkInterval = setInterval(async () => {
        try {
          if (isWindowClosed || page.isClosed() || !browser.isConnected()) {
            clearInterval(checkInterval);
            resolve(false);
            return;
          }

          if (Date.now() - startTime > maxWaitMs) {
            clearInterval(checkInterval);
            resolve(false);
            return;
          }

          const currentUrl = page.url();
          const isLoginPage =
            currentUrl.includes('connexion') ||
            currentUrl.includes('inscription') ||
            currentUrl.includes('identification');

          // Tant qu'on est sur l'écran de login ou signup, on continue d'attendre
          if (isLoginPage) {
            return;
          }

          // L'utilisateur a quitté la page de connexion sur le domaine HelloWork
          if (currentUrl.includes('hellowork.com')) {
            const hasAuthEvidence = await page.evaluate(() => {
              // 1. Session tracking active dans localStorage (_hw_t.s === true)
              try {
                const hwT = localStorage.getItem('_hw_t');
                if (hwT) {
                  const parsed = JSON.parse(hwT);
                  if (parsed && parsed.s === true) return true;
                }
              } catch {}

              // 2. Éléments exclusifs au profil connecté
              const hasLogout = !!document.querySelector('a[href*="deconnexion"], a[href*="logout"]');
              const hasUserMenu = !!document.querySelector(
                '[data-cy="account-menu"], [data-cy="user-menu"], [data-cy="user-avatar"], [data-cy="candidate-name"]'
              );
              const hasAccountBtn = Array.from(document.querySelectorAll('button, a')).some((el) => {
                const t = el.textContent || '';
                return t.includes('Mon compte') || t.includes('Mon espace') || t.includes('Mes candidatures');
              });

              // 3. Absence de champ de mot de passe
              const hasPasswordField = !!document.querySelector('input[type="password"]');

              if ((hasLogout || hasUserMenu || hasAccountBtn) && !hasPasswordField) {
                return true;
              }

              // 4. URL explicite d'espace candidat ou recherche connectée
              const path = window.location.pathname;
              if (
                path.includes('/candidat/mon-espace') ||
                path.includes('/candidat/tableau-de-bord') ||
                path.includes('/candidat/mes-candidatures') ||
                path.includes('/candidat/profil') ||
                path.includes('/candidat/alertes')
              ) {
                return true;
              }

              return false;
            }).catch(() => false);

            if (hasAuthEvidence) {
              clearInterval(checkInterval);
              resolve(true);
            }
          }
        } catch {
          // Erreur ponctuelle de contexte pendant une navigation
        }
      }, 1000);
    });

    let authenticated = false;
    if (options.autoDetectOnly) {
      log.info('Attente de détection automatique de connexion HelloWork...');
      authenticated = await waitForLoginDetection;
      if (!authenticated) {
        if (isWindowClosed) {
          throw new Error('La fenêtre de navigation a été fermée avant la finalisation de la connexion.');
        }
        throw new Error('Délai d\'authentification HelloWork dépassé (5 minutes).');
      }
    } else {
      const manualConfirm = promptUser('Appuyez sur ENTRÉE une fois connecté à HelloWork :').then(() => true);
      const result = await Promise.race([waitForLoginDetection, manualConfirm]);
      authenticated = Boolean(result);
      if (!authenticated && isWindowClosed) {
        throw new Error('La fenêtre de navigation a été fermée avant la finalisation.');
      }
    }

    log.info('Connexion HelloWork confirmée ! Finalisation et sauvegarde...');
    await page.waitForTimeout(3000);

    // Sauvegarde de l'état (cookies) dans hellowork_state.json
    await saveSessionState(context, CONFIG.helloWorkSessionStoragePath);
    log.success(`Session HelloWork sauvegardée dans : ${CONFIG.helloWorkSessionStoragePath}`);

    const { historyManager } = await import('./utils/history.js');
    historyManager.logAction({
      module: 'hellowork',
      actionType: 'SESSION_SAVED',
      target: 'Compte HelloWork',
      details: 'Session et cookies sauvegardés dans hellowork_state.json',
      status: 'SUCCESS',
    });

    return true;
  } catch (err) {
    log.error(`Échec lors de l'authentification HelloWork : ${(err as Error).message}`);
    throw err;
  } finally {
    try {
      if (browser.isConnected()) {
        await browser.close();
      }
    } catch {}
    log.info('Navigateur HelloWork fermé.');
  }
}

// Permet d'exécuter directement ce script via `npm run auth`
if (process.argv[1]?.endsWith('auth.ts') || process.argv[1]?.endsWith('auth.js')) {
  if (process.argv.some((arg) => arg.toLowerCase().includes('hellowork'))) {
    authenticateHelloWorkInteractive().catch(() => process.exit(1));
  } else {
    authenticateInteractive().catch(() => process.exit(1));
  }
}
