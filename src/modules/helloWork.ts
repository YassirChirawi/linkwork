import { Page, Locator } from 'playwright';
import fs from 'fs';
import { CONFIG } from '../config.js';
import { createStealthBrowser } from '../utils/browser.js';
import { humanDelay, humanScroll, humanMoveAndClick, humanType } from '../utils/humanize.js';
import { log } from '../utils/cli.js';
import { historyManager } from '../utils/history.js';
import { JobScorer } from '../utils/jobScorer.js';
import { SmartFormSolver } from '../utils/formSolver.js';

export interface HelloWorkStats {
  scanned: number;
  applied: number;
  skipped: number;
  failed: number;
}

export interface HelloWorkRunOptions {
  keywords?: string;
  location?: string;
  contractType?: string;
  maxApply?: number;
}

/**
 * Module d'automatisation des candidatures sur HelloWork.
 * - Filtre les offres CDI pertinentes (Java / React / Full Stack)
 * - Élimine automatiquement les stages, alternances et technologies hors-cible
 * - Priorise les offres à "Candidature simplifiée" (1 clic)
 * - Injecte automatiquement le pitch de motivation et le CV PDF de Yassir
 */
export class HelloWorkModule {
  private page!: Page;
  private options: HelloWorkRunOptions;
  private stats: HelloWorkStats = {
    scanned: 0,
    applied: 0,
    skipped: 0,
    failed: 0,
  };

  constructor(page?: Page, options: HelloWorkRunOptions = {}) {
    if (page) this.page = page;
    this.options = {
      keywords: options.keywords || CONFIG.helloWork.keywords,
      location: options.location || CONFIG.helloWork.location,
      contractType: options.contractType || 'CDI',
      maxApply: options.maxApply || CONFIG.helloWork.quotas.maxApplyPerSession,
    };
  }

  /**
   * Lance la session de candidature HelloWork.
   */
  public async run(): Promise<HelloWorkStats> {
    log.step('Démarrage du Module Candidatures HelloWork...');
    log.info(`Recherche ciblée : "${this.options.keywords}" à "${this.options.location}" (Contrat: ${this.options.contractType})`);

    let browserInstance = null;
    if (!this.page) {
      log.info('Lancement du navigateur Chromium furtif pour HelloWork...');
      const session = await createStealthBrowser({
        headless: CONFIG.headless,
        storagePath: CONFIG.helloWorkSessionStoragePath,
      });
      this.page = session.page;
      browserInstance = session.browser;
    }

    try {
      const searchUrl = `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${encodeURIComponent(
        this.options.keywords || ''
      )}&l=${encodeURIComponent(this.options.location || '')}&c=${encodeURIComponent(this.options.contractType || 'CDI')}`;

      log.info(`Navigation vers HelloWork : ${searchUrl}`);
      await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);

      // Fermeture des éventuels bandeaux cookies HelloWork (Axeptio / Didomi)
      await this.dismissCookieBanner();

      // Défilement pour charger la liste des offres
      await humanScroll(this.page, { totalDistance: 800, scrollSteps: 6 });

      const offerCards = await this.page.locator(CONFIG.selectors.helloWork.offerCard).all();
      log.info(`Offres détectées sur la page HelloWork : ${offerCards.length}`);

      const maxApplications = this.options.maxApply || 15;
      let currentPage = 1;
      const maxPages = 5;

      while (this.stats.applied < maxApplications && currentPage <= maxPages) {
        log.info(`--- HelloWork : Analyse de la Page ${currentPage} ---`);
        await humanScroll(this.page, { totalDistance: 800, scrollSteps: 6 });

        const offerCards = await this.page.locator(CONFIG.selectors.helloWork.offerCard).all();
        log.info(`Offres détectées sur la page ${currentPage} HelloWork : ${offerCards.length}`);

        if (offerCards.length === 0) {
          log.warn(`Aucune offre trouvée sur la page ${currentPage}. Fin du scan.`);
          break;
        }

        for (let i = 0; i < offerCards.length; i++) {
          if (this.stats.applied >= maxApplications) {
            log.success(`Quota de candidatures HelloWork atteint (${this.stats.applied} envoyées).`);
            break;
          }

          const card = offerCards[i];
          await this.processOfferCard(card, i + 1);

          // Délai de précaution entre les candidatures
          await humanDelay(CONFIG.delays.betweenApplications.min, CONFIG.delays.betweenApplications.max);
        }

        if (this.stats.applied >= maxApplications) break;

        // Tenter de naviguer vers la page suivante
        const nextPageBtn = this.page.locator(
          'a[aria-label="Page suivante"], a[data-cy="next-page"], .pagination a:has-text("Suivant"), a.cr-pagination-next, button:has-text("Afficher plus d\'offres")'
        ).first();

        const hasNext = await nextPageBtn.isVisible({ timeout: 2500 }).catch(() => false);
        if (hasNext) {
          log.info(`Navigation vers la page ${currentPage + 1} HelloWork...`);
          await humanMoveAndClick(this.page, nextPageBtn);
          await humanDelay(2000, 4000);
          currentPage++;
        } else {
          log.info('Dernière page de résultats HelloWork atteinte.');
          break;
        }
      }
    } catch (err) {
      log.error(`Erreur critique dans le module HelloWork : ${(err as Error).message}`);
    } finally {
      if (browserInstance) {
        await browserInstance.close();
        log.info('Navigateur HelloWork fermé.');
      }
    }

    log.step('Bilan de la session Candidatures HelloWork :');
    console.table(this.stats);
    return this.stats;
  }

  /**
   * Traite une carte d'offre d'emploi sur HelloWork.
   */
  private async processOfferCard(cardLocator: Locator, index: number): Promise<void> {
    this.stats.scanned++;

    try {
      await cardLocator.scrollIntoViewIfNeeded();
      await humanDelay(500, 1200);

      // 1. Extraction des métadonnées de l'offre
      const titleEl = cardLocator.locator(CONFIG.selectors.helloWork.offerTitle).first();
      const jobTitle = (await titleEl.innerText().catch(() => '')).trim();

      const companyEl = cardLocator.locator(CONFIG.selectors.helloWork.companyName).first();
      const companyName = (await companyEl.innerText().catch(() => 'Entreprise')).trim();

      log.info(`[Offre HelloWork #${index}] "${jobTitle}" chez ${companyName}`);

      // 2. Filtrage haute précision JobScorer
      const qualification = this.shouldApplyToJob(jobTitle, companyName);
      if (!qualification.shouldApply) {
        log.warn(`[JobScorer HelloWork] Offre rejetée [Score: ${qualification.score}/100] : "${jobTitle}" (${qualification.reason})`);
        this.stats.skipped++;
        historyManager.logAction({
          module: 'hellowork',
          actionType: 'APPLICATION_SKIPPED',
          target: jobTitle,
          company: companyName,
          details: `Rejet JobScorer (${qualification.score}/100) : ${qualification.reason}`,
          status: 'SKIPPED',
        });
        return;
      }

      log.success(
        `[JobScorer HelloWork] Offre qualifiée [Score: ${qualification.score}/100] : "${jobTitle}" chez ${companyName} (${qualification.keywords?.join(', ') || 'Match'})`
      );

      // 3. Détection du bouton "Postuler"
      const applyBtn = cardLocator.locator(CONFIG.selectors.helloWork.applyButton).first();
      const isApplyVisible = await applyBtn.isVisible({ timeout: 2500 }).catch(() => false);

      if (!isApplyVisible) {
        log.info(`Bouton Postuler non présent directement sur l'offre #${index}. Saut.`);
        this.stats.skipped++;
        return;
      }

      // 4. Clic sur Postuler
      log.human(`Ouverture de la candidature pour "${jobTitle}"...`);
      await humanMoveAndClick(this.page, applyBtn);
      await humanDelay(1500, 3000);

      // 5. Résolution du formulaire de candidature HelloWork
      const success = await this.resolveApplicationForm(jobTitle, companyName);
      if (success) {
        this.stats.applied++;
        log.success(`Candidature HelloWork envoyée avec succès pour "${jobTitle}" chez ${companyName} !`);
        historyManager.logAction({
          module: 'hellowork',
          actionType: 'APPLICATION_SENT',
          target: jobTitle,
          company: companyName,
          details: 'Candidature simplifiée HelloWork envoyée avec CV et pitch',
          status: 'SUCCESS',
        });
      } else {
        this.stats.failed++;
      }
    } catch (err) {
      log.warn(`Erreur lors du traitement de l'offre #${index} : ${(err as Error).message}`);
      this.stats.failed++;
    }
  }

  /**
   * Remplissage automatique du formulaire de candidature HelloWork (Champs profil, Pitch, CV, multi-étapes).
   */
  private async resolveApplicationForm(jobTitle: string, companyName: string): Promise<boolean> {
    try {
      // 1. Remplissage des coordonnées candidat si demandées
      const firstNameInput = this.page.locator('input[name*="first" i], input[id*="first" i], input[autocomplete="given-name"]').first();
      if (await firstNameInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        const val = await firstNameInput.inputValue().catch(() => '');
        if (!val) await humanType(this.page, firstNameInput, CONFIG.candidate.firstName);
      }

      const lastNameInput = this.page.locator('input[name*="last" i], input[id*="last" i], input[autocomplete="family-name"]').first();
      if (await lastNameInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        const val = await lastNameInput.inputValue().catch(() => '');
        if (!val) await humanType(this.page, lastNameInput, CONFIG.candidate.lastName);
      }

      const emailInput = this.page.locator('input[type="email"], input[name*="mail" i]').first();
      if (await emailInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        const val = await emailInput.inputValue().catch(() => '');
        if (!val) await humanType(this.page, emailInput, CONFIG.candidate.email);
      }

      const phoneInput = this.page.locator('input[type="tel"], input[name*="phone" i], input[name*="tel" i]').first();
      if (await phoneInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        const val = await phoneInput.inputValue().catch(() => '');
        if (!val) await humanType(this.page, phoneInput, CONFIG.candidate.phone);
      }

      // 2. Vérifier si un champ de motivation/message est présent
      const motivationTextarea = this.page.locator(CONFIG.selectors.helloWork.motivationInput).first();
      if (await motivationTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        log.human('Injection du pitch de motivation candidat...');
        await humanType(this.page, motivationTextarea, CONFIG.candidate.summaryPitch);
        await humanDelay(800, 1600);
      }

      // 3. Téléversement du CV si requis
      const fileInput = this.page.locator('input[type="file"]').first();
      if (await fileInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        if (fs.existsSync(CONFIG.candidate.resumePath)) {
          log.human(`Téléversement du CV : ${CONFIG.candidate.resumePath}`);
          await fileInput.setInputFiles(CONFIG.candidate.resumePath);
          await humanDelay(1000, 2000);
        }
      }

      // 3b. Coche automatique des cases requises (RGPD / Traitement)
      await SmartFormSolver.solveCheckboxes(this.page.locator('body'));

      // 4. Étape intermédiaire éventuelle ("Suivant" / "Continuer")
      const nextStepBtn = this.page.locator('button:has-text("Continuer"), button:has-text("Suivant"), button:has-text("Étape suivante")').first();
      if (await nextStepBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await humanMoveAndClick(this.page, nextStepBtn);
        await humanDelay(1500, 2500);
      }

      // 5. Bouton de confirmation finale de la candidature
      const confirmBtn = this.page.locator(CONFIG.selectors.helloWork.confirmButton).first();
      if (await confirmBtn.isVisible({ timeout: 3500 }).catch(() => false)) {
        log.human('Validation finale de la candidature HelloWork...');
        await humanMoveAndClick(this.page, confirmBtn);
        await humanDelay(2000, 4000);
        return true;
      }

      // Si le clic initial a directement confirmé (candidature 1-clic native sans étape intermédiaire)
      return true;
    } catch (err) {
      log.warn(`Échec de résolution du formulaire : ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Filtre haute précision JobScorer pour les offres HelloWork.
   */
  private shouldApplyToJob(title: string, company: string, snippet: string = ''): { shouldApply: boolean; score: number; reason?: string; keywords?: string[] } {
    const evalResult = JobScorer.evaluateJob(title, company, snippet);
    return {
      shouldApply: evalResult.isMatch,
      score: evalResult.score,
      reason: evalResult.reasons.join(', '),
      keywords: evalResult.matchedKeywords,
    };
  }

  /**
   * Ferme les bannières cookies HelloWork
   */
  private async dismissCookieBanner(): Promise<void> {
    try {
      const acceptBtn = this.page.locator(
        'button#axeptio_btn_acceptAll, button#didomi-notice-agree-button, button:has-text("Tout accepter"), button:has-text("Accepter")'
      ).first();
      if (await acceptBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await acceptBtn.click();
        await humanDelay(500, 1000);
      }
    } catch {
      // Silencieux
    }
  }
}

// Exécution autonome
if (process.argv[1]?.endsWith('helloWork.ts') || process.argv[1]?.endsWith('helloWork.js')) {
  new HelloWorkModule().run().catch(() => process.exit(1));
}
