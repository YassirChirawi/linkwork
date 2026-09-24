import { Locator, Page } from 'playwright';
import { CONFIG } from '../config.js';
import { log } from './cli.js';
import { humanType, humanDelay } from './humanize.js';
import { CVExtractor } from './cvExtractor.js';

export interface FormSolverResult {
  handled: boolean;
  field: string;
  value: string;
  source: 'profile' | 'skills_map' | 'inferred' | 'ai_gemini' | 'rule_fallback';
}

/**
 * Cerveau Intelligent de Résolution des Formulaires (SmartFormSolver).
 * Gère avec précision et 100% d'autonomie tous les types de champs :
 * - Questions d'expérience (années d'expérience spécifiques ou globales)
 * - Textes, nombres et prétentions salariales
 * - Questions Oui/Non (analyse de polarité sémantique)
 * - Menus déroulants (Select natifs et custom Artdeco dropdowns)
 * - Sélection et vérification de CV
 * - Textareas et questions ouvertes (pitch contextuel ou IA)
 * - Checkboxes de consentement et RGPD
 */
export class SmartFormSolver {
  /**
   * Résout intelligemment un champ texte, numérique ou textarea.
   */
  public static async solveTextInput(
    page: Page,
    input: Locator,
    modal: Locator,
    jobTitle: string = '',
    force: boolean = false
  ): Promise<FormSolverResult> {
    const inputType = ((await input.getAttribute('type').catch(() => '')) || 'text').toLowerCase();
    const inputMode = ((await input.getAttribute('inputmode').catch(() => '')) || '').toLowerCase();
    const isTextarea = (await input.evaluate((el) => el.tagName.toLowerCase()).catch(() => '')) === 'textarea';

    // Extraction du libellé associé
    const labelText = await this.extractLabel(input, modal);
    const lowerLabel = labelText.toLowerCase();

    let valueToType = '';
    let source: FormSolverResult['source'] = 'rule_fallback';

    const isNumericExpected =
      inputType === 'number' ||
      inputMode === 'numeric' ||
      /(?:combien|how\s*many|years?|ans\b|nombre|années|total|expérience|experience|salaire|salary|taux|tjm|préavis|notice|code postal|postal code|zip|phone|téléphone)/i.test(lowerLabel);

    // 1. Prénom / Nom
    if (/prénom|prenom|first\s*name/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.firstName;
      source = 'profile';
    } else if (/nom|last\s*name|family\s*name/i.test(lowerLabel) && !/prénom/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.lastName;
      source = 'profile';
    }
    // 2. Téléphone / Email
    else if (/téléphone|telephone|phone|mobile|tel\b/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.phone;
      source = 'profile';
    } else if (/email|courriel|mail\b/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.email;
      source = 'profile';
    }
    // 3. Ville / Code postal / Adresse / Pays
    else if (/code\s*postal|postal\s*code|zip/i.test(lowerLabel)) {
      valueToType = '94000'; // Code postal Créteil / Paris
      source = 'profile';
    } else if (/ville|city|commune|résidence|locality/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.city || 'Créteil';
      source = 'profile';
    } else if (/pays|country/i.test(lowerLabel)) {
      valueToType = 'France';
      source = 'profile';
    } else if (/adresse|address/i.test(lowerLabel)) {
      valueToType = `${CONFIG.candidate.city || 'Créteil'}, France`;
      source = 'profile';
    }
    // 4. Liens web (LinkedIn, GitHub, Portfolio)
    else if (/github/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.links.github;
      source = 'profile';
    } else if (/linkedin/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.links.linkedin;
      source = 'profile';
    } else if (/portfolio|site|website|vitrine|blog/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.links.portfolio;
      source = 'profile';
    }
    // 5. Formation & Éducation
    else if (/diplôme|diplome|degree|niveau d['’]étude/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.education.highestDegree;
      source = 'profile';
    } else if (/école|ecole|school|université|university/i.test(lowerLabel)) {
      valueToType = CONFIG.candidate.education.school;
      source = 'profile';
    }
    // 6. Rémunération / Prétentions salariales
    else if (/salaire|salary|prétention|remuneration|rémunération|compensation/i.test(lowerLabel)) {
      const annualExp = parseInt(String(CONFIG.candidate.salaryExpectation || '65000').replace(/\D+/g, ''), 10) || 65000;
      if (/k€|k\s*euros|en\s*k|en\s*milliers/i.test(lowerLabel)) {
        valueToType = String(Math.round(annualExp / 1000)); // ex: 65
      } else if (/mensuel|mois|monthly/i.test(lowerLabel)) {
        valueToType = String(Math.round(annualExp / 12)); // ex: 5400
      } else if (/tjm|journalier|daily/i.test(lowerLabel)) {
        valueToType = '550';
      } else {
        valueToType = String(annualExp);
      }
      source = 'profile';
    }
    // 7. Disponibilité & Préavis
    else if (/préavis|preavis|notice|disponib|start\s*date|délai/i.test(lowerLabel)) {
      if (isNumericExpected) {
        if (/semaine|weeks/i.test(lowerLabel)) {
          valueToType = '4';
        } else if (/mois|months/i.test(lowerLabel)) {
          valueToType = '1';
        } else {
          valueToType = '30'; // 30 jours
        }
      } else {
        valueToType = '1 mois (négociable)';
      }
      source = 'profile';
    }
    // 8. Questions d'années d'expérience (compétence spécifique ou expérience globale)
    else if (/(?:combien|how\s*many|years?|ans\b|expérience|experience|ancienneté)/i.test(lowerLabel)) {
      const years = this.resolveYearsOfExperience(lowerLabel);
      valueToType = String(years);
      source = 'skills_map';
    }
    // 9. Questions fermées de type Oui / Non posées dans un champ texte libre
    else if (/(?:oui\s*ou\s*non|yes\s*or\s*no|avez-vous|do\s*you\s*have|êtes-vous|are\s*you)/i.test(lowerLabel) && !isNumericExpected) {
      if (this.isNegativePolarityQuestion(lowerLabel)) {
        valueToType = 'Non';
      } else {
        valueToType = 'Oui';
      }
      source = 'inferred';
    }
    // 10. Questions de motivation / Pitch ouvert / Textareas
    else if (
      isTextarea ||
      /lettre|motivation|pitch|pourquoi|présent|décrivez|describe|about you|cover letter|message|introduction/i.test(lowerLabel)
    ) {
      valueToType = await this.generateContextualPitch(labelText, jobTitle);
      source = CONFIG.geminiApiKey ? 'ai_gemini' : 'profile';
    }
    // 11. Repli par défaut intelligent et sécurisé
    else {
      if (isNumericExpected) {
        // Toujours un nombre positif réaliste pour éviter le rejet ATS Knockout
        valueToType = String(Math.max(2, Math.round((CONFIG.candidate.experienceYears || 4) * 0.75)));
        source = 'inferred';
      } else {
        valueToType = CONFIG.candidate.summaryPitch;
        source = 'inferred';
      }
    }

    // Normalisation absolue pour les champs numériques
    if (isNumericExpected) {
      const cleaned = valueToType.replace(/\D+/g, '');
      valueToType = cleaned || '4';
    }

    log.human(`[SmartForm] "${labelText.slice(0, 42)}" -> Saisie: "${valueToType.slice(0, 32)}" (${source})`);
    await humanType(page, input, valueToType);
    await humanDelay(150, 400);

    return {
      handled: true,
      field: labelText,
      value: valueToType,
      source,
    };
  }

  /**
   * Résout intelligemment un groupe de boutons radio (Oui/Non ou choix exclusifs).
   */
  public static async solveRadioFieldset(page: Page, fieldset: Locator): Promise<boolean> {
    const legendEl = fieldset.locator('legend, .fb-form-element-label, label').first();
    const legend = (await legendEl.innerText().catch(() => '')).trim();
    const lowerLegend = legend.toLowerCase();

    const radios = await fieldset.locator('label, div[role="radio"], input[type="radio"]').all();
    if (radios.length === 0) return false;

    // Détermination de la polarité attendue
    let targetChoice: 'yes' | 'no' = 'yes';
    if (this.isNegativePolarityQuestion(lowerLegend)) {
      targetChoice = 'no';
    } else {
      targetChoice = 'yes';
    }

    const yesPatterns = ['oui', 'yes', 'vrai', 'true', 'd’accord', "j'accepte", 'autorisé', 'permis', 'bac+5'];
    const noPatterns = ['non', 'no', 'faux', 'false', 'refuser', 'aucun', 'never'];

    for (const radio of radios) {
      const text = (await radio.innerText().catch(() => '')).trim().toLowerCase();
      const isTarget =
        targetChoice === 'yes'
          ? yesPatterns.some((p) => text.includes(p))
          : noPatterns.some((p) => text.includes(p));

      if (isTarget) {
        log.human(`[SmartForm Radio] "${legend.slice(0, 40)}" -> Sélection : "${text}"`);
        await radio.click({ force: true }).catch(() => null);
        await humanDelay(150, 350);
        return true;
      }
    }

    // Repli par défaut : premier choix
    const firstOption = radios[0];
    const text = (await firstOption.innerText().catch(() => '')).trim();
    log.human(`[SmartForm Radio Fallback] Sélection : "${text}"`);
    await firstOption.click({ force: true }).catch(() => null);
    return true;
  }

  /**
   * Résout intelligemment un menu déroulant (<select>).
   */
  public static async solveSelect(page: Page, select: Locator, force: boolean = false): Promise<boolean> {
    const currentVal = await select.inputValue().catch(() => '');
    const currentLabel = await select.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text || '').catch(() => '');

    if (!force && currentVal && !/sélectionner|select|choisir|choose/i.test(currentLabel)) {
      return true; // Déjà sélectionné valablement
    }

    const options = await select.locator('option').all();
    if (options.length === 0) return false;

    const selectText = await this.extractLabel(select, select.page().locator('body'));
    const lowerLabel = selectText.toLowerCase();

    // 1. Déroulant d'années d'expérience
    if (/(?:combien|how\s*many|years|ans\b|expérience|experience|ancienneté)/i.test(lowerLabel)) {
      const targetYears = this.resolveYearsOfExperience(lowerLabel);
      
      // A. Recherche d'un match exact sur le nombre
      for (const opt of options) {
        const txt = (await opt.innerText().catch(() => '')).trim();
        if (/sélectionner|select|choisir/i.test(txt)) continue;

        if (new RegExp(`\\b${targetYears}\\b`, 'i').test(txt)) {
          const val = await opt.getAttribute('value');
          log.human(`[SmartForm Select Exp] "${selectText.slice(0, 35)}" -> "${txt}"`);
          await select.selectOption(val || { label: txt }).catch(() => null);
          return true;
        }

        // Intervalle (ex: "3-5 ans", "3 à 5 ans", "3 to 5")
        const rangeMatch = txt.match(/(\d+)\s*(?:-|à|to)\s*(\d+)/i);
        if (rangeMatch) {
          const min = parseInt(rangeMatch[1], 10);
          const max = parseInt(rangeMatch[2], 10);
          if (targetYears >= min && targetYears <= max) {
            const val = await opt.getAttribute('value');
            log.human(`[SmartForm Select Exp Range] "${selectText.slice(0, 35)}" -> "${txt}"`);
            await select.selectOption(val || { label: txt }).catch(() => null);
            return true;
          }
        }

        // Plus de X (ex: "5+ ans", "Plus de 3 ans")
        const plusMatch = txt.match(/(\d+)\s*(?:\+|plus)/i);
        if (plusMatch) {
          const min = parseInt(plusMatch[1], 10);
          if (targetYears >= min) {
            const val = await opt.getAttribute('value');
            log.human(`[SmartForm Select Exp Plus] "${selectText.slice(0, 35)}" -> "${txt}"`);
            await select.selectOption(val || { label: txt }).catch(() => null);
            return true;
          }
        }
      }

      // B. Si pas de match précis, choisir la première option non nulle
      for (const opt of options) {
        const txt = (await opt.innerText().catch(() => '')).trim();
        if (/sélectionner|select|choisir|^0\b|aucun|none|moins\s*d['’]un/i.test(txt)) continue;
        const val = await opt.getAttribute('value');
        await select.selectOption(val || { label: txt }).catch(() => null);
        return true;
      }
    }

    // 2. Déroulant Oui / Non
    const optionsTexts = await select.locator('option').allInnerTexts();
    const hasYes = optionsTexts.some((t) => /^(oui|yes)$/i.test(t.trim()));
    const hasNo = optionsTexts.some((t) => /^(non|no)$/i.test(t.trim()));

    if (hasYes && hasNo) {
      const isNegative = this.isNegativePolarityQuestion(lowerLabel);
      const targetRegex = isNegative ? /^(non|no)$/i : /^(oui|yes)$/i;

      for (const opt of options) {
        const txt = (await opt.innerText().catch(() => '')).trim();
        if (targetRegex.test(txt)) {
          const val = await opt.getAttribute('value');
          log.human(`[SmartForm Select Oui/Non] "${selectText.slice(0, 35)}" -> "${txt}"`);
          await select.selectOption(val || { label: txt }).catch(() => null);
          return true;
        }
      }
    }

    // 3. Déroulant Langues (Anglais / Français)
    if (/anglais|english/i.test(lowerLabel)) {
      const opt = optionsTexts.find((t) => /courant|fluent|bilingue|c1|c2|professional|avancé/i.test(t));
      if (opt) {
        await select.selectOption({ label: opt }).catch(() => null);
        return true;
      }
    } else if (/français|french/i.test(lowerLabel)) {
      const opt = optionsTexts.find((t) => /natif|native|courant|bilingue|c2/i.test(t));
      if (opt) {
        await select.selectOption({ label: opt }).catch(() => null);
        return true;
      }
    }

    // 4. Déroulant Diplôme / Formation
    if (/diplôme|diplome|degree|études|education/i.test(lowerLabel)) {
      const opt = optionsTexts.find((t) => /master|bac\s*\+\s*5|bac\+5|ingénieur|engineer|niveau 7/i.test(t));
      if (opt) {
        await select.selectOption({ label: opt }).catch(() => null);
        return true;
      }
    }

    // 5. Déroulant Disponibilité / Préavis
    if (/disponib|préavis|notice/i.test(lowerLabel)) {
      const opt = optionsTexts.find((t) => /1\s*mois|immédiat|immediate|< 1 mois/i.test(t));
      if (opt) {
        await select.selectOption({ label: opt }).catch(() => null);
        return true;
      }
    }

    // 6. Déroulant Type de contrat
    if (/contrat|contract/i.test(lowerLabel)) {
      const opt = optionsTexts.find((t) => /cdi|permanent|full-time|temps plein/i.test(t));
      if (opt) {
        await select.selectOption({ label: opt }).catch(() => null);
        return true;
      }
    }

    // 7. Déroulant Diversité / Genre / EEO
    if (/genre|gender|sexe/i.test(lowerLabel)) {
      const opt = optionsTexts.find((t) => /ne souhaite pas|decline|prefer not|homme|male/i.test(t));
      if (opt) {
        await select.selectOption({ label: opt }).catch(() => null);
        return true;
      }
    }

    // 8. Repli universel : première option valide non vide
    for (const opt of options) {
      const txt = (await opt.innerText().catch(() => '')).trim();
      if (!txt || /sélectionner|select|choisir|choose/i.test(txt)) continue;
      const val = await opt.getAttribute('value');
      log.human(`[SmartForm Select Fallback] "${selectText.slice(0, 30)}" -> "${txt}"`);
      await select.selectOption(val || { label: txt }).catch(() => null);
      return true;
    }

    return false;
  }

  /**
   * Résout les menus déroulants personnalisés Artdeco de LinkedIn.
   */
  public static async solveCustomDropdowns(page: Page, modal: Locator): Promise<void> {
    const triggers = await modal.locator(
      'button[aria-haspopup="listbox"], div.fb-dropdown button, [data-test-form-builder-dropdown] button'
    ).all();

    for (const trigger of triggers) {
      if (!(await trigger.isVisible().catch(() => false))) continue;
      const currentText = (await trigger.innerText().catch(() => '')).trim();

      // Si le menu est déjà renseigné, ne pas toucher
      if (currentText && !/sélectionner|select|choisir|choose/i.test(currentText)) continue;

      const questionLabel = await this.extractLabel(trigger, modal);
      const lower = questionLabel.toLowerCase();

      log.human(`[SmartForm Custom Dropdown] Détection: "${questionLabel.slice(0, 40)}"`);
      await trigger.click().catch(() => null);
      await humanDelay(250, 450);

      // Chercher les options ouvertes
      const listbox = modal.locator('ul[role="listbox"], .artdeco-dropdown__content-inner, [role="listbox"]').first();
      if (await listbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        const items = await listbox.locator('li, [role="option"]').all();
        if (items.length === 0) continue;

        let selected = false;

        // Si question Oui/Non
        if (this.isNegativePolarityQuestion(lower)) {
          const noItem = listbox.locator('li:has-text("Non"), [role="option"]:has-text("No")').first();
          if (await noItem.isVisible().catch(() => false)) {
            await noItem.click().catch(() => null);
            selected = true;
          }
        } else {
          const yesItem = listbox.locator('li:has-text("Oui"), [role="option"]:has-text("Yes")').first();
          if (await yesItem.isVisible().catch(() => false)) {
            await yesItem.click().catch(() => null);
            selected = true;
          }
        }

        // Si question d'expérience
        if (!selected && /(?:combien|years|ans\b|expérience|experience)/i.test(lower)) {
          const targetExp = this.resolveYearsOfExperience(lower);
          for (const item of items) {
            const txt = (await item.innerText().catch(() => '')).trim();
            if (new RegExp(`\\b${targetExp}\\b`, 'i').test(txt)) {
              await item.click().catch(() => null);
              selected = true;
              break;
            }
          }
        }

        // Repli : cliquer sur le premier item valide
        if (!selected && items.length > 0) {
          const fallbackItem = items[items.length > 1 ? 1 : 0];
          await fallbackItem.click().catch(() => null);
        }
        await humanDelay(200, 400);
      }
    }
  }

  /**
   * Coche un CV déjà téléversé sur LinkedIn si aucun n'est sélectionné.
   */
  public static async solveResumeSelection(modal: Locator): Promise<void> {
    const resumeCards = await modal.locator(
      'div.jobs-document-upload__card, div.jobs-document-upload__item, li.jobs-document-upload__item, input[type="radio"][name*="resume"]'
    ).all();

    if (resumeCards.length > 0) {
      const anyChecked = await modal.locator('input[type="radio"][name*="resume"]:checked, div.jobs-document-upload__card--selected').count();
      if (anyChecked === 0) {
        log.human('[SmartForm] Sélection automatique du CV existant sur LinkedIn');
        const firstCard = resumeCards[0];
        await firstCard.click().catch(() => null);
        await humanDelay(250, 450);
      }
    }
  }

  /**
   * Coche automatiquement les cases obligatoires (Consentement, RGPD).
   */
  public static async solveCheckboxes(modal: Locator): Promise<void> {
    const checkboxes = await modal.locator('input[type="checkbox"]').all();
    for (const cb of checkboxes) {
      if (!(await cb.isVisible().catch(() => false))) continue;
      const isChecked = await cb.isChecked().catch(() => false);
      if (!isChecked) {
        log.human('[SmartForm] Coche automatique de conformité / consentement');
        await cb.check({ force: true }).catch(async () => {
          await cb.evaluate((el: any) => {
            el.checked = true;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }).catch(() => {});
        });
        await humanDelay(150, 300);
      }
    }
  }

  /**
   * Auto-récupération intelligente si une erreur de validation bloque l'étape.
   */
  public static async autoRecoverStepErrors(page: Page, modal: Locator, jobTitle: string): Promise<void> {
    const errorContainers = await modal.locator(
      '.artdeco-inline-feedback--error, [data-test-form-element-error-message], .fb-form-element--error, [aria-invalid="true"]'
    ).all();

    log.human(`[SmartForm Recovery] Tentative de correction sur ${errorContainers.length} élément(s) bloquant(s)...`);

    for (const errEl of errorContainers) {
      if (!(await errEl.isVisible().catch(() => false))) continue;

      const container = errEl.locator('xpath=ancestor-or-self::div[contains(@class, "form-element") or contains(@class, "form__element") or contains(@class, "jobs-easy-apply") or contains(@class, "fb-")]').first();
      const scope = (await container.isVisible().catch(() => false)) ? container : modal;

      // 1. Champ texte/nombre
      const input = scope.locator('input[type="text"], input[type="number"], input:not([type]), textarea').first();
      if (await input.isVisible().catch(() => false)) {
        await this.solveTextInput(page, input, modal, jobTitle, true);
      }

      // 2. Radio
      const fieldset = scope.locator('fieldset').first();
      if (await fieldset.isVisible().catch(() => false)) {
        await this.solveRadioFieldset(page, fieldset);
      }

      // 3. Select
      const select = scope.locator('select').first();
      if (await select.isVisible().catch(() => false)) {
        await this.solveSelect(page, select, true);
      }

      // 4. Checkbox
      const cb = scope.locator('input[type="checkbox"]').first();
      if (await cb.isVisible().catch(() => false)) {
        await cb.check({ force: true }).catch(() => null);
      }
    }

    await this.solveCustomDropdowns(page, modal);
    await this.solveResumeSelection(modal);
  }

  /**
   * Calcule les années d'expérience avec précision selon le libellé de la question.
   */
  public static resolveYearsOfExperience(lowerLabel: string): number {
    const candidateExp = CONFIG.candidate.experienceYears || 4;

    // A. Question d'expérience globale ou totale
    if (
      /(?:totale?|globale?|overall|total|entière|all)\s*(?:years?|ans?|expérience|experience)|(?:years?|ans?)\s*(?:d['’]expérience\s*)?(?:totale?|globale?|overall)|d['’]expérience\s*professionnelle?\s*globale/i.test(lowerLabel) ||
      /(?:combien\s*d['’]années\s*d['’]expérience\s*(?:avez-vous|au\s*total)?|how\s*many\s*years\s*of\s*(?:total\s*)?experience\s*do\s*you\s*have)\s*[\?\:\.]?\s*$/i.test(lowerLabel)
    ) {
      return candidateExp;
    }

    // B. Recherche directe dans la matrice du candidat ou du CV
    const matched = this.findMatchingSkill(lowerLabel);
    if (matched) {
      return matched.years;
    }

    // C. Extraction du mot-clé de la compétence après un mot de liaison
    const keywordMatch = lowerLabel.match(/(?:avec|en|sur|with|using|in|sur le logiciel|sur l'outil)\s+([a-zA-Z0-9#+.\s-]{2,25}?)(?:\?|\:|\.|\(|\s*\(|$)/i);
    if (keywordMatch && keywordMatch[1]) {
      const extractedTerm = keywordMatch[1].trim();
      const extractedSkill = this.findMatchingSkill(extractedTerm);
      if (extractedSkill) {
        return extractedSkill.years;
      }
    }

    // D. Valeur réaliste positive par défaut (toujours entre 2 et 5 ans, JAMAIS 0)
    return Math.max(2, Math.min(5, Math.round(candidateExp * 0.75)));
  }

  /**
   * Trouve une correspondance floue dans la matrice des compétences du candidat ou du CV extrait.
   */
  public static findMatchingSkill(text: string): { name: string; years: number } | null {
    const lowerText = text.toLowerCase();

    // 1. Compétences du profil CV extrait
    const skillsMap: Record<string, number> = {};
    try {
      const cvProfile = CVExtractor.loadSavedProfile();
      if (cvProfile?.skills?.skillsMap) {
        Object.assign(skillsMap, cvProfile.skills.skillsMap);
      }
    } catch {
      // Ignorer si non disponible
    }

    // 2. Priorité absolue aux compétences explicitement configurées par l'utilisateur
    if (CONFIG.candidate.skillsMap) {
      Object.assign(skillsMap, CONFIG.candidate.skillsMap);
    }

    // 3. Synonymes et alias multi-métiers étendus (Tech, Achats, Logistique, Marketing, Finance, RH)
    const synonymMap: Record<string, string> = {
      // Tech
      spring: 'spring boot',
      springboot: 'spring boot',
      'spring-boot': 'spring boot',
      ts: 'typescript',
      js: 'javascript',
      reactjs: 'react',
      'react.js': 'react',
      postgres: 'postgresql',
      pgsql: 'postgresql',
      k8s: 'docker',
      kubernetes: 'docker',
      ci: 'jenkins',
      cd: 'jenkins',
      'ci/cd': 'jenkins',
      cicd: 'jenkins',
      rest: 'microservices',
      'api rest': 'microservices',
      restful: 'microservices',
      sql: 'sql',
      mysql: 'sql',
      // Achats & Sourcing
      procurement: 'achats',
      purchasing: 'achats',
      sourcing: 'sourcing',
      fournisseur: 'négociation fournisseurs',
      fournisseurs: 'négociation fournisseurs',
      ariba: 'sap mm',
      'sap srm': 'sap mm',
      // Logistique & Supply
      logistics: 'logistique',
      'supply-chain': 'supply chain',
      stock: 'gestion des stocks',
      stocks: 'gestion des stocks',
      entrepôt: 'wms',
      entrepot: 'wms',
      fret: 'transport international',
      transport: 'transport international',
      // Marketing
      growth: 'growth marketing',
      ads: 'sea & google ads',
      adwords: 'sea & google ads',
      hubspot: 'crm & emailing',
      salesforce: 'crm & emailing',
      ga4: 'analytics & kpi',
      // Finance
      contrôleur: 'contrôle de gestion',
      controleur: 'contrôle de gestion',
      comptable: 'comptabilité générale',
      compta: 'comptabilité générale',
      tréso: 'trésorerie & bfr',
      treso: 'trésorerie & bfr',
      fico: 'sap fi/co',
      // Transverse
      scrum: 'agile scrum',
      agile: 'agile scrum',
      jira: 'agile scrum',
      pmo: 'gestion de projet',
    };

    // Recherche directe
    for (const [key, years] of Object.entries(skillsMap)) {
      const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerText)) {
        return { name: key, years };
      }
    }

    // Recherche par synonyme
    for (const [synonym, mappedKey] of Object.entries(synonymMap)) {
      const regex = new RegExp(`\\b${synonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerText)) {
        const resolvedYears = skillsMap[mappedKey] || skillsMap[synonym] || 3;
        return { name: mappedKey, years: resolvedYears };
      }
    }

    return null;
  }

  /**
   * Analyse si la question est de polarité négative (la réponse favorable est NON).
   */
  public static isNegativePolarityQuestion(lowerText: string): boolean {
    return (
      /visa|sponsorship|parrainage|titre de séjour|besoin d'un visa|require sponsorship|require a visa/i.test(lowerText) ||
      /casier judiciaire|condamnation|conviction|crime|délit|felony/i.test(lowerText) ||
      /clause de non-concurrence|non-compete|non compete/i.test(lowerText) ||
      /conflit d'intérêts|conflit d'intérêt|conflict of interest/i.test(lowerText) ||
      /licenciement|faute grave|terminated for cause/i.test(lowerText)
    );
  }

  /**
   * Analyse si la question est de polarité positive (la réponse favorable est OUI).
   */
  public static isPositivePolarityQuestion(lowerText: string): boolean {
    return (
      /autoris|droit de travailler|authorized to work|right to work/i.test(lowerText) ||
      /permis|driver|conduire|véhicule/i.test(lowerText) ||
      /déplacement|deplacement|commute|trajet|mobilité|mobilite/i.test(lowerText) ||
      /télétravail|teletravail|remote|hybride|sur site|on-site/i.test(lowerText) ||
      /expérience|experience|diplôme|diplome|bac\s*\+\s*5|bac\+5|master|degree/i.test(lowerText) ||
      /background check|vérification|références|references/i.test(lowerText) ||
      /disponible|immédiat|immediate|start date/i.test(lowerText) ||
      /anglais|français|english|french/i.test(lowerText) ||
      /compétence|skill|maîtrise|knowledge/i.test(lowerText)
    );
  }

  /**
   * Extrait avec robustesse maximale le libellé textuel associé à un champ de formulaire LinkedIn.
   */
  public static async extractLabel(element: Locator, modal: Locator): Promise<string> {
    try {
      // 1. Attribut aria-labelledby (très fréquent sur LinkedIn React/Ember)
      const ariaLabelledBy = await element.getAttribute('aria-labelledby').catch(() => null);
      if (ariaLabelledBy) {
        const idTokens = ariaLabelledBy.split(/\s+/).filter(Boolean);
        for (const token of idTokens) {
          const labelledEl = modal.locator(`#${token}`).first();
          if (await labelledEl.isVisible().catch(() => false)) {
            const txt = (await labelledEl.innerText().catch(() => '')).trim();
            if (txt) return this.cleanLabel(txt);
          }
        }
      }

      // 2. Attribut aria-label direct
      const ariaLabel = (await element.getAttribute('aria-label').catch(() => '')) || '';
      if (ariaLabel.trim()) return this.cleanLabel(ariaLabel);

      // 3. Label HTML standard avec for="..."
      const inputId = await element.getAttribute('id').catch(() => null);
      if (inputId) {
        const label = modal.locator(`label[for="${inputId}"]`).first();
        if (await label.isVisible().catch(() => false)) {
          const txt = (await label.innerText().catch(() => '')).trim();
          if (txt) return this.cleanLabel(txt);
        }
      }

      // 4. Input englobé directement dans un <label>
      const parentLabel = element.locator('xpath=ancestor::label').first();
      if (await parentLabel.isVisible().catch(() => false)) {
        const txt = (await parentLabel.innerText().catch(() => '')).trim();
        if (txt) return this.cleanLabel(txt);
      }

      // 5. Recherche dans le conteneur englobant de formulaire LinkedIn
      const container = element.locator(
        'xpath=ancestor::div[contains(@class, "jobs-easy-apply-form-element") or contains(@class, "fb-form-element") or contains(@class, "form__element") or contains(@class, "artdeco-text-input--container") or contains(@class, "fb-dash-form-element") or contains(@class, "jobs-easy-apply-form-section__grouping")]'
      ).first();

      if (await container.isVisible().catch(() => false)) {
        const headerEl = container.locator('label, legend, .fb-form-element-label, span[aria-hidden="true"], .artdeco-text-input--label, p, h3').first();
        if (await headerEl.isVisible().catch(() => false)) {
          const txt = (await headerEl.innerText().catch(() => '')).trim();
          if (txt) return this.cleanLabel(txt);
        }
      }

      // 6. Placeholder
      const placeholder = (await element.getAttribute('placeholder').catch(() => '')) || '';
      if (placeholder.trim()) return this.cleanLabel(placeholder);

      // 7. Frère précédent (previous sibling)
      const prevSibling = element.locator('xpath=preceding-sibling::*[1]').first();
      if (await prevSibling.isVisible().catch(() => false)) {
        const txt = (await prevSibling.innerText().catch(() => '')).trim();
        if (txt) return this.cleanLabel(txt);
      }
    } catch {
      // Silencieux
    }

    return '';
  }

  private static cleanLabel(label: string): string {
    return label
      .replace(/\s*\*\s*/g, ' ')
      .replace(/\(obligatoire\)/gi, '')
      .replace(/\(required\)/gi, '')
      .replace(/\(facultatif\)/gi, '')
      .replace(/\(optional\)/gi, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Génère un pitch ciblé pour les questions de motivation ouvertes (avec Gemini ou template expert).
   */
  private static async generateContextualPitch(question: string, jobTitle: string): Promise<string> {
    const candidate = CONFIG.candidate;

    if (CONFIG.geminiApiKey) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.geminiApiKey}`;
        const prompt = `Tu es ${candidate.firstName} ${candidate.lastName}, professionnel diplômé (${candidate.education.highestDegree}, ${candidate.experienceYears} ans d'expérience).
Offre d'emploi ciblée : "${jobTitle}".
Question du formulaire de recrutement : "${question}".
Rédige une réponse professionnelle, concise et percutante (2 à 3 phrases maximum, en français soutenu) valorisant les compétences opérationnelles et la motivation.`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const generated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (generated) return generated;
        }
      } catch (err) {
        log.warn(`[SmartForm AI] Repli sur pitch local : ${(err as Error).message}`);
      }
    }

    return candidate.summaryPitch;
  }
}
