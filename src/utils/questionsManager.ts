import fs from 'fs';
import path from 'path';
import { CONFIG, saveUserConfig } from '../config.js';
import { log, colors, promptUser } from './cli.js';
import { logEmitter } from './events.js';

export type QuestionCategory = 'years_skill' | 'years_overall' | 'boolean' | 'salary' | 'notice' | 'text' | 'select';

export interface CandidateQuestion {
  id: string; // Identifiant unique et stable (slug normalisé)
  questionText: string; // Libellé exact de la question posée
  category: QuestionCategory;
  skillName?: string; // Nom de la compétence identifiée (ex: "kubernetes", "vue.js")
  botAnswer: string; // Valeur renseignée par le bot (ex: "3", "Oui", "4")
  candidateAnswer?: string; // Réponse renseignée/validée par le candidat
  isAnswered: boolean; // true si le candidat a répondu/confirmé
  fallbackApplied: boolean; // true si la règle par défaut (ex: 3 ans) a été appliquée
  source: 'skills_map' | 'default_fallback_3' | 'inferred' | 'profile' | 'candidate_saved';
  jobTitle?: string;
  company?: string;
  firstEncountered: string;
  lastEncountered: string;
  encounterCount: number;
}

export interface QuestionsState {
  questions: Record<string, CandidateQuestion>;
  lastTourDate?: string;
  lastTourModule?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const QUESTIONS_JSON_FILE = path.join(DATA_DIR, 'candidate_questions.json');
const QUESTIONS_MARKDOWN_FILE = path.resolve(process.cwd(), 'QUESTIONS_A_REMPLIR.md');

/**
 * Gestionnaire intelligent des questions candidat.
 * - Enregistre les questions rencontrées lors des formulaires de candidature
 * - Identifie les compétences inconnues ayant reçu la réponse par défaut (3 ans)
 * - Génère le fichier QUESTIONS_A_REMPLIR.md après chaque tour de candidatures
 * - Fournit l'API pour que le candidat réponde avant la prochaine session
 * - Injecte automatiquement les nouvelles réponses dans la matrice de compétences
 */
export class CandidateQuestionsManager {
  private static questions: Map<string, CandidateQuestion> = new Map();
  private static initialized: boolean = false;
  private static pendingCountThisTour: number = 0;

  /**
   * Initialise et charge l'historique des questions depuis le fichier JSON.
   */
  public static init(): void {
    if (this.initialized) return;
    this.ensureDataDir();
    this.loadFromFile();
    this.initialized = true;
  }

  private static ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * Normalise un libellé de question en identifiant slug stable.
   */
  public static generateId(text: string, skillName?: string): string {
    if (skillName && skillName.trim()) {
      return `skill_${skillName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    }
    const clean = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    return clean || `q_${Date.now()}`;
  }

  /**
   * Charge l'état existant depuis le disque.
   */
  private static loadFromFile(): void {
    try {
      if (fs.existsSync(QUESTIONS_JSON_FILE)) {
        const content = fs.readFileSync(QUESTIONS_JSON_FILE, 'utf-8');
        const data: QuestionsState = JSON.parse(content);
        if (data && data.questions) {
          this.questions.clear();
          for (const [id, q] of Object.entries(data.questions)) {
            this.questions.set(id, q);
          }
        }
      }
    } catch (err) {
      log.warn(`Impossible de charger ${QUESTIONS_JSON_FILE} : ${(err as Error).message}`);
    }
  }

  /**
   * Sauvegarde l'état des questions sur le disque.
   */
  private static saveToFile(moduleName?: string): void {
    try {
      this.ensureDataDir();
      const obj: Record<string, CandidateQuestion> = {};
      for (const [id, q] of this.questions.entries()) {
        obj[id] = q;
      }
      const state: QuestionsState = {
        questions: obj,
        lastTourDate: new Date().toISOString(),
        lastTourModule: moduleName || 'candidatures',
      };
      fs.writeFileSync(QUESTIONS_JSON_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      log.error(`Erreur sauvegarde ${QUESTIONS_JSON_FILE} : ${(err as Error).message}`);
    }
  }

  /**
   * Enregistre ou met à jour une question posée lors d'un formulaire.
   */
  public static recordQuestion(params: {
    questionText: string;
    category: QuestionCategory;
    skillName?: string;
    botAnswer: string;
    fallbackApplied: boolean;
    source: CandidateQuestion['source'];
    jobTitle?: string;
    company?: string;
  }): CandidateQuestion {
    this.init();

    const id = this.generateId(params.questionText, params.skillName);
    const now = new Date().toISOString();
    const existing = this.questions.get(id);

    if (existing) {
      existing.encounterCount += 1;
      existing.lastEncountered = now;
      existing.botAnswer = params.botAnswer;
      if (params.jobTitle) existing.jobTitle = params.jobTitle;
      if (params.company) existing.company = params.company;

      // Si le candidat avait déjà répondu précédemment, conserver sa réponse validée
      this.questions.set(id, existing);
      this.saveToFile();
      return existing;
    }

    const newQuestion: CandidateQuestion = {
      id,
      questionText: params.questionText.trim(),
      category: params.category,
      skillName: params.skillName ? params.skillName.trim().toLowerCase() : undefined,
      botAnswer: params.botAnswer,
      candidateAnswer: undefined,
      isAnswered: false,
      fallbackApplied: params.fallbackApplied,
      source: params.source,
      jobTitle: params.jobTitle,
      company: params.company,
      firstEncountered: now,
      lastEncountered: now,
      encounterCount: 1,
    };

    this.questions.set(id, newQuestion);
    this.pendingCountThisTour += 1;
    this.saveToFile();

    // Notifier en temps réel
    logEmitter.emit('questions_updated', {
      type: 'new_question',
      question: newQuestion,
      pendingCount: this.getPendingQuestions().length,
    });

    return newQuestion;
  }

  /**
   * Récupère une réponse validée par le candidat pour une question ou compétence donnée.
   */
  public static getSavedAnswer(questionText: string, skillName?: string): string | null {
    this.init();

    // 1. Recherche par compétence dans skillsMap en priorité
    if (skillName) {
      const cleanSkill = skillName.trim().toLowerCase();
      if (CONFIG.candidate.skillsMap && CONFIG.candidate.skillsMap[cleanSkill] !== undefined) {
        return String(CONFIG.candidate.skillsMap[cleanSkill]);
      }
    }

    // 2. Recherche par ID direct dans les questions répondues
    const directId = this.generateId(questionText, skillName);
    const q = this.questions.get(directId);
    if (q && q.isAnswered && q.candidateAnswer) {
      return q.candidateAnswer;
    }

    // 3. Recherche floue par libellé textuel
    const lower = questionText.toLowerCase();
    for (const item of this.questions.values()) {
      if (item.isAnswered && item.candidateAnswer) {
        if (item.questionText.toLowerCase() === lower || (item.skillName && lower.includes(item.skillName))) {
          return item.candidateAnswer;
        }
      }
    }

    return null;
  }

  /**
   * Retourne la liste de toutes les questions.
   */
  public static getAllQuestions(): CandidateQuestion[] {
    this.init();
    return Array.from(this.questions.values()).sort((a, b) => {
      // Priorité 1 : Questions non répondues nécessitant précision
      if (!a.isAnswered && b.isAnswered) return -1;
      if (a.isAnswered && !b.isAnswered) return 1;
      // Priorité 2 : Date de dernière rencontre récente
      return new Date(b.lastEncountered).getTime() - new Date(a.lastEncountered).getTime();
    });
  }

  /**
   * Retourne les questions en attente de réponse ou de précision du candidat.
   */
  public static getPendingQuestions(): CandidateQuestion[] {
    this.init();
    return this.getAllQuestions().filter((q) => !q.isAnswered);
  }

  /**
   * Valide la réponse du candidat pour une question spécifique.
   * Injecte directement le résultat dans `skillsMap` et `user_config.json`.
   */
  public static answerQuestion(id: string, answer: string): boolean {
    this.init();
    const q = this.questions.get(id);
    if (!q) return false;

    const trimmed = answer.trim();
    q.candidateAnswer = trimmed;
    q.isAnswered = true;
    q.source = 'candidate_saved';

    // 1. Si c'est une question de compétence d'années d'expérience
    if (q.category === 'years_skill' && q.skillName) {
      const parsedYears = parseInt(trimmed.replace(/\D+/g, ''), 10);
      const finalYears = isNaN(parsedYears) ? 3 : parsedYears;
      q.candidateAnswer = String(finalYears);

      // Mise à jour immédiate dans la configuration en mémoire
      if (!CONFIG.candidate.skillsMap) CONFIG.candidate.skillsMap = {};
      CONFIG.candidate.skillsMap[q.skillName] = finalYears;

      // Sauvegarde persistante dans data/user_config.json
      saveUserConfig({
        candidate: {
          skillsMap: {
            ...CONFIG.candidate.skillsMap,
            [q.skillName]: finalYears,
          },
        } as any,
      });

      log.success(
        `[Questions Candidat] Compétence "${q.skillName}" configurée à ${finalYears} ans (Sauvegardée pour les prochains tours !)`
      );
    }

    // 2. Si question d'expérience globale
    else if (q.category === 'years_overall') {
      const parsedYears = parseInt(trimmed.replace(/\D+/g, ''), 10);
      if (!isNaN(parsedYears)) {
        CONFIG.candidate.experienceYears = parsedYears;
        saveUserConfig({
          candidate: { experienceYears: parsedYears } as any,
        });
        log.success(`[Questions Candidat] Expérience globale fixée à ${parsedYears} ans.`);
      }
    }

    this.saveToFile();
    this.generateMarkdownFile();

    logEmitter.emit('questions_updated', {
      type: 'question_answered',
      id,
      answer: trimmed,
      pendingCount: this.getPendingQuestions().length,
    });

    return true;
  }

  /**
   * Valide plusieurs réponses simultanément (ex: depuis formulaire web ou CLI).
   */
  public static answerMultiple(answers: Record<string, string>): number {
    this.init();
    let count = 0;
    for (const [id, val] of Object.entries(answers)) {
      if (this.answerQuestion(id, val)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Finalise le tour de candidatures :
   * - Sauvegarde l'état
   * - Génère le fichier QUESTIONS_A_REMPLIR.md
   * - Émet les notifications de fin de tour
   */
  public static finalizeTour(moduleName: string = 'EasyApply'): CandidateQuestion[] {
    this.init();
    this.saveToFile(moduleName);
    this.generateMarkdownFile(moduleName);

    const pending = this.getPendingQuestions();
    logEmitter.emit('questions_updated', {
      type: 'tour_finalized',
      moduleName,
      pendingCount: pending.length,
      questions: pending,
    });

    return pending;
  }

  /**
   * Génère le fichier markdown lisible et directement éditable par le candidat : QUESTIONS_A_REMPLIR.md.
   */
  public static generateMarkdownFile(moduleName: string = 'Candidatures'): string {
    this.init();
    const all = this.getAllQuestions();
    const pending = all.filter((q) => !q.isAnswered);
    const answered = all.filter((q) => q.isAnswered);

    const dateStr = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let md = `# 📋 Suite de Questions Candidat - À remplir avant la prochaine session\n\n`;
    md += `> 🤖 **Session terminée le ${dateStr} (Module : ${moduleName})**\n`;
    md += `> Pour rendre le bot **100% précis** lors du prochain tour, complétez ou ajustez vos réponses ci-dessous.\n`;
    md += `> *Vos réponses seront automatiquement prises en compte lors de la prochaine session.*\n\n`;
    md += `---\n\n`;

    // A. Section 1 : Questions d'expérience par compétence (Compétences nécessitant précision)
    const skillQuestions = all.filter((q) => q.category === 'years_skill');
    md += `## ⏳ 1. Compétences & Années d'expérience\n`;
    md += `*Règle du bot : Si une question demande "combien d'années d'expérience" et que la compétence n'est pas dans votre profil, le bot répond **3 ans par défaut** pour éviter le rejet du recruteur.*\n`;
    md += `*Indiquez vos vraies années d'expérience entre crochets \`[ X ]\` ci-dessous :*\n\n`;

    if (skillQuestions.length === 0) {
      md += `*Aucune nouvelle compétence à préciser pour le moment. Le bot a trouvé toutes les compétences dans votre profil.* 👍\n\n`;
    } else {
      for (const q of skillQuestions) {
        const skillDisplay = q.skillName ? q.skillName.toUpperCase() : q.questionText;
        const currentVal = q.candidateAnswer || q.botAnswer || '3';
        const checkbox = q.isAnswered ? '[x]' : '[ ]';
        const statusNote = q.isAnswered
          ? `*(Validé candidat : ${currentVal} ans)*`
          : q.fallbackApplied
          ? `*(Répondu 3 ans par défaut - À préciser)*`
          : `*(Répondu ${q.botAnswer} ans)*`;

        md += `- ${checkbox} **${skillDisplay}** : ${statusNote}\n`;
        md += `  - Question posée : *"${q.questionText}"*\n`;
        md += `  - Vos vraies années d'expérience : \`[ ${currentVal} ]\` ans\n\n`;
      }
    }

    md += `---\n\n`;

    // B. Section 2 : Questions Spécifiques & Fermées (Oui / Non, Salaire, etc.)
    const otherQuestions = all.filter((q) => q.category !== 'years_skill');
    md += `## ❓ 2. Questions Spécifiques & Préférences Recruteurs\n`;
    md += `*Confirmez ou ajustez vos réponses entre crochets \`[ ... ]\` :*\n\n`;

    if (otherQuestions.length === 0) {
      md += `*Aucune question spécifique supplémentaire détectée lors de ce tour.*\n\n`;
    } else {
      for (const q of otherQuestions) {
        const checkbox = q.isAnswered ? '[x]' : '[ ]';
        const currentVal = q.candidateAnswer || q.botAnswer || 'Oui';
        const statusNote = q.isAnswered ? `*(Validé candidat)*` : `*(Répondu "${q.botAnswer}" par le bot)*`;

        md += `- ${checkbox} **${q.questionText}** ${statusNote}\n`;
        md += `  - Votre réponse : \`[ ${currentVal} ]\`\n\n`;
      }
    }

    md += `---\n\n`;
    md += `## 💡 Comment appliquer vos réponses pour le prochain tour ?\n\n`;
    md += `1. **Méthode 1 (Depuis le Dashboard)** : Rendez-vous sur [http://localhost:3000](http://localhost:3000), onglet **"Questions Candidat"**, renseignez vos valeurs et cliquez sur **"Enregistrer mes réponses"**.\n`;
    md += `2. **Méthode 2 (Directement dans ce fichier)** : Modifiez les chiffres ou réponses entre crochets \`[ ... ]\` dans ce fichier markdown et sauvegardez-le. Le bot synchronisera vos réponses au début de la prochaine session !\n\n`;

    try {
      fs.writeFileSync(QUESTIONS_MARKDOWN_FILE, md, 'utf-8');
      // Sauvegarder également une copie dans data/ pour historique
      fs.writeFileSync(path.join(DATA_DIR, 'QUESTIONS_A_REMPLIR.md'), md, 'utf-8');
    } catch (err) {
      log.warn(`Erreur écriture fichier markdown : ${(err as Error).message}`);
    }

    return md;
  }

  /**
   * Synchronise les réponses modifiées manuellement par le candidat dans le fichier QUESTIONS_A_REMPLIR.md.
   */
  public static syncFromFile(): { updatedCount: number; details: string[] } {
    this.init();
    if (!fs.existsSync(QUESTIONS_MARKDOWN_FILE)) {
      return { updatedCount: 0, details: [] };
    }

    try {
      const content = fs.readFileSync(QUESTIONS_MARKDOWN_FILE, 'utf-8');
      const lines = content.split('\n');
      let currentSkillOrQuestion: string | null = null;
      let updatedCount = 0;
      const details: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Détection ligne item : - [ ] **SKILL** ou - [x] **SKILL**
        const itemMatch = line.match(/^-\s*\[([ xX]?)\]\s*\*\*(.*?)\*\*/);
        if (itemMatch) {
          currentSkillOrQuestion = itemMatch[2].trim();
        }

        // Détection de la valeur entre crochets : `[ valeur ]`
        if (currentSkillOrQuestion) {
          const valMatch = line.match(/`\[\s*([^\]]+?)\s*\]`/);
          if (valMatch) {
            const rawVal = valMatch[1].trim();
            const id = this.generateId(currentSkillOrQuestion, currentSkillOrQuestion);
            const q = this.questions.get(id);

            if (q && q.candidateAnswer !== rawVal) {
              this.answerQuestion(id, rawVal);
              updatedCount++;
              details.push(`${currentSkillOrQuestion} -> ${rawVal}`);
            }
            currentSkillOrQuestion = null;
          }
        }
      }

      if (updatedCount > 0) {
        log.success(`[Sync Markdown] ${updatedCount} réponse(s) synchronisée(s) depuis QUESTIONS_A_REMPLIR.md.`);
      }
      return { updatedCount, details };
    } catch (err) {
      log.error(`Erreur lecture QUESTIONS_A_REMPLIR.md : ${(err as Error).message}`);
      return { updatedCount: 0, details: [] };
    }
  }

  /**
   * Affiche la liste des questions à remplir dans le terminal (CLI) à la fin d'un tour.
   */
  public static displayTourQuestionsCli(): void {
    this.init();
    const pending = this.getPendingQuestions();
    const all = this.getAllQuestions();

    console.log(`\n${colors.cyan}${colors.bold}`);
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║       📋 SUITE DE QUESTIONS CANDIDAT À REMPLIR POUR LE TOUR SUIVANT  ║');
    console.log('║        (Permet au bot d\'être 100% précis lors des prochaines offres) ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log(`${colors.reset}`);

    if (pending.length === 0) {
      console.log(
        `${colors.green}✔ Toutes les compétences et questions ont été validées avec précision !${colors.reset}`
      );
      console.log(
        `  Le bot dispose de toutes les informations requises pour postuler sans approximation.\n`
      );
      return;
    }

    console.log(
      `${colors.yellow}ℹ Le bot a appliqué des valeurs par défaut (3 ans pour compétences inconnues) lors de ce tour.${colors.reset}`
    );
    console.log(
      `${colors.bold}Voici les questions à préciser avant votre prochaine session :${colors.reset}\n`
    );

    let index = 1;
    for (const q of pending) {
      if (q.category === 'years_skill') {
        const skillName = (q.skillName || 'Compétence').toUpperCase();
        console.log(
          `  ${colors.magenta}[${index}]${colors.reset} ⏳ ${colors.bold}${skillName}${colors.reset} : Répondu ${colors.yellow}3 ans${colors.reset} (par défaut)`
        );
        console.log(`      Question : "${q.questionText}"`);
        console.log(`      👉 Vos vraies années d'expérience à renseigner.`);
      } else {
        console.log(
          `  ${colors.blue}[${index}]${colors.reset} ❓ ${colors.bold}${q.questionText}${colors.reset}`
        );
        console.log(`      Réponse temporaire du bot : "${colors.yellow}${q.botAnswer}${colors.reset}"`);
      }
      console.log('');
      index++;
    }

    console.log(`${colors.bold}Comment renseigner ces réponses ?${colors.reset}`);
    console.log(`  1. Ouvrez et complétez le fichier : ${colors.green}QUESTIONS_A_REMPLIR.md${colors.reset}`);
    console.log(`  2. Ou ouvrez le Dashboard : ${colors.cyan}http://localhost:3000${colors.reset} (Onglet "Questions Candidat")\n`);
  }

  /**
   * Propose au candidat de répondre interactivement dans la console avant de quitter ou d'enchaîner.
   */
  public static async promptCandidateQuestionsCli(): Promise<void> {
    this.init();
    const pending = this.getPendingQuestions();
    if (pending.length === 0) return;

    this.displayTourQuestionsCli();

    const answerNow = await promptUser(
      'Souhaitez-vous préciser vos années d\'expérience pour ces compétences maintenant ? (o/N) :'
    );

    if (/^o|oui|y|yes$/i.test(answerNow)) {
      for (const q of pending) {
        if (q.category === 'years_skill' && q.skillName) {
          const inputVal = await promptUser(
            `Combien d'années d'expérience avez-vous avec "${q.skillName.toUpperCase()}" ? (Entrée pour garder 3 ans) :`
          );
          if (inputVal.trim()) {
            this.answerQuestion(q.id, inputVal.trim());
          }
        } else {
          const inputVal = await promptUser(
            `Votre réponse pour "${q.questionText}" (Actuel: ${q.botAnswer}) :`
          );
          if (inputVal.trim()) {
            this.answerQuestion(q.id, inputVal.trim());
          }
        }
      }
      log.success('Vos réponses ont été enregistrées ! Le bot sera plus précis au prochain tour.');
    }
  }
}
