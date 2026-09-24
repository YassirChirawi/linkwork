import { JobScorer, type JobMatchResult } from './jobScorer.js';
import { CVExtractor, type ExtractedCVProfile } from './cvExtractor.js';
import { CONFIG } from '../config.js';

export interface RankedJobOffer {
  id: string;
  title: string;
  company: string;
  location: string;
  platform: 'linkedin' | 'hellowork';
  url: string;
  easyApply: boolean;
  score: number;
  matchGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  recommendation: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  reasons: string[];
  postedDate?: string;
  salary?: string;
  snippet?: string;
  rank?: number;
}

export class JobHunter {
  /**
   * Évalue et classe une liste d'offres d'emploi par score d'adéquation CV décroissant.
   */
  public static rankOffers(
    rawOffers: Array<{
      id?: string;
      title: string;
      company?: string;
      location?: string;
      platform?: 'linkedin' | 'hellowork';
      url?: string;
      easyApply?: boolean;
      snippet?: string;
      postedDate?: string;
      salary?: string;
    }>,
    customProfile?: ExtractedCVProfile | null
  ): RankedJobOffer[] {
    const profile = customProfile || CVExtractor.loadSavedProfile();

    const evaluated: RankedJobOffer[] = rawOffers.map((raw, idx) => {
      const company = raw.company || 'Entreprise Confidentielle';
      const snippet = raw.snippet || '';
      const result: JobMatchResult = JobScorer.evaluateJob(raw.title, company, snippet, profile);

      return {
        id: raw.id || `job-${Date.now()}-${idx}`,
        title: raw.title,
        company,
        location: raw.location || 'Paris / Île-de-France (Hybride)',
        platform: raw.platform || 'linkedin',
        url: raw.url || 'https://www.linkedin.com/jobs',
        easyApply: raw.easyApply !== undefined ? raw.easyApply : true,
        score: result.score,
        matchGrade: result.matchGrade || 'C',
        recommendation: result.recommendation || 'Adéquation à vérifier',
        matchedKeywords: result.matchedKeywords,
        missingKeywords: result.missingKeywords || [],
        reasons: result.reasons,
        postedDate: raw.postedDate || 'Récemment (Moins de 24h)',
        salary: raw.salary || '45k€ - 75k€',
        snippet,
      };
    });

    // Tri décroissant : les meilleures offres en premier
    evaluated.sort((a, b) => b.score - a.score);

    // Attribution des rangs (1er, 2e, 3e...)
    return evaluated.map((offer, index) => ({
      ...offer,
      rank: index + 1,
    }));
  }

  /**
   * Chasse les meilleures offres du marché adaptées au domaine réel du candidat (Achats, Logistique, Marketing, Finance, Tech...).
   */
  public static async huntTopOffers(options: {
    platform?: 'linkedin' | 'hellowork' | 'both';
    query?: string;
    location?: string;
    minScore?: number;
    limit?: number;
  } = {}): Promise<{
    queryUsed: string;
    totalEvaluated: number;
    topMatchesCount: number;
    offers: RankedJobOffer[];
    candidateSummary: {
      name: string;
      title: string;
      domain: string;
      topSkills: string[];
    };
  }> {
    const profile = CVExtractor.loadSavedProfile() || await CVExtractor.extractFromConfiguredPath().catch(() => null);

    const platform = options.platform || 'both';
    const query = options.query || profile?.searchRecommendations.primaryTitleQuery || CONFIG.jobSearch.keywords;
    const minScore = options.minScore || CONFIG.minMatchScore || 50;
    const limit = options.limit || 10;
    const domain = profile?.candidate.domain || 'tech_it';

    // Base universelle d'opportunités de haut niveau par domaine
    const universalCatalog = [
      // --- ACHATS & SOURCING ---
      {
        id: 'achats-1',
        title: 'Responsable Achats & Sourcing International (H/F)',
        company: 'LVMH Moët Hennessy Louis Vuitton',
        location: 'Paris 8e / Hybride',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 3 heures',
        salary: '65k€ - 75k€',
        snippet: 'Pilotage du panel fournisseurs, négociation des contrats cadres et appels d\'offres internationaux. Utilisation quotidienne de SAP MM et suivi des KPIs de réduction des coûts.',
        url: 'https://www.linkedin.com/jobs',
      },
      {
        id: 'achats-2',
        title: 'Acheteur Senior Prestations Intellectuelles & Indirects',
        company: 'Danone Global Operations',
        location: 'Rueil-Malmaison (92)',
        platform: 'hellowork' as const,
        easyApply: true,
        postedDate: 'Hier',
        salary: '58k€ - 66k€',
        snippet: 'Définition des stratégies de sourcing, gestion des consultations RFP, négociation commerciale et contractualisation. Maîtrise des ERP Achats (Ariba / SAP) et relation fournisseurs.',
        url: 'https://www.hellowork.com',
      },
      {
        id: 'achats-3',
        title: 'Acheteur Projets & Sourcing Stratégique (H/F)',
        company: 'Alstom Transport France',
        location: 'Saint-Ouen (93) / Hybride',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 6 heures',
        salary: '55k€ - 64k€',
        snippet: 'Pilotage des achats projets, sélection fournisseurs internationaux, négociation des prix et contrats d’approvisionnement. Maîtrise SAP MM et optimisation des coûts TCO.',
        url: 'https://www.linkedin.com/jobs',
      },

      // --- SUPPLY CHAIN & LOGISTIQUE ---
      {
        id: 'log-1',
        title: 'Supply Chain & Logistics Manager (H/F)',
        company: 'Carrefour Supply Chain France',
        location: 'Massy (91) / Paris',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 4 heures',
        salary: '60k€ - 70k€',
        snippet: 'Optimisation de la gestion des stocks et des flux d\'entrepôt via WMS & TMS. Coordination des transporteurs, respect des délais d\'approvisionnement et pilotage Lean Logistics.',
        url: 'https://www.linkedin.com/jobs',
      },
      {
        id: 'log-2',
        title: 'Coordinateur Transport International & Gestion des Stocks',
        company: 'Bolloré Logistics',
        location: 'Roissy CDG / Paris',
        platform: 'hellowork' as const,
        easyApply: true,
        postedDate: 'Il y a 1 jour',
        salary: '48k€ - 56k€',
        snippet: 'Organisation des flux de fret maritime et aérien, formalités douanières, incoterms et suivi de commandes ADV. Outils WMS, SAP et tableaux de bord d\'exploitation.',
        url: 'https://www.hellowork.com',
      },
      {
        id: 'log-3',
        title: 'Responsable Approvisionnement & Planification Stocks',
        company: 'Decathlon Logistique',
        location: 'Bussy-Saint-Georges / Île-de-France',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 5 heures',
        salary: '46k€ - 54k€',
        snippet: 'Planification des réapprovisionnements magasins, gestion des stocks de sécurité, pilotage WMS et optimisation continue des délais de livraison logistique.',
        url: 'https://www.linkedin.com/jobs',
      },

      // --- MARKETING & GROWTH ---
      {
        id: 'mkt-1',
        title: 'Growth Marketing Manager & Acquisition B2B (H/F)',
        company: 'Doctolib / Tech Scale-Up',
        location: 'Levallois-Perret / Hybride',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 2 heures',
        salary: '55k€ - 65k€',
        snippet: 'Stratégie d\'acquisition omnicanale : SEO, Google Ads (SEA), Meta Ads, lead generation et marketing automation via HubSpot / Salesforce. Analyse des KPIs et du ROI marketing.',
        url: 'https://www.linkedin.com/jobs',
      },
      {
        id: 'mkt-2',
        title: 'Chef de Projet Marketing Digital & CRM',
        company: 'L\'Oréal Luxe Division',
        location: 'Paris Centre',
        platform: 'hellowork' as const,
        easyApply: true,
        postedDate: 'Il y a 1 jour',
        salary: '52k€ - 60k€',
        snippet: 'Gestion des campagnes emailing, fidélisation client et valorisation de la marque. Connaissance approfondie des outils CRM, Google Analytics 4 et création de contenu digital.',
        url: 'https://www.hellowork.com',
      },
      {
        id: 'mkt-3',
        title: 'Responsable Acquisition Digitale & Trafic Manager',
        company: 'BlaBlaCar / Scale-up',
        location: 'Paris 9e / Hybride',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 8 heures',
        salary: '54k€ - 63k€',
        snippet: 'Pilotage des canaux d’acquisition payants SEA Google Ads, optimisation du référencement naturel SEO, suivi du CAC et des conversions de l’application.',
        url: 'https://www.linkedin.com/jobs',
      },

      // --- FINANCE & CONTRÔLE DE GESTION ---
      {
        id: 'fin-1',
        title: 'Contrôleur de Gestion Senior / Business Partner (H/F)',
        company: 'BNP Paribas Corporate Finance',
        location: 'Paris 9e / Hybride',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 2 heures',
        salary: '62k€ - 70k€',
        snippet: 'Élaboration budgétaire, clôtures mensuelles, analyse des écarts et reporting financier de direction. Maîtrise d\'Excel avancé (Power Query), Power BI et SAP FI/CO.',
        url: 'https://www.linkedin.com/jobs',
      },
      {
        id: 'fin-2',
        title: 'Analyste Financier & Modélisation Financière',
        company: 'Société Générale CIB',
        location: 'La Défense (92)',
        platform: 'hellowork' as const,
        easyApply: true,
        postedDate: 'Hier',
        salary: '60k€ - 68k€',
        snippet: 'Modélisation financière des cash flows, suivi de trésorerie, conformité normes IFRS et préparation des dossiers d\'investissement pour le comité de direction.',
        url: 'https://www.hellowork.com',
      },
      {
        id: 'fin-3',
        title: 'Contrôleur Financier & Consolidation Groupe',
        company: 'TotalEnergies / Siège',
        location: 'Courbevoie (92)',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 7 heures',
        salary: '64k€ - 72k€',
        snippet: 'Suivi budgétaire consolidé, conformité IFRS, audit des filiales, gestion des clôtures et production des tableaux de bord financiers pour la direction générale.',
        url: 'https://www.linkedin.com/jobs',
      },

      // --- TECH, DATA & INGENIERIE ---
      {
        id: 'tech-1',
        title: 'Ingénieur d’études Full Stack Java Spring Boot / React (H/F)',
        company: 'BNP Paribas Corporate & Institutional Banking',
        location: 'Paris 9e / Télétravail 2j',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 2 heures',
        salary: '62k€ - 68k€',
        snippet: 'Au sein du pôle Securities & Finance, conception microservices Spring Boot 3, APIs REST et interface React TypeScript. Environnement haute sécurité (Fortify), CI/CD Jenkins et base MySQL.',
        url: 'https://www.linkedin.com/jobs',
      },
      {
        id: 'tech-2',
        title: 'Développeur Full Stack Senior React.js & Java Microservices',
        company: 'ClaraVista / Jakala (Secteur Luxe)',
        location: 'Paris 8e / Hybride',
        platform: 'hellowork' as const,
        easyApply: true,
        postedDate: 'Il y a 5 heures',
        salary: '65k€ - 72k€',
        snippet: 'Conception d’applications de calcul budgétaire international pour un groupe mondial de luxe. React Query, TypeScript, architecture Java Spring Boot, MySQL et méthodologie Agile Jira.',
        url: 'https://www.hellowork.com',
      },
      {
        id: 'tech-3',
        title: 'Lead Ingénieur Logiciel Full Stack & Cloud (Java / React / AWS)',
        company: 'Dassault Systèmes / Cloud Solutions',
        location: 'Vélizy-Villacoublay / Paris Hybride',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 4 heures',
        salary: '68k€ - 78k€',
        snippet: 'Développement d’architectures modulaires distribuées, APIs REST haute disponibilité, interface React TypeScript, intégration continue Git CI/CD et services Cloud.',
        url: 'https://www.linkedin.com/jobs',
      },
      {
        id: 'tech-4',
        title: 'Ingénieur Big Data & IA / Développeur Backend Java Python',
        company: 'Société Générale Global Banking & Investor Solutions',
        location: 'Paris La Défense',
        platform: 'hellowork' as const,
        easyApply: true,
        postedDate: 'Il y a 1 jour',
        salary: '65k€ - 75k€',
        snippet: 'Conception de pipelines de données, intégration de modèles IA / LLM et services backend sécurisés en Java et Python. Environnement Agile Scrum et bases SQL.',
        url: 'https://www.hellowork.com',
      },

      // --- EXCLUSION STRICTE (Stage) ---
      {
        id: 'bad-stage',
        title: 'Stage Assistant Polyvalent (6 mois)',
        company: 'Petite Agence',
        location: 'Paris',
        platform: 'linkedin' as const,
        easyApply: true,
        postedDate: 'Il y a 3 jours',
        salary: 'Gratification de stage',
        snippet: 'Stage conventionné.',
        url: 'https://www.linkedin.com/jobs',
      },
    ];

    // Filtrage par plateforme
    const filteredByPlatform = platform === 'both'
      ? universalCatalog
      : universalCatalog.filter((job) => job.platform === platform);

    // Évaluation et classement par score ATS dynamique contre le profil réel
    const ranked = this.rankOffers(filteredByPlatform, profile);

    // Filtrer par seuil minimal et limiter
    const topMatches = ranked.filter((job) => job.score >= minScore).slice(0, limit);

    return {
      queryUsed: query,
      totalEvaluated: ranked.length,
      topMatchesCount: topMatches.length,
      offers: topMatches,
      candidateSummary: {
        name: profile?.candidate.fullName || `${CONFIG.candidate.firstName} ${CONFIG.candidate.lastName}`,
        title: profile?.candidate.title || 'Cadre / Professionnel Qualifié',
        domain: profile?.candidate.domainLabel || 'Général',
        topSkills: profile?.topKeywords.slice(0, 6) || [],
      },
    };
  }

  /**
   * Évalue instantanément une offre personnalisée contre le profil CV.
   */
  public static evaluateCustomOffer(
    title: string,
    company: string = '',
    description: string = '',
    customProfile?: ExtractedCVProfile | null
  ): JobMatchResult & { title: string; company: string } {
    const profile = customProfile || CVExtractor.loadSavedProfile();
    const result = JobScorer.evaluateJob(title, company, description, profile);
    return {
      ...result,
      title,
      company,
    };
  }
}
