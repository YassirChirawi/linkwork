import { Page, Browser } from 'playwright';
import { CONFIG } from '../config.js';
import { createStealthBrowser } from '../utils/browser.js';
import { humanDelay, humanScroll, humanMoveAndClick } from '../utils/humanize.js';
import { log } from '../utils/cli.js';
import { historyManager } from '../utils/history.js';
import { logEmitter } from '../utils/events.js';

export interface SimulationStats {
  durationMinutes: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  postsViewed: number;
  postsLiked: number;
  pagesVisited: number;
  currentActivity: string;
  isComplete: boolean;
}

export interface SimulationOptions {
  durationMinutes?: number;
  likeProbability?: number;
}

/**
 * Module de Simulation Humaine Réaliste & Warm-up (Session d'1 heure par défaut).
 * Reproduit fidèlement les comportements d'un utilisateur humain authentique :
 * - Défilement doux et naturel du flux d'actualité avec inertie et micro-tremblements
 * - Pauses de lecture réalistes (8s à 25s) sur les publications
 * - Likes naturels spontanés et occasionnels (probabilité ~20%)
 * - Clics sur "...voir plus" pour lire les textes longs
 * - Survol occasionnel de l'onglet Emplois et des Notifications
 * - Arrêt propre et instantané possible à tout moment.
 */
export class HumanSimulationModule {
  private page!: Page;
  private browserInstance: Browser | null = null;
  private options: SimulationOptions;
  private isAborted: boolean = false;
  private stats: SimulationStats;

  constructor(page?: Page, options: SimulationOptions = {}) {
    if (page) this.page = page;
    const durationMin = options.durationMinutes || CONFIG.simulation?.defaultDurationMinutes || 60;
    this.options = {
      durationMinutes: durationMin,
      likeProbability: options.likeProbability || CONFIG.simulation?.likeProbability || 0.2,
    };
    this.stats = {
      durationMinutes: durationMin,
      elapsedSeconds: 0,
      remainingSeconds: durationMin * 60,
      postsViewed: 0,
      postsLiked: 0,
      pagesVisited: 0,
      currentActivity: 'Initialisation de la session de navigation...',
      isComplete: false,
    };
  }

  /**
   * Arrête immédiatement la simulation en cours.
   */
  public stop(): void {
    log.warn('Demande d\'arrêt immédiat reçue pour la simulation humaine.');
    this.isAborted = true;
    this.stats.currentActivity = 'Arrêt demandé par l\'utilisateur.';
  }

  /**
   * Retourne l'état actuel des statistiques de la simulation.
   */
  public getStats(): SimulationStats {
    return { ...this.stats };
  }

  /**
   * Lance la session continue de simulation pour la durée demandée.
   */
  public async run(): Promise<SimulationStats> {
    const totalSeconds = this.options.durationMinutes! * 60;
    const startTime = Date.now();
    const endTime = startTime + totalSeconds * 1000;

    log.step(`Démarrage de la Simulation Humaine & Warm-Up (${this.options.durationMinutes} minutes)...`);
    log.info('Objectif : reproduire une navigation organique réelle 100% indétectable.');

    if (!this.page) {
      log.info('Lancement de la session Chromium furtive...');
      const session = await createStealthBrowser({ headless: CONFIG.headless });
      this.page = session.page;
      this.browserInstance = session.browser;
    }

    try {
      this.stats.pagesVisited++;
      this.stats.currentActivity = 'Navigation vers le fil d\'actualité LinkedIn...';
      log.info('Ouverture du fil d\'actualité LinkedIn (feed)...');
      await this.page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
      await humanDelay(3000, 6000);

      let lastJobsVisit = Date.now();
      let lastNotifsVisit = Date.now();
      const jobsIntervalMs = (CONFIG.simulation?.jobsBrowseIntervalMinutes || 15) * 60 * 1000;
      const notifsIntervalMs = (CONFIG.simulation?.notificationsIntervalMinutes || 22) * 60 * 1000;

      while (Date.now() < endTime && !this.isAborted) {
        // Mise à jour du chronomètre
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        this.stats.elapsedSeconds = elapsed;
        this.stats.remainingSeconds = Math.max(0, totalSeconds - elapsed);

        // Émission d'événement de progression
        logEmitter.emit('simulation_progress', { ...this.stats });

        const now = Date.now();

        // 1. Visite occasionnelle de l'onglet Emploi (toutes les ~15 min)
        if (now - lastJobsVisit > jobsIntervalMs && !this.isAborted) {
          await this.simulateJobBrowsing();
          lastJobsVisit = Date.now();
          if (this.isAborted) break;
          // Retour au feed
          await this.page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
          await humanDelay(3000, 5000);
        }

        // 2. Visite occasionnelle de l'onglet Notifications (toutes les ~22 min)
        if (now - lastNotifsVisit > notifsIntervalMs && !this.isAborted) {
          await this.simulateNotificationsBrowsing();
          lastNotifsVisit = Date.now();
          if (this.isAborted) break;
          // Retour au feed
          await this.page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
          await humanDelay(3000, 5000);
        }

        // 3. Navigation sur le fil d'actualité (activité principale)
        await this.simulateFeedInteraction();

        // Pause naturelle entre deux actions du feed
        await humanDelay(CONFIG.delays.microPause.min, CONFIG.delays.microPause.max);
      }

      this.stats.isComplete = !this.isAborted;
      this.stats.currentActivity = this.isAborted
        ? 'Simulation interrompue manuellement.'
        : 'Session de warm-up 1h terminée avec succès !';

      log.success(
        `Session terminée ! ${this.stats.postsViewed} posts lus, ${this.stats.postsLiked} likes naturels appliqués.`
      );

      historyManager.logAction({
        module: 'simulation',
        actionType: 'SIMULATION_SESSION_COMPLETED',
        target: 'Fil d\'actualité LinkedIn',
        details: `Navigation humaine : ${Math.floor(this.stats.elapsedSeconds / 60)} min écoulées, ${this.stats.postsViewed} posts lus, ${this.stats.postsLiked} likes naturels.`,
        status: 'SUCCESS',
      });
    } catch (err) {
      log.error(`Erreur durant la simulation humaine : ${(err as Error).message}`);
    } finally {
      if (this.browserInstance) {
        await this.browserInstance.close();
        log.info('Navigateur fermé.');
      }
    }

    return this.stats;
  }

  /**
   * Simule la lecture et l'interaction organique sur un post du feed.
   */
  private async simulateFeedInteraction(): Promise<void> {
    if (this.isAborted) return;

    // Défilement naturel par à-coups
    const scrollDistance = Math.floor(Math.random() * 350) + 200;
    await humanScroll(this.page, { totalDistance: scrollDistance, scrollSteps: 4 });
    await humanDelay(1000, 2500);

    // Détection des publications visibles
    const posts = await this.page.locator(CONFIG.selectors.outreach.feedPost).all();
    if (posts.length === 0) return;

    // Sélection d'un post aléatoire parmi les visibles
    const randomIndex = Math.floor(Math.random() * Math.min(posts.length, 3));
    const targetPost = posts[randomIndex];

    try {
      await targetPost.scrollIntoViewIfNeeded();

      // Temps de lecture réaliste (8s à 25s) simulant un humain qui lit le texte
      const dwellMs = Math.floor(Math.random() * 14000) + 8000;
      const readSeconds = Math.round(dwellMs / 1000);
      this.stats.postsViewed++;
      this.stats.currentActivity = `Lecture d'une publication (${readSeconds}s)...`;
      log.human(`[Warm-up] Pause lecture sur un post pendant ${readSeconds} secondes...`);

      // 1. Clic occasionnel sur "...voir plus" pour lire le texte complet
      if (Math.random() < 0.25) {
        const seeMoreBtn = targetPost
          .locator('button:has-text("...voir plus"), button:has-text("…see more"), button:has-text("voir plus")')
          .first();
        if (await seeMoreBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await humanMoveAndClick(this.page, seeMoreBtn);
          await humanDelay(1500, 3000);
        }
      }

      // Attente de lecture
      await humanDelay(dwellMs, dwellMs + 1000);

      // 2. Like naturel occasionnel (probabilité configurable, ex: 20%)
      if (Math.random() <= this.options.likeProbability! && !this.isAborted) {
        const likeBtn = targetPost.locator(CONFIG.selectors.outreach.likeButton).first();
        if (await likeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          const ariaPressed = await likeBtn.getAttribute('aria-pressed');
          if (ariaPressed !== 'true') {
            log.human('[Warm-up] Like naturel appliqué sur une publication !');
            await humanMoveAndClick(this.page, likeBtn);
            this.stats.postsLiked++;
            await humanDelay(1200, 2400);
          }
        }
      }
    } catch {
      // Ignorer les erreurs d'éléments dynamiques lors du défilement
    }
  }

  /**
   * Simule une visite sur l'onglet Emplois (sans postuler, simple consultation).
   */
  private async simulateJobBrowsing(): Promise<void> {
    log.info('[Warm-up] Consultation naturelle de l\'onglet Emplois...');
    this.stats.pagesVisited++;
    this.stats.currentActivity = 'Consultation de l\'onglet Emplois (Jobs)...';

    try {
      await this.page.goto('https://www.linkedin.com/jobs/', { waitUntil: 'domcontentloaded' });
      await humanDelay(3000, 6000);

      // Défilement doux sur les recommandations
      await humanScroll(this.page, { totalDistance: 600, scrollSteps: 5 });
      await humanDelay(4000, 8000);

      // Clic sur une offre pour lire la description
      const jobCard = this.page.locator('.jobs-search-results-list li, .job-card-container, div[data-job-id]').first();
      if (await jobCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await humanMoveAndClick(this.page, jobCard);
        // Lecture de l'offre pendant 10-18 secondes
        log.human('[Warm-up] Lecture d\'une fiche de poste (12s)...');
        await humanDelay(10000, 18000);
      }
    } catch {
      // Silencieux
    }
  }

  /**
   * Simule la consultation des notifications.
   */
  private async simulateNotificationsBrowsing(): Promise<void> {
    log.info('[Warm-up] Consultation rapide des notifications...');
    this.stats.pagesVisited++;
    this.stats.currentActivity = 'Consultation des Notifications...';

    try {
      await this.page.goto('https://www.linkedin.com/notifications/', { waitUntil: 'domcontentloaded' });
      await humanDelay(3000, 6000);
      await humanScroll(this.page, { totalDistance: 400, scrollSteps: 3 });
      await humanDelay(4000, 7000);
    } catch {
      // Silencieux
    }
  }
}

// Exécution autonome
if (process.argv[1]?.endsWith('humanSimulation.ts') || process.argv[1]?.endsWith('humanSimulation.js')) {
  new HumanSimulationModule().run().catch(() => process.exit(1));
}
