import { Page, Locator } from 'playwright';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { createStealthBrowser } from '../utils/browser.js';
import { humanDelay, humanType, humanScroll, humanMoveAndClick } from '../utils/humanize.js';
import { log, promptSemiAutoChoice, SemiAutoDecision } from '../utils/cli.js';
import { historyManager } from '../utils/history.js';
import { JobScorer } from '../utils/jobScorer.js';
import { SmartFormSolver } from '../utils/formSolver.js';

export interface EasyApplyStats {
  scanned: number;
  applied: number;
  skipped: number;
  failed: number;
}

/**
 * Module d'automatisation des candidatures simplifiées (Easy Apply).
 */
export class EasyApplyModule {
  private page!: Page;
  private stats: EasyApplyStats = {
    scanned: 0,
    applied: 0,
    skipped: 0,
    failed: 0,
  };

  constructor(page?: Page) {
    if (page) this.page = page;
  }

  /**
   * Point d'entrée principal du module Easy Apply.
   */
  public async run(): Promise<EasyApplyStats> {
    log.step('Démarrage du Module Candidatures (Easy Apply)...');

    // Vérification préalable de la présence du CV
    this.verifyResumeFile();

    // Initialisation du navigateur si non injecté
    let browserInstance = null;
    if (!this.page) {
      log.info('Lancement de la session furtive...');
      const session = await createStealthBrowser({ headless: CONFIG.headless });
      this.page = session.page;
      browserInstance = session.browser;
    }

    try {
      // 1. Navigation vers la recherche d'emploi filtrée Easy Apply
      await this.navigateToJobSearch();

      // 2. Parcourt les pages et les offres
      let hasMoreJobs = true;
      let currentPage = 1;

      while (hasMoreJobs && this.stats.applied < CONFIG.quotas.maxEasyApplyPerSession) {
        log.info(`Analyse de la page de résultats n°${currentPage}...`);
        await humanScroll(this.page, { totalDistance: 800, scrollSteps: 6 });

        const cards = await this.getJobCards();
        log.info(`Nombre d'offres détectées sur cette page : ${cards.length}`);

        for (let i = 0; i < cards.length; i++) {
          if (this.stats.applied >= CONFIG.quotas.maxEasyApplyPerSession) {
            log.success(`Quota de session atteint : ${this.stats.applied} candidatures envoyées !`);
            break;
          }

          const card = cards[i];
          const shouldContinue = await this.processJobCard(card, i + 1);

          if (shouldContinue === 'abort') {
            log.warn('Arrêt de la session demandé par l\'utilisateur.');
            return this.stats;
          }

          // Pause humaine réaliste entre deux offres
          await humanDelay(
            CONFIG.delays.betweenApplications.min,
            CONFIG.delays.betweenApplications.max
          );
        }

        if (this.stats.applied >= CONFIG.quotas.maxEasyApplyPerSession) break;

        // Tenter de passer à la page suivante
        hasMoreJobs = await this.goToNextPage();
        currentPage++;
      }
    } catch (err) {
      log.error(`Erreur critique dans le module Easy Apply : ${(err as Error).message}`);
    } finally {
      if (browserInstance) {
        await browserInstance.close();
        log.info('Navigateur fermé.');
      }
    }

    log.step('Bilan de la session Easy Apply :');
    console.table(this.stats);
    return this.stats;
  }

  /**
   * Vérifie que le fichier CV existe sur le disque.
   */
  private verifyResumeFile(): void {
    const resumePath = path.resolve(CONFIG.candidate.resumePath);
    if (!fs.existsSync(resumePath)) {
      log.warn(`Fichier CV introuvable à l'adresse : ${resumePath}`);
      log.info('Si une offre requiert un téléversement de CV, le mode semi-auto s\'activera.');
    } else {
      log.info(`Fichier CV local vérifié : ${resumePath}`);
    }
  }

  /**
   * Navigue vers l'URL de recherche d'emploi avec filtre Easy Apply.
   */
  private async navigateToJobSearch(): Promise<void> {
    const baseUrl = 'https://www.linkedin.com/jobs/search/';
    const params = new URLSearchParams({
      keywords: CONFIG.jobSearch.keywords,
      location: CONFIG.jobSearch.location,
      f_AL: 'true', // Filtre Candidature simplifiée uniquement
      sortBy: 'R', // Pertinence
    });

    const url = `${baseUrl}?${params.toString()}`;
    log.info(`Navigation vers : ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);
  }

  /**
   * Récupère la liste des cartes d'offres visibles.
   */
  private async getJobCards(): Promise<Locator[]> {
    const cardSelector = CONFIG.selectors.easyApply.jobCard;
    await this.page.waitForSelector(cardSelector, { timeout: 15000 }).catch(() => null);
    return await this.page.locator(cardSelector).all();
  }

  /**
   * Évalue si une offre d'emploi est éligible avec le JobScorer (haute précision).
   */
  private shouldApplyToJob(jobTitle: string, company: string, snippet: string = ''): { ok: boolean; score: number; reason?: string; keywords?: string[] } {
    const evalResult = JobScorer.evaluateJob(jobTitle, company, snippet);
    return {
      ok: evalResult.isMatch,
      score: evalResult.score,
      reason: evalResult.reasons.join(', '),
      keywords: evalResult.matchedKeywords,
    };
  }

  /**
   * Détecte et nettoie toute modale résiduelle (confirmation d'abandon, dialogue de succès, overlay Artdeco)
   * pour éviter que le curseur ne soit intercepté lors du clic sur les offres suivantes.
   */
  private async cleanLingeringModals(forceRemove: boolean = false): Promise<void> {
    try {
      // 1. Bouton de confirmation d'abandon si dialogue ouvert ("Ignorer", "Discard", "Abandonner", "Supprimer")
      const discardBtns = this.page.locator(CONFIG.selectors.easyApply.confirmDiscardButton);
      if (await discardBtns.first().isVisible({ timeout: 800 }).catch(() => false)) {
        log.info('[CleanModal] Fermeture de la boîte de dialogue de confirmation d\'abandon...');
        await discardBtns.first().click({ force: true }).catch(() => null);
        await humanDelay(300, 600);
      }

      // 2. Boutons de fin / succès de candidature ("Terminé", "Done", "OK", "Fermer")
      const doneBtns = this.page.locator(
        'button:has-text("Terminé"), button:has-text("Done"), button:has-text("OK"), button.artdeco-modal__dismiss, button[data-test-modal-close-btn], button[aria-label*="Fermer la boîte de dialogue"], button[aria-label*="Fermer"], button[aria-label*="Dismiss"], button[aria-label*="Close"]'
      );
      if (await doneBtns.first().isVisible({ timeout: 800 }).catch(() => false)) {
        log.info('[CleanModal] Fermeture de la modale active...');
        await doneBtns.first().click({ force: true }).catch(() => null);
        await humanDelay(300, 600);
      }

      // 3. Si un overlay bloque encore, double pression sur Échap
      const hasOverlay = await this.page.locator('.artdeco-modal-overlay, #artdeco-modal-outlet .artdeco-modal').first().isVisible().catch(() => false);
      if (hasOverlay) {
        await this.page.keyboard.press('Escape');
        await humanDelay(250, 500);
        await this.page.keyboard.press('Escape');
        await humanDelay(250, 500);
      }

      // 4. Si nettoyage forcé ou si l'overlay persiste, neutralisation directe par injection JS
      if (forceRemove || await this.page.locator('.artdeco-modal-overlay, #artdeco-modal-outlet .artdeco-modal').first().isVisible().catch(() => false)) {
        await this.page.evaluate(() => {
          const overlays = document.querySelectorAll('.artdeco-modal-overlay, #artdeco-modal-outlet');
          overlays.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
            (el as HTMLElement).style.pointerEvents = 'none';
          });
        }).catch(() => null);
      }
    } catch {
      // Ignorer les erreurs mineures lors du nettoyage
    }
  }

  /**
   * Clic sécurisé sur une carte d'offre avec récupération automatique contre les overlays bloquants.
   */
  private async safeClickJobCard(cardLocator: Locator, clickableTarget: Locator): Promise<void> {
    const isTargetVisible = await clickableTarget.isVisible({ timeout: 1500 }).catch(() => false);
    const target = isTargetVisible ? clickableTarget : cardLocator;

    try {
      // Tentative de clic standard réactive (max 4 secondes, jamais de blocage 20s)
      await target.click({ timeout: 4000 });
    } catch (err) {
      log.warn('[AutoRecovery] Clic standard intercepté par un overlay, nettoyage forcé et réessai immédiat...');
      await this.cleanLingeringModals(true);
      await humanDelay(300, 600);

      try {
        // Tentative avec clic forcé
        await target.click({ force: true, timeout: 3000 });
      } catch {
        // Ultime recours : clic natif dispatché via JavaScript
        await target.evaluate((el: HTMLElement) => el.click()).catch(async () => {
          await cardLocator.evaluate((el: HTMLElement) => el.click()).catch(() => null);
        });
      }
    }
  }

  /**
   * Traite une carte d'offre individuelle.
   */
  private async processJobCard(cardLocator: Locator, index: number): Promise<'continue' | 'abort'> {
    this.stats.scanned++;

    try {
      // 0. Nettoyage préventif des modales résiduelles d'offres précédentes
      await this.cleanLingeringModals();

      // Défilement vers la carte pour visibilité naturelle
      await cardLocator.scrollIntoViewIfNeeded().catch(() => null);
      await humanDelay(400, 900);

      // Titre et entreprise de l'offre
      const titleElement = cardLocator.locator('.job-card-list__title, .artdeco-entity-lockup__title');
      const jobTitle = (await titleElement.innerText().catch(() => 'Offre sans titre')).trim();

      const companyElement = cardLocator.locator('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle');
      const company = (await companyElement.innerText().catch(() => '')).trim();

      // Extraction snippet ou aperçu sur la carte si présent
      const snippetEl = cardLocator.locator('.job-card-list__insight, .job-card-container__snippet, .job-card-list__footer-wrapper').first();
      const snippetText = (await snippetEl.innerText().catch(() => '')).trim();

      log.info(`[Offre #${index}] Examen de : "${jobTitle}" chez "${company || 'Non précisé'}"`);

      // Vérification haute précision JobScorer
      const filterResult = this.shouldApplyToJob(jobTitle, company, snippetText);
      if (!filterResult.ok) {
        log.warn(`[JobScorer] Offre rejetée [Score: ${filterResult.score}/100] : "${jobTitle}" (${filterResult.reason})`);
        this.stats.skipped++;
        historyManager.logAction({
          module: 'easy_apply',
          actionType: 'APPLICATION_SKIPPED',
          target: `${jobTitle} @ ${company || 'Non précisé'}`,
          details: `Rejet JobScorer (${filterResult.score}/100) : ${filterResult.reason}`,
          status: 'SKIPPED',
        });
        return 'continue';
      }

      log.success(
        `[JobScorer] Offre qualifiée [Score: ${filterResult.score}/100] : "${jobTitle}" chez "${company}" (${filterResult.keywords?.join(', ') || 'Match'})`
      );

      // Vérifier si déjà postulé
      const isAlreadyApplied = await cardLocator
        .locator('text=/Candidature envoyée|Postulé|Applied/i')
        .isVisible()
        .catch(() => false);

      if (isAlreadyApplied) {
        log.info(`Offre déjà postulée précédemment : "${jobTitle}". Saut.`);
        this.stats.skipped++;
        return 'continue';
      }

      // Clic résilient sur l'offre pour charger le volet de détails à droite
      const clickableTarget = cardLocator.locator('.job-card-list__title, a.job-card-container__link, a[data-control-id]').first();
      await this.safeClickJobCard(cardLocator, clickableTarget);
      await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);

      // Recherche du bouton "Candidature simplifiée" dans le volet détaillé de droite
      const detailsContainer = this.page.locator(
        '.jobs-search__job-details, .job-view-layout, .jobs-details, div.job-details-jobs-unified-top-card__container, div[data-view-name="job-details"]'
      ).first();

      let applyBtn = detailsContainer.locator(CONFIG.selectors.easyApply.easyApplyButton).first();
      let isApplyVisible = await applyBtn.isVisible({ timeout: 3500 }).catch(() => false);

      // Fallback si non trouvé dans le volet restreint
      if (!isApplyVisible) {
        applyBtn = this.page.locator(CONFIG.selectors.easyApply.easyApplyButton).first();
        isApplyVisible = await applyBtn.isVisible({ timeout: 2500 }).catch(() => false);
      }

      if (!isApplyVisible) {
        log.info(`Pas de bouton Candidature simplifiée pour : "${jobTitle}". Saut.`);
        this.stats.skipped++;
        return 'continue';
      }

      log.human(`Clic sur "Candidature simplifiée" pour : "${jobTitle}"`);
      await applyBtn.scrollIntoViewIfNeeded().catch(() => null);
      await humanDelay(300, 700);

      // Déclencher le clic avec Playwright natif et gestion des overlays résiduels
      try {
        await applyBtn.click({ timeout: 5000 });
      } catch {
        await this.cleanLingeringModals(true);
        await humanDelay(200, 500);
        try {
          await applyBtn.click({ force: true, timeout: 3000 });
        } catch {
          await humanMoveAndClick(this.page, applyBtn);
        }
      }

      // Traitement de la modale de candidature
      const modalResult = await this.handleApplicationModal(jobTitle);
      if (modalResult === 'abort') {
        return 'abort';
      }

      return 'continue';
    } catch (err) {
      log.error(`Erreur lors du traitement de l'offre #${index} : ${(err as Error).message}`);
      this.stats.failed++;
      await this.safelyDiscardApplication();
      return 'continue';
    }
  }

  /**
   * Moteur de résolution récursif / pas à pas du formulaire modal de candidature.
   */
  private async handleApplicationModal(jobTitle: string): Promise<'applied' | 'skipped' | 'abort'> {
    const modalSelector = CONFIG.selectors.easyApply.modal;
    const modal = this.page.locator(modalSelector).first();

    let isModalVisible = await modal.isVisible().catch(() => false);
    if (!isModalVisible) {
      isModalVisible = await modal.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    }

    // Si la modale n'apparaît pas au premier clic, tentative de re-clic immédiat
    if (!isModalVisible) {
      log.info('Tentative de re-clic sur Candidature simplifiée...');
      const retryBtn = this.page.locator(CONFIG.selectors.easyApply.easyApplyButton).first();
      if (await retryBtn.isVisible().catch(() => false)) {
        await retryBtn.click({ force: true }).catch(() => null);
        isModalVisible = await modal.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      }
    }

    if (!isModalVisible) {
      log.warn('La modale de candidature ne s\'est pas ouverte.');
      this.stats.failed++;
      return 'skipped';
    }

    let maxSteps = 12; // Garde-fou contre boucle infinie
    let step = 0;

    while (step < maxSteps) {
      step++;
      await humanDelay(1000, 2000);

      // 1. Détection et remplissage des champs présents dans l'étape courante
      const fieldResolution = await this.fillCurrentFormStep(modal, jobTitle);

      if (fieldResolution === 'abort') {
        await this.safelyDiscardApplication();
        return 'abort';
      }
      if (fieldResolution === 'skip') {
        await this.safelyDiscardApplication();
        this.stats.skipped++;
        return 'skipped';
      }

      // 2. Vérification si nous sommes sur le bouton final d'envoi
      const submitBtn = this.page.locator(CONFIG.selectors.easyApply.submitButton).first();
      const canSubmit = await submitBtn.isVisible().catch(() => false);

      if (canSubmit) {
        log.human('Étape finale atteinte : Clic sur "Envoyer la candidature" !');
        await humanMoveAndClick(this.page, submitBtn);
        await humanDelay(2500, 4500);

        // Fermeture de la pop-up de confirmation éventuelle ("Candidature envoyée", "Terminé", "OK")
        await this.cleanLingeringModals();

        log.success(`Candidature envoyée avec succès pour : "${jobTitle}" !`);
        this.stats.applied++;

        historyManager.logAction({
          module: 'easy_apply',
          actionType: 'APPLICATION_SENT',
          target: jobTitle,
          details: `Candidature soumise automatiquement avec profil ${CONFIG.candidate.firstName} ${CONFIG.candidate.lastName}`,
          status: 'SUCCESS',
        });

        // Garantir un écran propre et sans overlay résiduel pour l'offre suivante
        await this.cleanLingeringModals();
        return 'applied';
      }

      // 3. Vérification du bouton "Vérifier" (Review)
      const reviewBtn = this.page.locator(CONFIG.selectors.easyApply.reviewButton).first();
      const canReview = await reviewBtn.isVisible().catch(() => false);
      if (canReview) {
        log.human('Clic sur "Vérifier la candidature"...');
        await humanMoveAndClick(this.page, reviewBtn);
        continue;
      }

      // 4. Bouton "Suivant" (Next)
      const nextBtn = this.page.locator(CONFIG.selectors.easyApply.nextButton).first();
      const canNext = await nextBtn.isVisible().catch(() => false);
      if (canNext) {
        log.human('Étape suivante : Clic sur "Suivant"...');
        await humanMoveAndClick(this.page, nextBtn);

        // Vérifier si une erreur de validation bloque le passage à la suite
        await humanDelay(1000, 1800);
        const hasError = await modal.locator(CONFIG.selectors.easyApply.errorMessage).first().isVisible().catch(() => false);

        if (hasError) {
          if (CONFIG.autoMode) {
            log.warn('[AutoMode] Blocage de validation détecté, tentative d\'auto-résolution intelligente des champs requis...');
            await SmartFormSolver.autoRecoverStepErrors(this.page, modal, jobTitle);
            await humanDelay(800, 1500);
            await humanMoveAndClick(this.page, nextBtn);
            await humanDelay(1200, 2000);

            const stillError = await modal.locator(CONFIG.selectors.easyApply.errorMessage).first().isVisible().catch(() => false);
            if (stillError) {
              // Deuxième tentative avec auto-remplissage forcé de l'étape
              await this.fillCurrentFormStep(modal, jobTitle, true);
              await humanDelay(600, 1200);
              await humanMoveAndClick(this.page, nextBtn);
              await humanDelay(1200, 2000);
            }

            const fatalError = await modal.locator(CONFIG.selectors.easyApply.errorMessage).first().isVisible().catch(() => false);
            if (fatalError) {
              log.warn(`[AutoMode] Validation irréductible pour "${jobTitle}". Abandon propre et poursuite de la file.`);
              await this.safelyDiscardApplication();
              this.stats.skipped++;
              historyManager.logAction({
                module: 'easy_apply',
                actionType: 'APPLICATION_SKIPPED',
                target: jobTitle,
                details: 'Passage automatique : champ requis non franchissable sans blocage',
                status: 'SKIPPED',
              });
              return 'skipped';
            }
          } else {
            const decision = await promptSemiAutoChoice({
              fieldIdentifier: 'Validation formulaire requise',
              fieldLabel: 'Un champ obligatoire bloque le bouton Suivant',
              jobTitle,
            });

            if (decision === 'abort') {
              await this.safelyDiscardApplication();
              return 'abort';
            }
            if (decision === 'skip') {
              await this.safelyDiscardApplication();
              this.stats.skipped++;
              return 'skipped';
            }
            await humanMoveAndClick(this.page, nextBtn);
          }
        }
        continue;
      }

      // Si aucun bouton d'action n'est trouvé, situation anormale
      log.warn('Aucun bouton Suivant/Vérifier/Envoyer identifiable.');
      break;
    }

    log.warn(`Nombre maximum d'étapes atteint sans soumission pour "${jobTitle}".`);
    await this.safelyDiscardApplication();
    this.stats.failed++;
    return 'skipped';
  }

  /**
   * Analyse et remplit dynamiquement les éléments du formulaire modal via SmartFormSolver.
   */
  private async fillCurrentFormStep(modal: Locator, jobTitle: string, force: boolean = false): Promise<'ok' | 'skip' | 'abort'> {
    // A. Téléphone
    const phoneInput = modal.locator('input[id*="phoneNumber"], input[type="tel"]').first();
    if (await phoneInput.isVisible().catch(() => false)) {
      const val = await phoneInput.inputValue().catch(() => '');
      if (force || !val || val.trim().length < 5) {
        log.human(`Renseignement du téléphone : ${CONFIG.candidate.phone}`);
        await humanType(this.page, phoneInput, CONFIG.candidate.phone);
      }
    }

    // B. Téléversement du CV si requis
    const fileInput = modal.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      const resumePath = path.resolve(CONFIG.candidate.resumePath);
      if (fs.existsSync(resumePath)) {
        log.human(`Injection du fichier CV : ${resumePath}`);
        await fileInput.setInputFiles(resumePath).catch(() => null);
        await humanDelay(1500, 3000);
      }
    }

    // C. Sélection automatique de CV déjà existant sur LinkedIn
    await SmartFormSolver.solveResumeSelection(modal);

    // D. Checkboxes automatiques (Consentement, RGPD)
    await SmartFormSolver.solveCheckboxes(modal);

    // E. Champs texte, numériques et textareas via SmartFormSolver
    const textInputs = await modal.locator('input[type="text"], input[type="number"], input:not([type]), textarea').all();
    for (const input of textInputs) {
      if (!(await input.isVisible().catch(() => false))) continue;
      const currentValue = (await input.inputValue().catch(() => '')).trim();
      const isInvalid = await input.evaluate((el) => el.getAttribute('aria-invalid') === 'true' || el.classList.contains('error')).catch(() => false);
      if (!force && !isInvalid && currentValue.length > 0) continue; // Déjà valablement renseigné

      await SmartFormSolver.solveTextInput(this.page, input, modal, jobTitle, force);
    }

    // F. Boutons Radio (Fieldsets) via SmartFormSolver
    const fieldsets = await modal.locator('fieldset').all();
    for (const fieldset of fieldsets) {
      if (!(await fieldset.isVisible().catch(() => false))) continue;
      const alreadyChecked = await fieldset.locator('input[type="radio"]:checked').count();
      if (!force && alreadyChecked > 0) continue;

      await SmartFormSolver.solveRadioFieldset(this.page, fieldset);
    }

    // G. Menus déroulants natifs (Select) via SmartFormSolver
    const selects = await modal.locator('select').all();
    for (const select of selects) {
      if (!(await select.isVisible().catch(() => false))) continue;
      await SmartFormSolver.solveSelect(this.page, select, force);
    }

    // H. Menus déroulants personnalisés Artdeco de LinkedIn
    await SmartFormSolver.solveCustomDropdowns(this.page, modal);

    return 'ok';
  }

  /**
   * Coche le bouton radio correspondant au texte cible ("Oui" / "Non").
   */
  private async selectRadioOption(fieldset: Locator, targetLabels: string[]): Promise<void> {
    const radios = await fieldset.locator('label').all();
    for (const radio of radios) {
      const text = (await radio.innerText().catch(() => '')).trim().toLowerCase();
      if (targetLabels.some((lbl) => text.includes(lbl))) {
        log.human(`Sélection radio : "${text}"`);
        await radio.click();
        await humanDelay(200, 500);
        return;
      }
    }
  }

  /**
   * Abandonne et ferme proprement la modale de candidature en cours.
   */
  private async safelyDiscardApplication(): Promise<void> {
    try {
      const dismissBtn = this.page.locator(CONFIG.selectors.easyApply.dismissButton).first();
      if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dismissBtn.click({ force: true }).catch(() => null);
        await humanDelay(500, 1000);
      } else {
        await this.page.keyboard.press('Escape');
        await humanDelay(400, 800);
      }

      const confirmDiscard = this.page.locator(CONFIG.selectors.easyApply.confirmDiscardButton).first();
      if (await confirmDiscard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmDiscard.click({ force: true }).catch(() => null);
        await humanDelay(400, 800);
      }

      await this.cleanLingeringModals();
    } catch {
      await this.cleanLingeringModals(true);
    }
  }

  /**
   * Passe à la page de recherche suivante.
   */
  private async goToNextPage(): Promise<boolean> {
    try {
      await this.cleanLingeringModals();
      const nextPaginationBtn = this.page.locator('button[aria-label*="Page suivante"], button[aria-label*="Next page"]').first();
      if (await nextPaginationBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        log.human('Passage à la page suivante de résultats...');
        await humanMoveAndClick(this.page, nextPaginationBtn);
        await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);
        await this.cleanLingeringModals();
        return true;
      }
    } catch {
      // Fin des pages
    }
    return false;
  }
}

// Exécution autonome possible
if (process.argv[1]?.endsWith('easyApply.ts') || process.argv[1]?.endsWith('easyApply.js')) {
  new EasyApplyModule().run().catch(() => process.exit(1));
}
