import { CONFIG } from '../config.js';
import { CVExtractor, type ExtractedCVProfile, type CandidateDomain } from './cvExtractor.js';

export type JobDomain =
  | CandidateDomain
  | 'fullstack'
  | 'backend_java'
  | 'frontend_react'
  | 'data_ai'
  | 'other';

export interface JobMatchResult {
  isMatch: boolean;
  score: number; // 0 à 100
  reasons: string[];
  matchedKeywords: string[];
  primaryDomain: JobDomain;
  matchGrade?: 'A+' | 'A' | 'B' | 'C' | 'D';
  recommendation?: string;
  missingKeywords?: string[];
  breakdown?: {
    roleScore: number;
    skillsScore: number;
    toolsScore: number;
    seniorityBonus: number;
    contextBonus: number;
  };
}

/**
 * Moteur universel de qualification et notation d'offres (JobScorer).
 * Entièrement adapté à TOUS les métiers : Achats, Logistique, Marketing, Finance, RH, Tech, etc.
 * Analyse les compétences réelles et le domaine du candidat sans biais rigide.
 */
export class JobScorer {
  /**
   * Évalue une offre d'emploi et calcule un score de pertinence entre 0 et 100.
   */
  public static evaluateJob(
    title: string,
    company: string = '',
    snippet: string = '',
    customProfile?: ExtractedCVProfile | null
  ): JobMatchResult {
    const lowerTitle = title.toLowerCase();
    const lowerCompany = company.toLowerCase();
    const lowerSnippet = snippet.toLowerCase();
    const fullText = `${lowerTitle} ${lowerCompany} ${lowerSnippet}`;

    const reasons: string[] = [];
    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    // Profil CV actif
    const activeProfile: ExtractedCVProfile | null = customProfile || CVExtractor.loadSavedProfile();
    const candidateDomain: CandidateDomain = activeProfile?.candidate.domain || 'tech_it';

    // 1. VÉRIFICATION DES EXCLUSIONS ABSOLUES (Score = 0)
    // A. Entreprise sur liste noire
    for (const blacklisted of CONFIG.jobSearch.blacklistedCompanies) {
      if (lowerCompany.includes(blacklisted.toLowerCase())) {
        return {
          isMatch: false,
          score: 0,
          reasons: [`Entreprise exclue : "${blacklisted}"`],
          matchedKeywords: [],
          primaryDomain: 'other',
          matchGrade: 'D',
          recommendation: 'Rejet strict (Entreprise sur liste noire)',
        };
      }
    }

    // B. Mots-clés de rejet strict (Stage, Alternance, etc. sauf si recherché)
    const excludedList = [
      ...CONFIG.jobSearch.excludedKeywords,
      ...(activeProfile?.searchRecommendations.excludedKeywords || []),
    ];
    const uniqueExcluded = Array.from(new Set(excludedList));
    for (const excluded of uniqueExcluded) {
      const regex = new RegExp(`\\b${excluded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerTitle)) {
        return {
          isMatch: false,
          score: 0,
          reasons: [`Mot-clé exclu dans le titre : "${excluded}"`],
          matchedKeywords: [],
          primaryDomain: 'other',
          matchGrade: 'D',
          recommendation: 'Rejet strict (Offre stage/alternance non ciblée)',
        };
      }
    }

    // C. Rejet des postes sans qualification / télémarketing de masse
    const lowTierJobs = ['téléconseiller', 'teleconseiller', 'saisie de données', 'distributeur', 'hôte d\'accueil'];
    for (const spamRole of lowTierJobs) {
      if (lowerTitle.includes(spamRole)) {
        return {
          isMatch: false,
          score: 0,
          reasons: [`Poste hors qualification : "${spamRole}"`],
          matchedKeywords: [],
          primaryDomain: 'other',
          matchGrade: 'D',
          recommendation: 'Rejet (Niveau non adéquat)',
        };
      }
    }

    // 2. CALCUL DYNAMIQUE DU SCORE PAR RAPPORT AU PROFIL & DOMAINE DU CANDIDAT
    let roleScore = 0;
    let skillsScore = 0;
    let toolsScore = 0;
    let seniorityBonus = 0;
    let contextBonus = 0;

    // A. ALIGNEMENT DU RÔLE / TITRE DE POSTE (Jusqu'à 35 pts)
    const roleChecks: Record<CandidateDomain, { regex: RegExp; label: string; score: number }[]> = {
      achats_sourcing: [
        { regex: /\b(achats?|acheteu(?:r|se)|procurement|sourcing)\b/i, label: 'Poste Achats / Sourcing (+35)', score: 35 },
        { regex: /\b(approvisionneu(?:r|se)|fournisseurs?)\b/i, label: 'Rôle Approvisionnement / Fournisseurs (+25)', score: 25 },
      ],
      logistique_supply: [
        { regex: /\b(supply\s*chain|logistique|logistics|logisticien)\b/i, label: 'Poste Supply Chain / Logistique (+35)', score: 35 },
        { regex: /\b(stocks?|transport|entrep[oô]t|fret|adv|flux)\b/i, label: 'Rôle Logistique / Stocks / Transport (+25)', score: 25 },
      ],
      marketing_communication: [
        { regex: /\b(marketing|growth|webmarketing)\b/i, label: 'Poste Marketing / Growth (+35)', score: 35 },
        { regex: /\b(traffic\s*manager|social\s*media|communication|brand|seo|crm)\b/i, label: 'Rôle Marketing / Digital (+25)', score: 25 },
      ],
      finance_comptabilite: [
        { regex: /\b(contr[oô]leur\s*de\s*gestion|contr[oô]le\s*de\s*gestion|financial\s*controller|daf|finance|financier)\b/i, label: 'Poste Finance / Contrôle de gestion (+35)', score: 35 },
        { regex: /\b(comptable|comptabilit[eé]|audit|tr[eé]sorer|bilan)\b/i, label: 'Rôle Finance & Comptabilité (+25)', score: 25 },
      ],
      rh_recrutement: [
        { regex: /\b(talent\s*acquisition|recrutement|recruteur|rrh|ressources\s*humaines)\b/i, label: 'Poste RH / Recrutement (+35)', score: 35 },
        { regex: /\b(paie|sirh|onboarding|gestionnaire\s*de\s*paie)\b/i, label: 'Rôle Recrutement / RH (+25)', score: 25 },
      ],
      commercial_vente: [
        { regex: /\b(business\s*developer|account\s*manager|ing[eé]nieur\s*commercial|commercial|sales)\b/i, label: 'Poste Commercial B2B (+35)', score: 35 },
        { regex: /\b(vente|prospection|d[eé]veloppement\s*commercial)\b/i, label: 'Rôle Vente / Développement (+25)', score: 25 },
      ],
      tech_it: [
        { regex: /\b(full\s*stack|fullstack|full-stack)\b/i, label: 'Poste Full Stack (+35)', score: 35 },
        { regex: /\b(ingénieur|ingenieur|engineer|concepteur|développeur|developpeur|architecte|lead\s*dev)\b/i, label: 'Titre Ingénieur / Développeur (+20)', score: 20 },
      ],
      polyvalent: [
        { regex: /\b(responsable|manager|chef\s*de\s*projet|coordinateur|consultant)\b/i, label: 'Rôle Management / Coordination (+30)', score: 30 },
      ],
    };

    const domainRuleSet = roleChecks[candidateDomain] || roleChecks['tech_it'];
    for (const rule of domainRuleSet) {
      if (rule.regex.test(lowerTitle)) {
        roleScore = Math.max(roleScore, rule.score);
        reasons.push(rule.label);
        matchedKeywords.push(rule.label.split(' ')[1] || 'Rôle Cible');
        break;
      }
    }

    // Si pas de match titre direct, vérifier si mentionné dans le snippet
    if (roleScore === 0) {
      for (const rule of domainRuleSet) {
        if (rule.regex.test(lowerSnippet)) {
          roleScore = Math.max(roleScore, 15);
          reasons.push('Mention du rôle dans le descriptif (+15)');
          break;
        }
      }
    }

    // B. MATCH DES COMPÉTENCES CLÉS DU CANDIDAT (Jusqu'à 45 pts)
    const candidateSkills = activeProfile?.skills.weighted || {
      'java': 3,
      'spring boot': 3,
      'react': 3,
      'typescript': 3,
      'microservices': 2,
    };

    // Vérifier les compétences du candidat dans l'offre avec détection souple des sous-termes
    for (const [skill, weight] of Object.entries(candidateSkills)) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const subTerms = skill.split(/[\s,&/]+/).filter((w) => w.length >= 4);
      const pattern = [escaped, ...subTerms.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))].join('|');
      const regex = new RegExp(`\\b(${pattern})\\b`, 'i');

      const inTitle = regex.test(lowerTitle);
      const inText = inTitle || regex.test(lowerSnippet);

      if (inText) {
        let pts = weight === 3 ? (inTitle ? 20 : 12) : (inTitle ? 12 : 8);
        skillsScore += pts;
        matchedKeywords.push(skill);
        reasons.push(`${skill.charAt(0).toUpperCase() + skill.slice(1)} requis (+${pts})`);
      }
    }
    skillsScore = Math.min(45, skillsScore);

    // C. OUTILS, LOGICIELS & MÉTHODOLOGIES DU DOMAINE (Jusqu'à 15 pts)
    const toolsRegex = /\b(sap|wms|tms|crm|salesforce|hubspot|power\s*bi|excel|vba|jira|scrum|docker|ci\/cd|ifrs|google\s*ads|seo)\b/gi;
    const toolsMatches = fullText.match(toolsRegex);
    if (toolsMatches && toolsMatches.length > 0) {
      const uniqueTools = Array.from(new Set(toolsMatches.map((t) => t.toLowerCase())));
      const toolPts = Math.min(15, uniqueTools.length * 6);
      toolsScore += toolPts;
      matchedKeywords.push(...uniqueTools.map((t) => t.toUpperCase()));
      reasons.push(`Outils & Méthodologies maîtrisés : ${uniqueTools.join(', ')} (+${toolPts})`);
    }

    // D. SÉNIORITÉ / NIVEAU REQUIS (+10 pts)
    if (/\b(confirmé|confirme|mid|senior|lead|cadre|responsable|manager)\b/i.test(lowerTitle)) {
      seniorityBonus += 10;
      reasons.push('Niveau confirmé / Cadre adéquat (+10)');
    }

    // E. SECTEUR & CONTEXTE (+10 pts)
    if (/\b(luxe|banque|finance|bnp|groupe|international|saas|e-commerce|industrie)\b/i.test(fullText)) {
      contextBonus += 10;
      reasons.push('Secteur d\'envergure compatible (+10)');
    }

    // Rejet si rôle divergent strict (ex: offre pur PHP/WordPress pour un dev Java/React, ou pur mécanique pour un contrôleur de gestion)
    if (candidateDomain === 'tech_it') {
      const isPureDivergentTech = /\b(php|symfony|laravel|drupal|wordpress|\.net|c#|asp\.net|cobol|flutter|swift|ios dev)\b/i.test(lowerTitle);
      const hasAnyCandidateTech = /java\b|spring|react|typescript|\bts\b|full\s*stack|fullstack|datawarehouse/i.test(fullText);
      if (isPureDivergentTech && !hasAnyCandidateTech) {
        return {
          isMatch: false,
          score: 10,
          reasons: ['Stack concurrente exclusive (sans techno cible du candidat)'],
          matchedKeywords: [],
          primaryDomain: 'other',
          matchGrade: 'D',
          recommendation: 'Rejet (Technologies divergentes)',
        };
      }
    }

    // Score total brut plafonné à 100
    const rawScore = roleScore + skillsScore + toolsScore + seniorityBonus + contextBonus;
    const score = Math.min(100, Math.max(0, rawScore));

    // Détermination du domaine principal de l'offre
    let primaryDomain: JobMatchResult['primaryDomain'] = candidateDomain;
    if (score < 30) {
      primaryDomain = 'other';
    } else if (candidateDomain === 'tech_it') {
      const hasFullstack = /\b(full\s*stack|fullstack)\b/i.test(fullText);
      const hasJava = /\b(java|spring)\b/i.test(fullText);
      const hasReact = /\b(react|frontend|front-end)\b/i.test(fullText);

      if (hasFullstack || (hasJava && hasReact)) {
        primaryDomain = 'fullstack';
      } else if (hasJava) {
        primaryDomain = 'backend_java';
      } else if (hasReact) {
        primaryDomain = 'frontend_react';
      } else if (/big\s*data|ia\b|data/i.test(fullText)) {
        primaryDomain = 'data_ai';
      } else {
        primaryDomain = 'tech_it';
      }
    }

    // Détection des compétences manquantes
    const topCandidateSkills = Object.keys(candidateSkills).slice(0, 4);
    for (const sk of topCandidateSkills) {
      if (!matchedKeywords.some((m) => m.toLowerCase().includes(sk.toLowerCase()))) {
        missingKeywords.push(sk);
      }
    }

    // Grade & Recommandation ATS
    let matchGrade: JobMatchResult['matchGrade'] = 'D';
    let recommendation = 'Non recommandé';

    if (score >= 80) {
      matchGrade = 'A+';
      recommendation = '🌟 Top Match Exceptionnel : Postuler en priorité absolue !';
    } else if (score >= 65) {
      matchGrade = 'A';
      recommendation = '🎯 Très forte adéquation avec votre profil et votre métier.';
    } else if (score >= 50) {
      matchGrade = 'B';
      recommendation = '✅ Bonne opportunité professionnelle compatible.';
    } else if (score >= 35) {
      matchGrade = 'C';
      recommendation = '⚠️ Adéquation partielle, vérifiez les prérequis détaillés.';
    } else {
      matchGrade = 'D';
      recommendation = '❌ Offre hors cible ou score d\'adéquation trop faible.';
    }

    const minScore = CONFIG.minMatchScore || 50;
    const isMatch = score >= minScore;

    if (!isMatch) {
      reasons.push(`Score insuffisant (${score}/${minScore} requis)`);
    }

    return {
      isMatch,
      score,
      reasons,
      matchedKeywords: Array.from(new Set(matchedKeywords)),
      primaryDomain,
      matchGrade,
      recommendation,
      missingKeywords: missingKeywords.slice(0, 3),
      breakdown: {
        roleScore,
        skillsScore,
        toolsScore,
        seniorityBonus,
        contextBonus,
      },
    };
  }
}
