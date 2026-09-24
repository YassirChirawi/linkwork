import { Page, Locator } from 'playwright';
import { CONFIG } from '../config.js';
import { createStealthBrowser } from '../utils/browser.js';
import { humanDelay, humanScroll, humanMoveAndClick } from '../utils/humanize.js';
import { log } from '../utils/cli.js';
import { historyManager } from '../utils/history.js';
import { aiGenerator } from '../utils/aiGenerator.js';
import { NetworkingModule } from './networking.js';
import { humanType } from '../utils/humanize.js';

export interface OutreachStats {
  postsScanned: number;
  postsLiked: number;
  authorsContacted: number;
  skipped: number;
}

export interface OutreachOptions {
  mode?: 'peopleSearch' | 'feed' | 'both' | 'postsSearch';
  personaId?: string; // 'all' | 'd2c_founders' | 'ecom_ops_managers' | 'growth_agencies'
  topicId?: string; // 'all' | 'ecommerce_maroc' | 'facturation_maroc' | 'pme_digital_maroc'
  booleanQuery?: string;
  hashtags?: string[];
  postQuery?: string;
}

/**
 * Module Prospection & Démarchage B2B BayIIn (Maroc E-commerce & Facturation PME).
 * Modes d'action :
 * 1. Recherche Booléenne People Search : Cible directement les 3 Personas Clés au Maroc.
 * 2. Smart Posts Search & Social Selling : Recherche de publications récentes sur l'e-commerce
 *    et la gestion de facturation au Maroc, likes naturels "par-ci par-là", commentaires d'expert
 *    constructifs et demandes de connexion ciblées.
 * 3. Warm Outreach Flux & Hashtags : Exploration des flux sectoriels.
 */
export class OutreachModule {
  private page!: Page;
  private options: OutreachOptions;
  private stats: OutreachStats = {
    postsScanned: 0,
    postsLiked: 0,
    authorsContacted: 0,
    skipped: 0,
  };

  constructor(page?: Page, options: OutreachOptions = {}) {
    if (page) this.page = page;
    this.options = {
      mode: options.mode || 'postsSearch',
      personaId: options.personaId || 'all',
      topicId: options.topicId || 'all',
      booleanQuery: options.booleanQuery,
      hashtags: options.hashtags || CONFIG.outreach.hashtags,
      postQuery: options.postQuery,
    };
  }

  /**
   * Lance la session de prospection BayIIn selon le mode configuré.
   */
  public async run(): Promise<OutreachStats> {
    log.step('Démarrage du Module Prospection & Social Selling BayIIn Maroc...');
    log.info(`Mode sélectionné : ${this.options.mode?.toUpperCase()} | Thématique : ${this.options.topicId || 'Toutes'}`);

    let browserInstance = null;
    if (!this.page) {
      log.info('Lancement de la session Chromium furtive...');
      const session = await createStealthBrowser({ headless: CONFIG.headless });
      this.page = session.page;
      browserInstance = session.browser;
    }

    try {
      // 1. Mode Recherche de Publications Récentes (Social Selling E-commerce & Facturation Maroc)
      if (this.options.mode === 'postsSearch' || this.options.mode === 'both') {
        log.step('Étape 1 : Exploration Intelligente des Publications & Social Selling Maroc...');
        await this.runPostsSearch();
      }

      // 2. Mode Recherche Booléenne People Search (Ciblage des décideurs)
      if ((this.options.mode === 'peopleSearch' || this.options.mode === 'both') &&
          this.stats.authorsContacted < CONFIG.quotas.maxOutreachPerSession) {
        log.step('Étape 2 : Recherche Ciblée des Décideurs Maroc (People Search)...');
        await this.runPeopleSearch();
      }

      // 3. Mode Warm Outreach sur les Flux & Hashtags Maroc
      if (this.options.mode === 'feed' &&
          this.stats.authorsContacted < CONFIG.quotas.maxOutreachPerSession) {
        log.step('Étape 3 : Exploration du flux et Warm Outreach via Hashtags...');
        const hashtags = this.options.hashtags || CONFIG.outreach.hashtags;

        for (const tag of hashtags) {
          if (this.stats.authorsContacted >= CONFIG.quotas.maxOutreachPerSession) {
            log.success(`Quota d'outreach atteint (${this.stats.authorsContacted} contacts ciblés).`);
            break;
          }

          log.info(`Exploration du flux pour le hashtag : ${tag}`);
          await this.exploreHashtagFeed(tag);

          // Pause naturelle entre deux hashtags
          await humanDelay(CONFIG.delays.betweenApplications.min, CONFIG.delays.betweenApplications.max);
        }
      }
    } catch (err) {
      log.error(`Erreur dans le module Prospection BayIIn : ${(err as Error).message}`);
    } finally {
      if (browserInstance) {
        await browserInstance.close();
        log.info('Navigateur fermé.');
      }
    }

    log.step('Bilan de la session Prospection BayIIn Maroc :');
    console.table(this.stats);
    return this.stats;
  }

  /**
   * Prospection ciblée via la Recherche Booléenne LinkedIn People.
   * Cible les 3 Personas Marocains (Fondateurs D2C, Responsables E-com/Ops, Agences Growth/COD).
   */
  public async runPeopleSearch(options?: { personaId?: string; booleanQuery?: string }): Promise<void> {
    const personaId = options?.personaId || this.options.personaId || 'all';
    let query = options?.booleanQuery || this.options.booleanQuery;

    if (!query) {
      if (personaId && personaId !== 'all') {
        const foundPersona = CONFIG.outreach.targetPersonas.find((p) => p.id === personaId);
        query = foundPersona?.booleanQuery || CONFIG.outreach.booleanSearchQuery;
      } else {
        query = CONFIG.outreach.booleanSearchQuery;
      }
    }

    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}&origin=GLOBAL_SEARCH_HEADER`;
    log.info(`Recherche Ciblée Personas Maroc : "${query}"`);
    log.info(`Navigation vers : ${searchUrl}`);

    await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);
    await humanScroll(this.page, { totalDistance: 700, scrollSteps: 5 });

    // Extraction des cartes de résultats avec fallback multi-sélecteurs
    let resultItems = await this.page.locator(CONFIG.selectors.outreach.searchResultItem).all();
    log.info(`Profils prospects détectés dans les résultats : ${resultItems.length}`);

    if (resultItems.length === 0) {
      // Fallback moderne sur les conteneurs d'entités personnes LinkedIn
      resultItems = await this.page.locator(
        'div[data-view-name*="search-entity"], li.reusable-search__result-container, div.entity-result, ul[role="list"] > li:has(a[href*="/in/"]), li.artdeco-list__item:has(a[href*="/in/"])'
      ).all();
      log.info(`Sélecteur fallback : ${resultItems.length} profils trouvés.`);
    }

    for (let i = 0; i < resultItems.length; i++) {
      if (this.stats.authorsContacted >= CONFIG.quotas.maxOutreachPerSession) {
        log.success(`Quota d'invitations atteint (${this.stats.authorsContacted} contacts).`);
        break;
      }

      const item = resultItems[i];
      try {
        await item.scrollIntoViewIfNeeded();
        await humanDelay(600, 1200);

        const linkEl = item.locator('a[href*="/in/"]').first();
        if (!(await linkEl.isVisible({ timeout: 2000 }).catch(() => false))) continue;

        const href = await linkEl.getAttribute('href');
        if (!href || !href.includes('/in/')) continue;
        const profileUrl = href.split('?')[0];

        const titleEl = item.locator('.entity-result__title-text, a[href*="/in/"] span[aria-hidden="true"], h3, .app-aware-link').first();
        const fullName = (await titleEl.innerText().catch(() => 'Professionnel')).trim();
        const firstName = fullName.split(' ')[0] || 'Bonjour';

        const subEl = item.locator('.entity-result__primary-subtitle, div.entity-result__summary, .artdeco-entity-lockup__subtitle').first();
        const headline = (await subEl.innerText().catch(() => '')).trim();

        // Détection fine du persona spécifique (D2C / E-com / Growth)
        const detectedPersona = (personaId && personaId !== 'all')
          ? personaId
          : aiGenerator.detectPersona(headline, fullName);

        const inviteNote = aiGenerator.getPersonaPitch(detectedPersona, firstName);

        log.info(`[Prospect #${i + 1}] "${fullName}" | Headline: "${headline.slice(0, 35)}..."`);
        log.info(`   -> Persona identifié : ${detectedPersona} | Longueur note : ${inviteNote.length} car.`);

        // Visite furtive du profil et envoi de l'invitation personnalisée
        const newPage = await this.page.context().newPage();
        try {
          const networkingHelper = new NetworkingModule(newPage);
          const invited = await networkingHelper.processProfile(profileUrl, {
            customNote: inviteNote,
          });

          if (invited) {
            this.stats.authorsContacted++;
            historyManager.logAction({
              module: 'outreach',
              actionType: 'INVITATION_SENT',
              target: `${fullName} (${headline.slice(0, 35)})`,
              details: `Pitch Persona [${detectedPersona}] : "${inviteNote}"`,
              status: 'SUCCESS',
            });
          }
        } finally {
          await newPage.close();
        }

        // Délai de précaution anti-détection entre contacts
        await humanDelay(CONFIG.delays.betweenApplications.min, CONFIG.delays.betweenApplications.max);
      } catch (err) {
        log.warn(`Erreur lors du traitement du prospect #${i + 1} : ${(err as Error).message}`);
        this.stats.skipped++;
      }
    }
  }

  /**
   * Exploration et interaction sur les publications (posts) récentes traitant d'e-commerce,
   * de facturation, de conformité ICE et de digitalisation au Maroc.
   */
  public async runPostsSearch(): Promise<void> {
    const queries = this.options.postQuery
      ? [{ id: 'custom', label: 'Requête personnalisée', query: this.options.postQuery }]
      : (this.options.topicId && this.options.topicId !== 'all')
        ? CONFIG.outreach.postSearchQueries.filter((q) => q.id === this.options.topicId)
        : CONFIG.outreach.postSearchQueries;

    for (const targetQuery of queries) {
      if (this.stats.authorsContacted >= CONFIG.quotas.maxOutreachPerSession) {
        log.success(`Quota d'outreach atteint (${this.stats.authorsContacted} contacts ciblés).`);
        break;
      }

      log.step(`Exploration des publications LinkedIn : "${targetQuery.label}"...`);
      log.info(`Requête booléenne posts : ${targetQuery.query}`);
      const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(targetQuery.query)}&origin=GLOBAL_SEARCH_HEADER&sortBy="date_posted"`;
      log.info(`Navigation vers : ${searchUrl}`);

      await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);
      await humanScroll(this.page, { totalDistance: 800, scrollSteps: 6 });

      const posts = await this.page.locator(CONFIG.selectors.outreach.feedPost).all();
      log.info(`Publications détectées pour "${targetQuery.label}" : ${posts.length}`);

      for (let i = 0; i < posts.length; i++) {
        if (this.stats.authorsContacted >= CONFIG.quotas.maxOutreachPerSession) break;
        const post = posts[i];
        await this.processPost(post, targetQuery.label);
        await humanDelay(CONFIG.delays.betweenApplications.min, CONFIG.delays.betweenApplications.max);
      }
    }
  }

  /**
   * Navigue sur le feed d'un hashtag et traite les publications récentes.
   */
  private async exploreHashtagFeed(hashtag: string): Promise<void> {
    const cleanTag = hashtag.replace('#', '');
    const feedUrl = `https://www.linkedin.com/feed/hashtag/?keywords=${encodeURIComponent(cleanTag)}`;

    log.info(`Navigation vers le hashtag : ${feedUrl}`);
    await this.page.goto(feedUrl, { waitUntil: 'domcontentloaded' });
    await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);

    // Défilement initial pour charger les premiers posts
    await humanScroll(this.page, { totalDistance: 800, scrollSteps: 6 });

    const posts = await this.page.locator(CONFIG.selectors.outreach.feedPost).all();
    log.info(`Posts détectés pour ${hashtag} : ${posts.length}`);

    for (let i = 0; i < posts.length; i++) {
      if (this.stats.authorsContacted >= CONFIG.quotas.maxOutreachPerSession) break;

      const post = posts[i];
      await this.processPost(post, hashtag);

      await humanDelay(CONFIG.delays.actionDelay.min, CONFIG.delays.actionDelay.max);
    }
  }

  /**
   * Traite un post : scroll vers le post, like probabiliste, commentaire expert, extraction auteur.
   */
  private async processPost(postLocator: Locator, hashtag: string): Promise<void> {
    this.stats.postsScanned++;

    try {
      await postLocator.scrollIntoViewIfNeeded();
      await humanDelay(800, 1800);

      // Extraction du texte de la publication et de l'auteur
      const descEl = postLocator.locator(CONFIG.selectors.outreach.postDescription).first();
      const postText = (await descEl.innerText().catch(() => '')).trim();

      const authorNameEl = postLocator.locator(CONFIG.selectors.outreach.postActor).first();
      const authorName = (await authorNameEl.innerText().catch(() => 'Professionnel')).trim();

      const headlineEl = postLocator.locator(CONFIG.selectors.outreach.authorHeadline).first();
      const authorHeadline = (await headlineEl.innerText().catch(() => '')).trim();

      log.info(`Post analysé de "${authorName}" (${authorHeadline.slice(0, 35)}...) : "${postText.slice(0, 50)}..."`);

      // Génération IA / sémantique contextuelle BayIIn
      const aiResult = await aiGenerator.generateContent({
        postText: postText || hashtag,
        authorName,
        authorHeadline,
        context: 'saas_bayiin',
      });

      // 1. Like du post selon la probabilité configurée (ex: 75%)
      if (Math.random() <= CONFIG.outreach.likeProbability) {
        const likeBtn = postLocator.locator(CONFIG.selectors.outreach.likeButton).first();
        const isLikeVisible = await likeBtn.isVisible().catch(() => false);

        if (isLikeVisible) {
          const ariaPressed = await likeBtn.getAttribute('aria-pressed');
          if (ariaPressed !== 'true') {
            log.human(`Like appliqué sur la publication de ${authorName} !`);
            await humanMoveAndClick(this.page, likeBtn);
            this.stats.postsLiked++;

            historyManager.logAction({
              module: 'outreach',
              actionType: 'POST_LIKED',
              target: `Post de ${authorName} (${hashtag})`,
              details: `Signal d'intérêt appliqué sur publication (${aiResult.detectedTopic})`,
              status: 'SUCCESS',
            });

            await humanDelay(800, 1600);
          }
        }
      }

      // 2. Rédaction d'un commentaire constructif d'expert sous le post
      if (aiResult.comment && Math.random() <= CONFIG.outreach.commentProbability) {
        try {
          const commentBtn = postLocator.locator(CONFIG.selectors.outreach.commentButton).first();
          if (await commentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            log.human(`Rédaction d'un commentaire d'expert sous le post de ${authorName}...`);
            await humanMoveAndClick(this.page, commentBtn);
            await humanDelay(1000, 2000);

            const commentInput = postLocator.locator(CONFIG.selectors.outreach.commentInput).first();
            if (await commentInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await humanType(this.page, commentInput, aiResult.comment);
              await humanDelay(800, 1600);

              const submitCommentBtn = postLocator.locator(CONFIG.selectors.outreach.commentSubmit).first();
              if (await submitCommentBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
                await humanMoveAndClick(this.page, submitCommentBtn);
                log.success(`Commentaire publié avec succès : "${aiResult.comment.slice(0, 50)}..."`);
                historyManager.logAction({
                  module: 'outreach',
                  actionType: 'POST_COMMENTED',
                  target: `${authorName} (${hashtag})`,
                  details: aiResult.comment,
                  status: 'SUCCESS',
                });
                await humanDelay(2000, 4000);
              }
            }
          }
        } catch (commentErr) {
          log.warn(`Impossible de déposer le commentaire : ${(commentErr as Error).message}`);
        }
      }

      // 3. Extraction du lien vers le profil de l'auteur du post
      const authorLink = postLocator.locator(CONFIG.selectors.outreach.postActor).first();
      const isAuthorVisible = await authorLink.isVisible().catch(() => false);

      if (!isAuthorVisible) {
        this.stats.skipped++;
        return;
      }

      const href = await authorLink.getAttribute('href');
      if (!href || !href.includes('/in/')) {
        this.stats.skipped++;
        return;
      }

      const cleanProfileUrl = href.split('?')[0];

      // 4. Ouvrir le profil de l'auteur et envoyer la note d'invitation contextualisée (< 290 car.)
      log.info(`Envoi d'invitation ciblée BayIIn vers : ${cleanProfileUrl}...`);
      const newPage = await this.page.context().newPage();
      try {
        const networkingHelper = new NetworkingModule(newPage);
        const invited = await networkingHelper.processProfile(cleanProfileUrl, {
          customNote: aiResult.inviteNote,
        });

        if (invited) {
          this.stats.authorsContacted++;
          historyManager.logAction({
            module: 'outreach',
            actionType: 'INVITATION_SENT',
            target: `${authorName} (${hashtag})`,
            details: `Note IA contextuelle (${aiResult.detectedTopic}) : "${aiResult.inviteNote}"`,
            status: 'SUCCESS',
          });
        }
      } finally {
        await newPage.close();
      }
    } catch (err) {
      log.warn(`Erreur lors du traitement d'un post : ${(err as Error).message}`);
      this.stats.skipped++;
    }
  }
}

// Exécution autonome
if (process.argv[1]?.endsWith('outreach.ts') || process.argv[1]?.endsWith('outreach.js')) {
  new OutreachModule().run().catch(() => process.exit(1));
}
