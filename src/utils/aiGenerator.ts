import { CONFIG } from '../config.js';

export interface GenerationResult {
  comment?: string;
  inviteNote: string;
  detectedTopic: string;
}

/**
 * Moteur de génération IA & sémantique contextuelle.
 * Analyse les publications LinkedIn et produit des commentaires d'expert
 * et des notes d'invitation hyper-pertinentes (< 300 caractères).
 */
export class AIGenerator {
  private geminiApiKey: string | undefined;

  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  /**
   * Analyse le contenu d'un post et génère un commentaire et une note d'invitation ciblée.
   */
  public async generateContent(options: {
    postText: string;
    authorName: string;
    authorHeadline?: string;
    context: 'saas_bayiin' | 'job_hunting';
  }): Promise<GenerationResult> {
    const { postText, authorName, authorHeadline = '', context } = options;
    const firstName = authorName.split(' ')[0] || 'Bonjour';

    // 1. Détection de la thématique dominante
    const topic = this.detectTopic(postText);

    // 2. Si une clé API Gemini est configurée, tenter l'appel IA
    if (this.geminiApiKey) {
      try {
        return await this.generateWithGemini({
          postText,
          firstName,
          authorHeadline,
          topic,
          context,
        });
      } catch (err) {
        console.warn('Fallback vers le moteur sémantique local:', (err as Error).message);
      }
    }

    // 3. Moteur sémantique expert local (Haute qualité sans dépendance externe)
    return this.generateWithExpertHeuristics({
      postText,
      firstName,
      authorHeadline,
      topic,
      context,
    });
  }

  /**
   * Détecte le sujet clé du post à partir du vocabulaire employé
   */
  private detectTopic(text: string): string {
    const lower = text.toLowerCase();

    if (/factur|devis|ice\b|dgi|dématérialis|dematerialis|trésorerie|tresorerie|impayé|relance client|compta|expert-comptable|logiciel de facturation|tva maroc|créance|encaissement/i.test(lower)) {
      return 'morocco_invoicing_management';
    }
    if (/e-commerce\s*(?:au\s*)?maroc|ecommerce\s*(?:au\s*)?maroc|boutique\s+(?:en\s+ligne|e-commerce|ecommerce)|vendre?\s+en\s+ligne|dropshipping\s*(?:au\s*)?maroc|paiement\s+(?:en\s+ligne|cmi)|cmi\b|livraison\s*(?:au\s*)?maroc|ventes?\s+en\s+ligne/i.test(lower)) {
      return 'morocco_ecommerce_growth';
    }
    if (/talent acquisition|recruteur|recrutement|rh\b|ressources humaines|chargé de recrutement|chargee de recrutement|responsable rh|head of talent/i.test(lower)) {
      return 'talent_acquisition_rh';
    }
    if (/cathedis|sendit|o-livraison|awb|bordereau|transport|livreur|retour|refus|npai|livraison|expédition/i.test(lower)) {
      return 'morocco_cod_logistics';
    }
    if (/marge|profit|rentab|trésor|ebitda|bfr|coût|encaissement|réconciliation|chiffre d'affaires/i.test(lower)) {
      return 'profit_margin_reconciliation';
    }
    if (/whatsapp|beya3|copilot|automatisation|bot|relance|conversion/i.test(lower)) {
      return 'whatsapp_copilot';
    }
    if (/marque|d2c|skincare|cosmétique|mode|prêt-à-porter|maroquinerie|décoration|boutique/i.test(lower)) {
      return 'd2c_brand_growth';
    }
    if (/media buyer|roas|acquisition|agence|growth|campagne|ads|facebook ads|tiktok/i.test(lower)) {
      return 'agency_growth_cod';
    }
    if (/java|spring|react|typescript|node|microservice|architecture|cloud|api\b/i.test(lower)) {
      return 'tech_architecture';
    }
    if (/recrut|embauche|talent|hiring|candidat|lead dev|cto|développeur/i.test(lower)) {
      return 'tech_recruiting';
    }
    return 'general_ecommerce_morocco';
  }

  /**
   * Détecte le persona BayIIn ciblé à partir de l'intitulé du poste et du profil
   */
  public detectPersona(headline: string, text: string = ''): 'd2c_founders' | 'ecom_ops_managers' | 'growth_agencies' | 'general' {
    const combined = `${headline} ${text}`.toLowerCase();

    // Persona 1 : Fondateurs et Gérants de marques D2C locales
    if (/fondat|co-fondat|fondatrice|ceo|gérant|gerant|brand owner|créateur|créatrice|founder|co-founder/i.test(combined) &&
        /marque|d2c|brand|skincare|cosmétique|mode|prêt-à-porter|maroquinerie|décoration|bijoux|accessoires|e-com/i.test(combined)) {
      return 'd2c_founders';
    }

    // Persona 2 : Responsables E-commerce et Opérations
    if (/e-commerce manager|responsable e-commerce|head of operations|coo|supply chain|directeur des opérations|responsable logistique|operations manager|traffic manager/i.test(combined)) {
      return 'ecom_ops_managers';
    }

    // Persona 3 : Agences de Growth et Consultants E-commerce COD
    if (/media buyer|head of acquisition|consultant e-commerce|growth marketer|agence e-commerce|acquisition manager|media buying|prescripteur/i.test(combined)) {
      return 'growth_agencies';
    }

    // Détection secondaire par mots-clés prioritaires
    if (/fondat|ceo|gérant|gerant|brand owner/i.test(combined)) {
      return 'd2c_founders';
    }
    if (/operations|logistique|supply chain|ops/i.test(combined)) {
      return 'ecom_ops_managers';
    }
    if (/growth|acquisition|ads|media buyer|agence/i.test(combined)) {
      return 'growth_agencies';
    }

    return 'general';
  }

  /**
   * Retourne la note pré-calibrée pour un persona BayIIn donné
   */
  public getPersonaPitch(personaId: string, firstName: string): string {
    const cleanName = firstName.trim() || 'Bonjour';
    switch (personaId) {
      case 'd2c_founders':
        return this.truncateNote(`Bonjour ${cleanName}, impressionné par votre marque au Maroc. Avec BayIIn, on aide les marques D2C à automatiser stocks et bordereaux AWB (Cathedis, Sendit) pour suivre la vraie marge nette COD sans saisie manuelle le soir. Preneur de votre avis !`);
      case 'ecom_ops_managers':
        return this.truncateNote(`Bonjour ${cleanName}, en tant qu'E-commerce Manager au Maroc, vous connaissez l'enfer des retours COD et du suivi des AWB. BayIIn connecte directement Cathedis, Sendit & O-Livraison avec réconciliation financière automatisée. Échangeons !`);
      case 'growth_agencies':
        return this.truncateNote(`Bonjour ${cleanName}, vous pilotez l'acquisition e-com COD au Maroc : le vrai défi est le décalage entre ROAS publicitaire et marge nette réelle encaissée après retours. C'est ce que BayIIn synchronise en direct. Discutons !`);
      default:
        return this.truncateNote(`Bonjour ${cleanName}, ravi de suivre votre activité e-commerce au Maroc. En tant que fondateur de BayIIn (ERP centralisant stocks, transporteurs locaux Cathedis/Sendit et marge nette COD), je serais ravi d'échanger avec vous !`);
    }
  }

  /**
   * Génération par le moteur sémantique expert local
   */
  private generateWithExpertHeuristics(params: {
    postText: string;
    firstName: string;
    authorHeadline: string;
    topic: string;
    context: 'saas_bayiin' | 'job_hunting';
  }): GenerationResult {
    const { firstName, authorHeadline, topic, context, postText } = params;
    const persona = this.detectPersona(authorHeadline, postText);

    if (context === 'saas_bayiin') {
      let comment = '';
      let inviteNote = '';

      // 1. Priorité absolue : Thématiques spécifiques identifiées dans le post
      if (topic === 'morocco_invoicing_management') {
        comment = "Excellente analyse. Pour les PME et commerçants au Maroc, le suivi manuel des devis et factures sur Excel ou des outils non adaptés reste le premier frein au développement. Passer à une facturation dématérialisée avec conformité ICE, mentions légales et relances automatiques permet de diviser par deux les délais de paiement et de sécuriser la trésorerie.";
        inviteNote = `Bonjour ${firstName}, votre publication sur la gestion d'entreprise et la facturation au Maroc est très pertinente. Avec BayIIn, nous simplifions la facturation (ICE, devis, relances et trésorerie) pour les PME marocaines. Au plaisir d'échanger !`;
      } else if (topic === 'morocco_ecommerce_growth') {
        comment = "Très pertinent. En e-commerce au Maroc, le passage à l'échelle se joue sur la rigueur opérationnelle : au-delà de l'acquisition, c'est la réconciliation financière rapide des encaissements et la gestion sans faille des stocks qui garantissent une marge nette durable. Merci pour ce partage !";
        inviteNote = `Bonjour ${firstName}, très inspiré par votre vision du e-commerce au Maroc. Fondateur de BayIIn (gestion intelligente des factures, stocks et ventes pour commerçants au Maroc), je serais ravi de vous compter dans mon réseau !`;
      } else if (topic === 'morocco_cod_logistics') {
        comment = "La synchronisation directe avec les transporteurs marocains (Cathedis, Sendit, O-Livraison) et la génération automatique des AWB restent indispensables pour réduire les retours et accélérer les expéditions.";
        inviteNote = `Bonjour ${firstName}, votre partage sur la logistique e-commerce au Maroc résonne particulièrement. Nous aidons les marchands COD à connecter leurs transporteurs locaux et automatiser leurs AWB sur BayIIn. Discutons !`;
      } else if (topic === 'profit_margin_reconciliation') {
        comment = "Entre les retours de livraison, les frais de port réels et les coûts d'acquisition, seule la marge nette encaissée compte en COD. Unifier finance et logistique change toute la rentabilité.";
        inviteNote = `Bonjour ${firstName}, excellent point sur la rentabilité. Avec BayIIn, on automatise le calcul du profit net en temps réel au Maroc en réconciliant les encaissements livreurs. Preneur de votre avis !`;
      } else if (topic === 'whatsapp_copilot') {
        comment = "La prise de commande et la relance sur WhatsApp sont devenues le canal n°1 de conversion au Maroc. L'automatiser avec un copilote IA tout en synchronisant les stocks évite les surventes.";
        inviteNote = `Bonjour ${firstName}, le commerce conversationnel sur WhatsApp transforme l'e-commerce au Maroc. Avec notre copilote Beya3 sur BayIIn, on unifie WhatsApp et l'ERP sans friction. Échangeons !`;
      } else if (persona === 'd2c_founders') {
        // Fallback Persona 1 : Fondateurs & Gérants D2C Maroc
        comment = "En e-commerce COD au Maroc, passer ses soirées à copier-coller des commandes sur les portails de transporteurs est un vrai frein au scaling. L'automatisation des bordereaux AWB et la réconciliation des encaissements libèrent un temps précieux pour développer la marque.";
        inviteNote = this.getPersonaPitch('d2c_founders', firstName);
      } else if (persona === 'ecom_ops_managers') {
        // Fallback Persona 2 : E-commerce & Operations Managers
        comment = "Le suivi des AWB et la réconciliation des statuts (Livré, Retourné, Encaissé) directement avec Cathedis, Sendit et O-Livraison est capital pour maîtriser le taux de retour (NPAI) et les flux de trésorerie COD au Maroc.";
        inviteNote = this.getPersonaPitch('ecom_ops_managers', firstName);
      } else if (persona === 'growth_agencies') {
        // Fallback Persona 3 : Agences Growth & Consultants COD
        comment = "Un bon ROAS ne sert à rien si 30% des commandes COD sont refusées à la livraison. Avoir le suivi en temps réel de la marge nette réelle déduite des retours et du transport réel change tout le pilotage des campagnes publicitaires.";
        inviteNote = this.getPersonaPitch('growth_agencies', firstName);
      } else {
        comment = "Très bonne perspective sur l'e-commerce et l'entreprise au Maroc. Centraliser la gestion des opérations, des factures et des encaissements est la clé pour passer à l'échelle sainement.";
        inviteNote = this.getPersonaPitch('general', firstName);
      }

      return {
        comment,
        inviteNote: this.truncateNote(inviteNote),
        detectedTopic: topic !== 'general_ecommerce_morocco' ? topic : (persona !== 'general' ? `persona_${persona}` : topic),
      };
    } else {
      // Contexte Job Hunting / Recrutement Tech
      let comment = "Excellente perspective technique. Trouver le bon compromis entre robustesse (typage strict, architecture découplée) et vélocité de delivery est capital en production.";
      let inviteNote = `Bonjour ${firstName}, impressionné par vos projets${authorHeadline ? ` en tant que ${authorHeadline.slice(0, 30)}` : ''}. Ingénieur Full Stack Java/Spring & React/TS, je serais ravi de rejoindre votre réseau !`;

      if (topic === 'talent_acquisition_rh' || topic === 'tech_recruiting') {
        comment = "Excellente perspective RH. Aligner vision métier et adéquation technique dès les premiers échanges est la clé pour attirer et fidéliser les meilleurs profils d'ingénieurs.";
        inviteNote = `Bonjour ${firstName}, impressionné par les opportunités tech que vous portez. En tant qu'Ingénieur Full Stack Java (Spring Boot) & React/Angular (4 ans d'expérience dont BNP Paribas), je serais ravi d'intégrer votre réseau et d'échanger sur vos projets tech !`;
      } else if (topic === 'tech_architecture') {
        comment = "La modularité et la scalabilité des microservices prennent tout leur sens face aux hauts volumes. Très bon partage d'architecture logicielle.";
        inviteNote = `Bonjour ${firstName}, vos réflexions d'architecture logicielle sont captivantes. Spécialisé Java Spring Boot, React & Big Data, je serais ravi de suivre vos actualités. Yassir`;
      }

      return {
        comment,
        inviteNote: this.truncateNote(inviteNote),
        detectedTopic: topic,
      };
    }
  }

  /**
   * Génération via l'API Google Gemini
   */
  private async generateWithGemini(params: {
    postText: string;
    firstName: string;
    authorHeadline: string;
    topic: string;
    context: 'saas_bayiin' | 'job_hunting';
  }): Promise<GenerationResult> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;

    const systemPrompt = `Tu es Yassir CHIRAWI, Fondateur de BayIIn (https://bayiin.shop), l'ERP SaaS tout-en-un conçu spécifiquement pour les marchands e-commerce et marques D2C en Cash on Delivery (COD) au Maroc.
Piliers clés de BayIIn :
1. ERP Opérations Centrales : Pilotage des stocks multi-dépôts en temps réel avec déclinaisons (tailles, couleurs), tunnel ultra-rapide de capture, validation et traitement des commandes COD.
2. Hub Logistique Intégré : Connexion directe via API aux transporteurs locaux marocains (Cathedis, Sendit, O-Livraison), génération automatique des AWB, calcul dynamique des frais de port par ville.
3. Réconciliation Financière & Rentabilité : Suivi automatisé des encaissements livreurs (Livré, Retourné, Encaissé), calcul temps réel de la vraie marge nette (déduction des retours NPAI/refus, coûts d'achat et livraison).
4. Copilote IA Opérationnel (Beya3) : Alertes réapprovisionnement, détection des anomalies, prise et suivi conversationnel de commandes sur WhatsApp.
5. Storefront Builder Intégré : Vitrine e-commerce bilingue Français/Arabe (RTL natif) synchronisée en direct avec l'ERP (zéro survente), formulaire monopage relié aux grilles transporteurs.

Cibles clés au Maroc :
1. Fondateurs & Gérants D2C (Mode, Skincare bio, Maroquinerie, Déco - 1 à 10 sal.) : fatigués de la saisie manuelle sur portails transporteurs le soir, besoin de visibilité sur la marge nette.
2. Responsables E-commerce & Opérations (Retail, Compléments, Parfumerie, Électronique - 11 à 50 sal.) : réduction des retours/refus, suivi des AWB, gestion multi-dépôts sans ruptures.
3. Agences Growth & Media Buyers COD (Prescripteurs, 2 à 15 pers.) : décalage entre ROAS publicitaire et marge nette réelle encaissée sur le terrain.

Mission :
Rédige :
1. Un commentaire LinkedIn d'expert constructif (2 phrases courtes, sans démarche commerciale agressive, apportant un angle métier COD Maroc pertinent).
2. Une note d'invitation personnalisée pour ${params.firstName} qui fait STRICTEMENT MOINS DE 280 CARACTÈRES.
Réponds STRICTEMENT au format JSON :
{"comment": "...", "inviteNote": "..."}`;

    const userPrompt = `Voici la publication de ${params.firstName} (${params.authorHeadline}) :
"""
${params.postText.slice(0, 1000)}
"""
Thématique détectée : ${params.topic}. Contexte visé : ${params.context}.`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) throw new Error('Réponse Gemini vide');

    const parsed = JSON.parse(rawJson);
    return {
      comment: parsed.comment,
      inviteNote: this.truncateNote(parsed.inviteNote),
      detectedTopic: params.topic,
    };
  }

  /**
   * Tronque impérativement à 290 caractères pour respecter la limite LinkedIn
   */
  private truncateNote(note: string): string {
    if (note.length <= 290) return note;
    return note.slice(0, 287).trim() + '...';
  }
}

export const aiGenerator = new AIGenerator();
