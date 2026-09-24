import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import { CONFIG } from '../config.js';

// Enregistrement du plugin Stealth dans l'instance Playwright-extra
chromium.use(stealthPlugin());

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Initialise une session de navigation furtive (Stealth) avec Playwright.
 * - Désactive les drapeaux d'automatisation Chromium (navigator.webdriver, etc.).
 * - Charge la session sauvegardée (`state.json`) pour éviter de ressaisir les identifiants.
 * - Emule un écran et des entêtes réalistes.
 */
export async function createStealthBrowser(options: {
  headless?: boolean;
  useSession?: boolean;
  storagePath?: string;
} = {}): Promise<BrowserSession> {
  const isHeadless = options.headless !== undefined ? options.headless : CONFIG.headless;
  const useSession = options.useSession !== undefined ? options.useSession : true;
  const targetStoragePath = options.storagePath || CONFIG.sessionStoragePath;

  // Lancement du navigateur Chromium avec arguments anti-détection
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--disable-blink-features=AutomationControlled',
    '--start-maximized',
  ];

  let browser: Browser;
  try {
    browser = await chromium.launch({
      headless: isHeadless,
      args: launchArgs,
    });
  } catch (err) {
    try {
      // Fallback 1 : Google Chrome installé sur la machine
      browser = await chromium.launch({
        headless: isHeadless,
        args: launchArgs,
        channel: 'chrome',
      });
    } catch {
      // Fallback 2 : Microsoft Edge (natif sur 100% des postes Windows 10/11)
      browser = await chromium.launch({
        headless: isHeadless,
        args: launchArgs,
        channel: 'msedge',
      });
    }
  }

  const sessionExists = fs.existsSync(targetStoragePath);
  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    permissions: ['geolocation'],
    geolocation: { latitude: 48.8566, longitude: 2.3522 }, // Paris
    colorScheme: 'light',
  };

  if (useSession && sessionExists) {
    contextOptions.storageState = targetStoragePath;
  }

  const context = await browser.newContext(contextOptions);

  // Masquage supplémentaire du protocole d'automatisation
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  const page = await context.newPage();

  // Définition d'un timeout par défaut raisonnable
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);

  return { browser, context, page };
}

/**
 * Sauvegarde l'état courant de la session (cookies, localStorage) dans le fichier cible
 */
export async function saveSessionState(context: BrowserContext, targetPath?: string): Promise<void> {
  const filePath = targetPath || CONFIG.sessionStoragePath;
  await context.storageState({ path: filePath });
}
