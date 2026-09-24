import { Page } from 'playwright';
import { CONFIG } from '../config.js';
import { createStealthBrowser } from '../utils/browser.js';
import { humanDelay, humanType, humanScroll, humanMoveAndClick } from '../utils/humanize.js';
import { log } from '../utils/cli.js';
import { historyManager } from '../utils/history.js';
import { aiGenerator } from '../utils/aiGenerator.js';

export interface NetworkingStats {
  visited: number;
  invited: number;
  skipped: number;
  failed: number;
}

export interface NetworkingOptions {
  targetCategory?: 'talent_acquisition' | 'general' | 'tech_leads';
  customQuery?: string;
  withNote?: boolean;
}

/**
 * Module Réseautage & Job Hunting ciblé (Recruteurs IT, Talent Acquisition, CTO).
 */
export class NetworkingModule {
  private page!: Page;
  private options: NetworkingOptions;
  private stats: NetworkingStats = {
    visited: 0,
    invited: 0,
    skipped: 0,
    failed: 0,
  };

  constructor(page?: Page, options: NetworkingOptions = {}) {
    if (page) this.page = page;
    this.options = {
      targetCategory: options.targetCategory || 'general',
      customQuery: options.customQuery,
      withNote: options.withNote !== undefined ? options.withNote : true,
    };
  }

  /**
   * Lance le processus de réseautage sur une liste d'URLs de profils ou de recherches.
   */
  public async run(targetUrls?: string[]): Promise<NetworkingStats> {
    const isRecruiterMode = this.options.targetCategory === 'talent_acquisition';
    log.step(
      isRecruiterMode
        ? 'Démarrage du Module Réseautage Recruteurs & Talent Acquisition (France)...'
        : 'Démarrage du Module Réseautage (Job Hunting)...'
    );

    let browserInstance = null;
    if (!this.page) {
      log.info('Lancement de la session furtive...');
      const session = await createStealthBrowser({ headless: CONFIG.headless });
      this.page = session.page;
      browserInstance = session.browser;
    }

    try {
      // Si aucune URL directe n'est fournie, effectuer une recherche par mots-clés
      const urlsToProcess = targetUrls && targetUrls.length > 0
        ? targetUrls
        : await this.discoverProfileUrlsFromSearch();

      log.info(`Nombre de cibles à traiter : ${urlsToProcess.length}`);

      for (const url of urlsToProcess) {
        if (this.stats.invited >= CONFIG.quotas.maxNetworkingPerSession) {
          log.success(`Quota de réseautage atteint : ${this.stats.invited} invitations envoyées !`);
          break;
        }

        const defaultNote = isRecruiterMode
          ? CONFIG.networking.recruiterNoteTemplate
          : CONFIG.networking.defaultNoteTemplate;

        await this.processProfile(url, {
          customNote: this.options.withNote ? defaultNote : '',
        });

        // Délai aléatoire gaussien entre deux visites de profils
        await humanDelay(
          CONFIG.delays.betweenApplications.min,
          CONFIG.delays.betweenApplications.max
        );
      }
    } catch (err) {
      log.error(`Erreur critique dans le module Réseautage : ${(err as Error).message}`);
    } finally {
      if (browserInstance) {
        await browserInstance.close();
        log.info('Navigateur fermé.');
      }
    }

    log.step('Bilan de la session Réseautage :');
    console.table(this.stats);
    return this.stats;
  }

  /**
   * Trouve des profils pertinents via la recherche LinkedIn People.
   */
  private async discoverProfileUrlsFromSearch(): Promise<string[]> {
    let searchUrl: string;

    if (this.options.customQuery) {
      searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(this.options.customQuery)}&origin=GLOBAL_SEARCH_HEADER`;
    } else if (this.options.targetCategory === 'talent_acquisition') {
      const recruiterQuery = '("Talent Acquisition" OR "Recruteur Tech" OR "Chargé de recrutement" OR "Responsable RH") AND France';
      searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(recruiterQuery)}&origin=GLOBAL_SEARCH_HEADER`;
      log.info(`Recherche Ciblée Recruteurs RH & Talent Acquisition : "${recruiterQuery}"...`);
    } else {
      const keyword = CONFIG.networking.searchKeywords[0] || 'Tech Recruiter';
      searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}&origin=GLOBAL_SEARCH_HEADER`;
      log.info(`Recherche de profils cibles : "${keyword}"...`);
    }
    await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);
    await humanScroll(this.page, { totalDistance: 600, scrollSteps: 4 });

    // Extraction des liens de profils dans la page de recherche
    const profileLinks = await this.page.locator('.entity-result__title-text a.app-aware-link').all();
    const discoveredUrls: string[] = [];

    for (const link of profileLinks) {
      const href = await link.getAttribute('href');
      if (href && href.includes('/in/') && !href.includes('miniProfile')) {
        const cleanUrl = href.split('?')[0];
        if (!discoveredUrls.includes(cleanUrl)) {
          discoveredUrls.push(cleanUrl);
        }
      }
    }

    return discoveredUrls.slice(0, CONFIG.quotas.maxNetworkingPerSession * 2);
  }

  /**
   * Visite un profil, simule une lecture humaine, et tente l'invitation.
   */
  public async processProfile(profileUrl: string, options: { customNote?: string } = {}): Promise<boolean> {
    this.stats.visited++;
    log.info(`[Profil #${this.stats.visited}] Visite de : ${profileUrl}`);

    try {
      await this.page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
      await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);

      // 1. Simulation d'attention visuelle : Défilement et pause de lecture
      log.human('Lecture simulée du profil (scrolling et micro-pauses)...');
      await humanScroll(this.page, { totalDistance: 500, scrollSteps: 5 });

      // Extraction du nom et du titre pour personnalisation de la note
      const nameHeading = this.page.locator('h1.text-heading-xlarge, h1.v-align-middle').first();
      const fullName = (await nameHeading.innerText().catch(() => '')).trim();
      const firstName = fullName.split(' ')[0] || 'Bonjour';

      const headlineEl = this.page.locator('div.text-body-medium.break-words, div[data-generated-suggestion-target]').first();
      const headline = (await headlineEl.innerText().catch(() => '')).trim();

      log.info(`Profil identifié : "${fullName}" (Headline : "${headline.slice(0, 45)}...")`);

      // 2. Vérification de l'état actuel de connexion
      const alreadyPendingOrConnected = await this.page
        .locator('button:has-text("En attente"), button:has-text("Pending"), button:has-text("Message")')
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      const connectBtn = await this.findConnectButton();

      if (!connectBtn) {
        log.info(`Déjà connecté, en attente ou invitation restreinte pour "${fullName}". Saut.`);
        this.stats.skipped++;
        return false;
      }

      // 3. Clic sur "Se connecter"
      log.human(`Clic sur "Se connecter" pour ${fullName}...`);
      await humanMoveAndClick(this.page, connectBtn);
      await humanDelay(1200, 2500);

      // 4. Génération de la note (soit customNote fournie, soit IA contextuelle)
      let finalNote = options.customNote;
      if (!finalNote && CONFIG.networking.useAI) {
        const aiResult = await aiGenerator.generateContent({
          postText: headline,
          authorName: fullName,
          authorHeadline: headline,
          context: 'job_hunting',
        });
        finalNote = aiResult.inviteNote;
      }

      await this.handleInviteModal(firstName, finalNote);

      this.stats.invited++;
      log.success(`Invitation envoyée avec succès à ${fullName} !`);

      historyManager.logAction({
        module: 'networking',
        actionType: 'INVITATION_SENT',
        target: fullName,
        details: finalNote ? `Note personnalisée : "${finalNote.slice(0, 60)}..."` : 'Invitation sans note',
        status: 'SUCCESS',
      });

      return true;
    } catch (err) {
      log.error(`Échec lors du traitement du profil ${profileUrl} : ${(err as Error).message}`);
      this.stats.failed++;
      return false;
    }
  }

  /**
   * Trouve le bouton "Se connecter", y compris s'il est masqué dans le menu déroulant "Plus".
   */
  private async findConnectButton() {
    // Cas 1 : Bouton "Se connecter" directement visible dans l'en-tête du profil
    const directConnect = this.page.locator('button:has-text("Se connecter"), button:has-text("Connect")').first();
    if (await directConnect.isVisible({ timeout: 2500 }).catch(() => false)) {
      return directConnect;
    }

    // Cas 2 : Bouton masqué dans le menu "Plus / More"
    const moreBtn = this.page.locator('button[aria-label*="Plus d\'actions"], div.pvs-profile-actions button:has-text("Plus"), div.pvs-profile-actions button:has-text("More")').first();
    if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      log.human('Bouton "Se connecter" non direct : ouverture du menu "Plus"...');
      await humanMoveAndClick(this.page, moreBtn);
      await humanDelay(600, 1200);

      const dropdownConnect = this.page.locator('div[role="button"]:has-text("Se connecter"), div[role="button"]:has-text("Connect"), span:has-text("Se connecter")').first();
      if (await dropdownConnect.isVisible({ timeout: 2000 }).catch(() => false)) {
        return dropdownConnect;
      }
    }

    return null;
  }

  /**
   * Gère la modale d'invitation (ajout de note personnalisée ou envoi direct).
   */
  private async handleInviteModal(firstName: string, customNote?: string): Promise<void> {
    const modal = this.page.locator('div[role="dialog"]').first();
    const isModalVisible = await modal.isVisible({ timeout: 4000 }).catch(() => false);

    if (!isModalVisible) return;

    // Détection du bouton "Ajouter une note"
    const addNoteBtn = modal.locator(CONFIG.selectors.networking.addNoteButton).first();
    const canAddNote = await addNoteBtn.isVisible({ timeout: 2000 }).catch(() => false);

    const noteTemplate = customNote;

    if (canAddNote && noteTemplate) {
      log.human('Ajout d\'une note personnalisée d\'invitation...');
      await humanMoveAndClick(this.page, addNoteBtn);
      await humanDelay(800, 1500);

      // Génération du texte avec variable {{firstName}} si non déjà remplacé
      let note = noteTemplate.replace(/\{\{firstName\}\}/g, firstName);
      // Tronquer impérativement à moins de 295 caractères (contrainte stricte LinkedIn)
      if (note.length > 290) {
        note = note.slice(0, 287).trim() + '...';
      }

      const textarea = modal.locator(CONFIG.selectors.networking.noteTextarea).first();
      await humanType(this.page, textarea, note);
      await humanDelay(600, 1200);
    } else {
      log.info('Envoi direct de l\'invitation (sans note jointe)...');
      const sendWithoutNote = modal.locator('button[aria-label*="Envoyer sans note"], button:has-text("Envoyer sans note"), button:has-text("Send without a note")').first();
      if (await sendWithoutNote.isVisible({ timeout: 1500 }).catch(() => false)) {
        await humanMoveAndClick(this.page, sendWithoutNote);
        await humanDelay(1000, 2000);
        return;
      }
    }

    // Clic final sur "Envoyer" ou "Envoyer sans note"
    const sendBtn = modal.locator(CONFIG.selectors.networking.sendButton).first();
    if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await humanMoveAndClick(this.page, sendBtn);
      await humanDelay(1500, 2500);
    }
  }
}

// Exécution autonome
if (process.argv[1]?.endsWith('networking.ts') || process.argv[1]?.endsWith('networking.js')) {
  new NetworkingModule().run().catch(() => process.exit(1));
}
