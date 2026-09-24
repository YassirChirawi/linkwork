import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { CONFIG } from '../config.js';

export type CandidateDomain =
  | 'achats_sourcing'
  | 'logistique_supply'
  | 'marketing_communication'
  | 'finance_comptabilite'
  | 'rh_recrutement'
  | 'commercial_vente'
  | 'tech_it'
  | 'polyvalent';

export interface ExtractedSkill {
  name: string;
  category:
    | 'achats_sourcing'
    | 'logistique_supply'
    | 'marketing_communication'
    | 'finance_comptabilite'
    | 'rh_recrutement'
    | 'commercial_vente'
    | 'languages'
    | 'frameworks_backend'
    | 'frameworks_frontend'
    | 'data_ai'
    | 'devops_cloud_security'
    | 'methodologies_tools'
    | 'soft_skills';
  years?: number;
  weight: number; // 1 (bonus), 2 (important), 3 (core/crucial)
  frequency: number;
}

export interface ExtractedCVProfile {
  rawTextLength: number;
  extractedAt: string;
  sourceFile: string;
  candidate: {
    fullName: string;
    firstName: string;
    lastName: string;
    title: string;
    domain: CandidateDomain;
    domainLabel: string;
    email?: string;
    phone?: string;
    city?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    degree?: string;
    school?: string;
    experienceYears: number;
    summaryPitch: string;
  };
  skills: {
    all: string[];
    categorized: Record<string, string[]>;
    weighted: Record<string, number>; // skillName -> weight (1-3)
    skillsMap: Record<string, number>; // skillName -> years of exp
  };
  searchRecommendations: {
    primaryTitleQuery: string;
    suggestedQueries: string[];
    booleanQueryLinkedIn: string;
    helloWorkQuery: string;
    excludedKeywords: string[];
    requiredKeywords: string[];
  };
  topKeywords: string[];
  rawTextPreview: string;
}

// Dictionnaire universel multi-métiers : Achats, Logistique, Marketing, Finance, RH, Vente, Tech
const UNIVERSAL_SKILLS_TAXONOMY: Record<
  string,
  { category: ExtractedSkill['category']; aliases: string[]; primaryDomains: CandidateDomain[] }
> = {
  // ==================== ACHATS & SOURCING ====================
  'achats': { category: 'achats_sourcing', aliases: ['achats', 'acheteur', 'acheteuse', 'procurement', 'purchasing'], primaryDomains: ['achats_sourcing'] },
  'sourcing': { category: 'achats_sourcing', aliases: ['sourcing', 'sourcing fournisseurs', 'recherche fournisseurs'], primaryDomains: ['achats_sourcing'] },
  'négociation fournisseurs': { category: 'achats_sourcing', aliases: ['négociation fournisseurs', 'negociation fournisseur', 'négociation achats', 'vendor negotiation'], primaryDomains: ['achats_sourcing'] },
  'appels d\'offres': { category: 'achats_sourcing', aliases: ['appels d\'offres', 'appel d\'offres', 'rfi', 'rfp', 'rfq', 'cahier des charges'], primaryDomains: ['achats_sourcing'] },
  'gestion des contrats': { category: 'achats_sourcing', aliases: ['gestion des contrats', 'contract management', 'contrats fournisseurs'], primaryDomains: ['achats_sourcing'] },
  'sap mm': { category: 'achats_sourcing', aliases: ['sap mm', 'sap materials management', 'sap srm', 'ariba', 'sap ariba'], primaryDomains: ['achats_sourcing'] },
  'réduction des coûts': { category: 'achats_sourcing', aliases: ['réduction des coûts', 'cost reduction', 'cost saving', 'optimisation des coûts', 'tco'], primaryDomains: ['achats_sourcing'] },
  'achats indirects': { category: 'achats_sourcing', aliases: ['achats indirects', 'prestations intellectuelles', 'frais généraux', 'indirect procurement'], primaryDomains: ['achats_sourcing'] },
  'achats directs': { category: 'achats_sourcing', aliases: ['achats directs', 'matières premières', 'direct procurement'], primaryDomains: ['achats_sourcing'] },

  // ==================== LOGISTIQUE & SUPPLY CHAIN ====================
  'supply chain': { category: 'logistique_supply', aliases: ['supply chain', 'chaîne logistique', 'supply-chain', 'chaine logistique'], primaryDomains: ['logistique_supply'] },
  'logistique': { category: 'logistique_supply', aliases: ['logistique', 'logisticien', 'logistics', 'gestion logistique'], primaryDomains: ['logistique_supply'] },
  'gestion des stocks': { category: 'logistique_supply', aliases: ['gestion des stocks', 'stock management', 'inventaires', 'optimisation des stocks', 'tenue des stocks'], primaryDomains: ['logistique_supply'] },
  'wms': { category: 'logistique_supply', aliases: ['wms', 'warehouse management', 'gestion d\'entrepôt', 'reflex', 'manhattan'], primaryDomains: ['logistique_supply'] },
  'tms': { category: 'logistique_supply', aliases: ['tms', 'transport management', 'gestion du transport'], primaryDomains: ['logistique_supply'] },
  'adv': { category: 'logistique_supply', aliases: ['adv', 'administration des ventes', 'gestion des commandes clients', 'order management'], primaryDomains: ['logistique_supply'] },
  'transport international': { category: 'logistique_supply', aliases: ['transport international', 'fret', 'freight', 'affrètement', 'transit', 'maritime', 'aérien', 'routier'], primaryDomains: ['logistique_supply'] },
  'douane & incoterms': { category: 'logistique_supply', aliases: ['douane', 'incoterms', 'dédouanement', 'formalités douanières'], primaryDomains: ['logistique_supply'] },
  'planification s&op': { category: 'logistique_supply', aliases: ['planification', 's&op', 'pdp', 'pic', 'flux tendus', 'just-in-time', 'kanban'], primaryDomains: ['logistique_supply'] },
  'lean logistics': { category: 'logistique_supply', aliases: ['lean logistics', '5s', 'kaizen', 'amélioration continue logistique'], primaryDomains: ['logistique_supply'] },

  // ==================== MARKETING & COMMUNICATION ====================
  'marketing digital': { category: 'marketing_communication', aliases: ['marketing digital', 'digital marketing', 'webmarketing', 'e-marketing'], primaryDomains: ['marketing_communication'] },
  'growth marketing': { category: 'marketing_communication', aliases: ['growth marketing', 'growth hacking', 'acquisition marketing', 'growth'], primaryDomains: ['marketing_communication'] },
  'seo': { category: 'marketing_communication', aliases: ['seo', 'référencement naturel', 'search engine optimization'], primaryDomains: ['marketing_communication'] },
  'sea & google ads': { category: 'marketing_communication', aliases: ['sea', 'google ads', 'adwords', 'search engine advertising', 'ads'], primaryDomains: ['marketing_communication'] },
  'social media & ads': { category: 'marketing_communication', aliases: ['social media', 'meta ads', 'facebook ads', 'instagram ads', 'tiktok ads', 'linkedin ads', 'community management'], primaryDomains: ['marketing_communication'] },
  'crm & emailing': { category: 'marketing_communication', aliases: ['crm', 'hubspot', 'salesforce', 'klaviyo', 'brevo', 'sendinblue', 'mailchimp', 'emailing', 'marketing automation'], primaryDomains: ['marketing_communication'] },
  'analytics & kpi': { category: 'marketing_communication', aliases: ['google analytics', 'ga4', 'matomo', 'kpi marketing', 'roas', 'roi', 'taux de conversion'], primaryDomains: ['marketing_communication'] },
  'stratégie de marque': { category: 'marketing_communication', aliases: ['stratégie de marque', 'branding', 'brand content', 'positionnement', 'identité de marque'], primaryDomains: ['marketing_communication'] },
  'content marketing': { category: 'marketing_communication', aliases: ['content marketing', 'rédaction web', 'copywriting', 'création de contenu'], primaryDomains: ['marketing_communication'] },
  'e-commerce marketing': { category: 'marketing_communication', aliases: ['e-commerce', 'ecommerce', 'shopify', 'woocommerce', 'prestashop', 'marketplace'], primaryDomains: ['marketing_communication'] },

  // ==================== FINANCE & COMPTABILITÉ ====================
  'contrôle de gestion': { category: 'finance_comptabilite', aliases: ['contrôle de gestion', 'controle de gestion', 'contrôleur de gestion', 'financial controller'], primaryDomains: ['finance_comptabilite'] },
  'analyse financière': { category: 'finance_comptabilite', aliases: ['analyse financière', 'financial analysis', 'analyste financier', 'modélisation financière'], primaryDomains: ['finance_comptabilite'] },
  'comptabilité générale': { category: 'finance_comptabilite', aliases: ['comptabilité', 'comptabilite', 'comptable', 'tenue comptable', 'saisie comptable'], primaryDomains: ['finance_comptabilite'] },
  'audit financier': { category: 'finance_comptabilite', aliases: ['audit', 'audit financier', 'auditeur', 'audit interne', 'audit externe', 'commissariat aux comptes'], primaryDomains: ['finance_comptabilite'] },
  'trésorerie & bfr': { category: 'finance_comptabilite', aliases: ['trésorerie', 'tresorerie', 'cash management', 'bfr', 'gestion de trésorerie', 'flux financiers'], primaryDomains: ['finance_comptabilite'] },
  'bilan & liasse fiscale': { category: 'finance_comptabilite', aliases: ['bilan', 'liasse fiscale', 'compte de résultat', 'clôture annuelle', 'cloture'], primaryDomains: ['finance_comptabilite'] },
  'clôture mensuelle': { category: 'finance_comptabilite', aliases: ['clôture mensuelle', 'clotures mensuelles', 'cut-off', 'provisions', 'justification des comptes'], primaryDomains: ['finance_comptabilite'] },
  'ifrs & normes': { category: 'finance_comptabilite', aliases: ['ifrs', 'us gaap', 'pcg', 'normes comptables', 'consolidation'], primaryDomains: ['finance_comptabilite'] },
  'reporting financier': { category: 'finance_comptabilite', aliases: ['reporting financier', 'financial reporting', 'tableaux de bord financiers', 'élaboration budgétaire', 'budget'], primaryDomains: ['finance_comptabilite'] },
  'sap fi/co': { category: 'finance_comptabilite', aliases: ['sap fi', 'sap co', 'sap fico', 'sap finance', 'sage', 'cegid'], primaryDomains: ['finance_comptabilite'] },

  // ==================== RESSOURCES HUMAINES ====================
  'talent acquisition': { category: 'rh_recrutement', aliases: ['talent acquisition', 'recrutement', 'sourcing candidats', 'chasse de têtes', 'recruteur'], primaryDomains: ['rh_recrutement'] },
  'gestion de paie': { category: 'rh_recrutement', aliases: ['paie', 'gestion de la paie', 'bulletins de paie', 'charges sociales', 'dsn', 'gestionnaire de paie'], primaryDomains: ['rh_recrutement'] },
  'administration du personnel': { category: 'rh_recrutement', aliases: ['administration du personnel', 'adp', 'contrats de travail', 'droit social', 'onboarding'], primaryDomains: ['rh_recrutement'] },
  'sirh': { category: 'rh_recrutement', aliases: ['sirh', 'workday', 'lucca', 'adp decidium', 'talentsoft'], primaryDomains: ['rh_recrutement'] },

  // ==================== COMMERCIAL & VENTES ====================
  'prospection b2b': { category: 'commercial_vente', aliases: ['prospection b2b', 'prospection commerciale', 'cold calling', 'génération de leads', 'outbound'], primaryDomains: ['commercial_vente'] },
  'négociation commerciale': { category: 'commercial_vente', aliases: ['négociation commerciale', 'closing', 'vente complexe', 'vente b2b'], primaryDomains: ['commercial_vente'] },
  'gestion de portefeuille': { category: 'commercial_vente', aliases: ['gestion de portefeuille', 'account management', 'fidélisation', 'up-sell', 'cross-sell'], primaryDomains: ['commercial_vente'] },
  'cycle de vente': { category: 'commercial_vente', aliases: ['cycle de vente', 'pipeline commercial', 'sales pipeline', 'chiffrage', 'devis'], primaryDomains: ['commercial_vente'] },

  // ==================== TECH, DATA & CYBERSÉCURITÉ ====================
  'java': { category: 'languages', aliases: ['java', 'j2ee', 'jee', 'java 8', 'java 11', 'java 17', 'java 21'], primaryDomains: ['tech_it'] },
  'spring boot': { category: 'frameworks_backend', aliases: ['spring boot', 'springboot', 'spring-boot', 'spring'], primaryDomains: ['tech_it'] },
  'react': { category: 'frameworks_frontend', aliases: ['react', 'react.js', 'reactjs', 'react query'], primaryDomains: ['tech_it'] },
  'typescript': { category: 'languages', aliases: ['typescript', 'ts'], primaryDomains: ['tech_it'] },
  'javascript': { category: 'languages', aliases: ['javascript', 'js'], primaryDomains: ['tech_it'] },
  'python': { category: 'languages', aliases: ['python', 'python3', 'django', 'fastapi'], primaryDomains: ['tech_it'] },
  'sql': { category: 'languages', aliases: ['sql', 'mysql', 'postgresql', 'oracle'], primaryDomains: ['tech_it', 'finance_comptabilite'] },
  'microservices': { category: 'frameworks_backend', aliases: ['microservices', 'microservice', 'api rest', 'rest'], primaryDomains: ['tech_it'] },
  'angular': { category: 'frameworks_frontend', aliases: ['angular', 'angularjs'], primaryDomains: ['tech_it'] },
  'node.js': { category: 'frameworks_backend', aliases: ['node.js', 'nodejs', 'node'], primaryDomains: ['tech_it'] },
  'next.js': { category: 'frameworks_frontend', aliases: ['next.js', 'nextjs', 'next'], primaryDomains: ['tech_it'] },
  'html & css': { category: 'frameworks_frontend', aliases: ['html', 'html5', 'css', 'css3', 'sass'], primaryDomains: ['tech_it'] },
  'git': { category: 'methodologies_tools', aliases: ['git', 'github', 'gitlab', 'bitbucket'], primaryDomains: ['tech_it'] },
  'ci/cd': { category: 'devops_cloud_security', aliases: ['ci/cd', 'ci cd', 'intégration continue', 'continuous integration'], primaryDomains: ['tech_it'] },
  'docker': { category: 'devops_cloud_security', aliases: ['docker', 'kubernetes', 'k8s'], primaryDomains: ['tech_it'] },
  'jenkins': { category: 'devops_cloud_security', aliases: ['jenkins', 'gitlab', 'ansible'], primaryDomains: ['tech_it'] },
  'postgresql': { category: 'languages', aliases: ['postgresql', 'postgres'], primaryDomains: ['tech_it'] },
  'mysql': { category: 'languages', aliases: ['mysql', 'mariadb'], primaryDomains: ['tech_it'] },
  'mongodb': { category: 'languages', aliases: ['mongodb', 'nosql'], primaryDomains: ['tech_it'] },
  'redis': { category: 'languages', aliases: ['redis'], primaryDomains: ['tech_it'] },
  'kafka': { category: 'frameworks_backend', aliases: ['kafka', 'rabbitmq', 'messaging', 'event-driven'], primaryDomains: ['tech_it'] },
  'cloud aws': { category: 'devops_cloud_security', aliases: ['aws', 'amazon web services', 'cloud'], primaryDomains: ['tech_it'] },
  'linux': { category: 'methodologies_tools', aliases: ['linux', 'unix', 'bash', 'shell'], primaryDomains: ['tech_it'] },
  'cybersécurité': { category: 'devops_cloud_security', aliases: ['cybersécurité', 'cybersecurite', 'fortify', 'burp suite', 'pentest', 'sonarqube', 'owasp'], primaryDomains: ['tech_it'] },
  'big data & ia': { category: 'data_ai', aliases: ['big data', 'datawarehouse', 'ia', 'llm', 'gemini', 'claude'], primaryDomains: ['tech_it'] },

  // ==================== OUTILS UNIVERSELS & SOFT SKILLS ====================
  'excel avancé': { category: 'methodologies_tools', aliases: ['excel', 'excel avancé', 'vba', 'tableaux croisés dynamiques', 'recherche v', 'power query'], primaryDomains: ['finance_comptabilite', 'achats_sourcing', 'logistique_supply', 'marketing_communication'] },
  'power bi': { category: 'data_ai', aliases: ['power bi', 'powerbi', 'dax', 'tableau software', 'dashboard'], primaryDomains: ['finance_comptabilite', 'achats_sourcing', 'logistique_supply', 'marketing_communication'] },
  'erp': { category: 'methodologies_tools', aliases: ['erp', 'sap', 'odoo', 'sage', 'netsuite'], primaryDomains: ['achats_sourcing', 'logistique_supply', 'finance_comptabilite'] },
  'gestion de projet': { category: 'methodologies_tools', aliases: ['gestion de projet', 'conduite de projet', 'project management', 'pmo'], primaryDomains: ['achats_sourcing', 'logistique_supply', 'finance_comptabilite', 'marketing_communication', 'tech_it', 'commercial_vente'] },
  'agile scrum': { category: 'methodologies_tools', aliases: ['agile', 'scrum', 'jira', 'kanban'], primaryDomains: ['tech_it', 'marketing_communication', 'achats_sourcing'] },
  'anglais professionnel': { category: 'soft_skills', aliases: ['anglais courant', 'anglais professionnel', 'fluent english', 'bilingual'], primaryDomains: ['achats_sourcing', 'logistique_supply', 'finance_comptabilite', 'marketing_communication', 'tech_it'] },
  'leadership & négociation': { category: 'soft_skills', aliases: ['leadership', 'négociation', 'rigueur', 'communication', 'esprit d\'analyse'], primaryDomains: ['achats_sourcing', 'logistique_supply', 'finance_comptabilite', 'commercial_vente', 'marketing_communication'] },
};

const CV_PROFILE_STORAGE_PATH = path.resolve(process.cwd(), 'data', 'cv_profile.json');

export class CVExtractor {
  /**
   * Détecte le domaine métier dominant du candidat (Achats, Logistique, Marketing, Finance, Tech, etc.)
   */
  public static detectCandidateDomain(cleanText: string): { domain: CandidateDomain; domainLabel: string } {
    const lower = cleanText.toLowerCase();

    // Scores de densité par domaine
    const domainScores: Record<CandidateDomain, number> = {
      achats_sourcing: 0,
      logistique_supply: 0,
      marketing_communication: 0,
      finance_comptabilite: 0,
      rh_recrutement: 0,
      commercial_vente: 0,
      tech_it: 0,
      polyvalent: 0,
    };

    // A. Achats & Sourcing
    if (/achat|acheteur|acheteuse|procurement|sourcing|fournisseur|appel d'offre|cahier des charges|sap mm|srm\b|fournisseurs/i.test(lower)) {
      const matches = lower.match(/\b(achat|acheteur|acheteuse|procurement|sourcing|fournisseur|fournisseurs|sap mm)\b/g);
      domainScores.achats_sourcing += (matches ? matches.length * 3 : 5);
    }

    // B. Logistique & Supply Chain
    if (/logistique|supply\s*chain|stock|stocks|entrepôt|entrepot|wms|tms|fret|transport|douane|incoterm|adv\b|expedition|réception/i.test(lower)) {
      const matches = lower.match(/\b(logistique|supply chain|stock|stocks|wms|tms|transport|douane|adv)\b/g);
      domainScores.logistique_supply += (matches ? matches.length * 3 : 5);
    }

    // C. Marketing & Communication
    if (/marketing|growth|seo\b|sea\b|crm\b|acquisition|réseaux sociaux|social media|branding|audience|campagne|publicité|content/i.test(lower)) {
      const matches = lower.match(/\b(marketing|growth|seo|sea|crm|social media|branding|acquisition)\b/g);
      domainScores.marketing_communication += (matches ? matches.length * 3 : 5);
    }

    // D. Finance & Comptabilité
    if (/contrôle de gestion|controle de gestion|comptab|finance|audit|trésorerie|tresorerie|bilan|ifrs|analyste financier|clôture|cloture/i.test(lower)) {
      const matches = lower.match(/\b(contrôle de gestion|controle de gestion|comptable|comptabilité|finance|audit|trésorerie|bilan|ifrs)\b/g);
      domainScores.finance_comptabilite += (matches ? matches.length * 3 : 5);
    }

    // E. RH & Recrutement
    if (/ressources humaines|talent acquisition|recrutement|recruteur|paie|sirh|gestionnaire de paie|formation|droit social/i.test(lower)) {
      const matches = lower.match(/\b(recrutement|talent acquisition|ressources humaines|paie|sirh)\b/g);
      domainScores.rh_recrutement += (matches ? matches.length * 3 : 5);
    }

    // F. Commercial & Ventes
    if (/commercial|business developer|bizdev|account manager|ingénieur d'affaires|prospection|closing|sales/i.test(lower)) {
      const matches = lower.match(/\b(commercial|business developer|account manager|prospection|closing)\b/g);
      domainScores.commercial_vente += (matches ? matches.length * 2 : 4);
    }

    // G. Tech & IT
    if (/développeur|developpeur|software engineer|full\s*stack|fullstack|java\b|react|python|spring|cloud|devops|microservice/i.test(lower)) {
      const matches = lower.match(/\b(développeur|developpeur|full stack|java|react|python|spring|docker|microservices)\b/g);
      domainScores.tech_it += (matches ? matches.length * 3 : 5);
    }

    // Trouver le domaine dominant avec le score le plus élevé
    let bestDomain: CandidateDomain = 'tech_it';
    let maxScore = 0;

    for (const [dom, score] of Object.entries(domainScores) as [CandidateDomain, number][]) {
      if (score > maxScore) {
        maxScore = score;
        bestDomain = dom;
      }
    }

    const domainLabels: Record<CandidateDomain, string> = {
      achats_sourcing: 'Achats & Sourcing',
      logistique_supply: 'Supply Chain & Logistique',
      marketing_communication: 'Marketing & Communication',
      finance_comptabilite: 'Finance & Contrôle de Gestion',
      rh_recrutement: 'Ressources Humaines & Recrutement',
      commercial_vente: 'Commercial & Vente B2B',
      tech_it: 'Tech, Logiciel & Data',
      polyvalent: 'Management & Fonctions Support',
    };

    return {
      domain: maxScore >= 3 ? bestDomain : 'polyvalent',
      domainLabel: domainLabels[bestDomain] || 'Profil Polyvalent',
    };
  }

  /**
   * Extrait et analyse le CV actuellement configuré (ou celui passé en argument).
   */
  public static async extractFromConfiguredPath(customPath?: string): Promise<ExtractedCVProfile> {
    const targetPath = customPath ? path.resolve(customPath) : path.resolve(CONFIG.candidate.resumePath);

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Le fichier CV spécifié est introuvable : ${targetPath}`);
    }

    const ext = path.extname(targetPath).toLowerCase();
    const buffer = fs.readFileSync(targetPath);

    let rawText = '';
    if (ext === '.pdf') {
      rawText = await this.extractTextFromPdfBuffer(buffer);
    } else {
      rawText = buffer.toString('utf-8');
    }

    const profile = this.parseCVText(rawText, path.basename(targetPath));
    this.saveProfile(profile);
    return profile;
  }

  /**
   * Extrait et analyse un CV depuis un Buffer en mémoire (ex: upload web).
   */
  public static async extractFromBuffer(buffer: Buffer, originalFilename: string = 'CV_Uploaded.pdf'): Promise<ExtractedCVProfile> {
    let rawText = '';
    if (originalFilename.toLowerCase().endsWith('.pdf')) {
      rawText = await this.extractTextFromPdfBuffer(buffer);
    } else {
      rawText = buffer.toString('utf-8');
    }

    const profile = this.parseCVText(rawText, originalFilename);
    this.saveProfile(profile);
    return profile;
  }

  /**
   * Extrait le texte d'un buffer PDF avec pdf-parse v2.
   */
  private static async extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const res = await parser.getText();
      return (res.text || res || '').toString();
    } catch (err) {
      throw new Error(`Impossible de parser le fichier PDF : ${(err as Error).message}`);
    }
  }

  /**
   * Analyse sémantique universelle, adaptable à TOUT domaine professionnel.
   */
  public static parseCVText(rawText: string, sourceName: string = 'CV'): ExtractedCVProfile {
    const cleanText = rawText.replace(/\r\n/g, '\n');
    const lowerText = cleanText.toLowerCase();

    // 0. DÉTECTION DU DOMAINE MÉTIER
    const { domain, domainLabel } = this.detectCandidateDomain(cleanText);

    // 1. EXTRACTION DE L'IDENTITÉ & CONTACT
    let fullName = `${CONFIG.candidate.firstName} ${CONFIG.candidate.lastName}`;
    const nameLineMatch = cleanText.match(/^([A-ZÀ-Ÿ\s]{3,40}?)(?:Ingénieur|Développeur|Responsable|Chef|Consultant|Acheteur|Directeur|Analyste|Manager|\n|\r)/i);
    if (nameLineMatch && nameLineMatch[1].trim().length >= 3) {
      fullName = nameLineMatch[1].trim().replace(/\s+/g, ' ');
    } else {
      const fallbackNameMatch = cleanText.match(/([A-ZÀ-Ÿ]{2,}\s+[A-ZÀ-Ÿ]{2,})/);
      if (fallbackNameMatch) fullName = fallbackNameMatch[1].trim();
    }
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || CONFIG.candidate.firstName;
    const lastName = nameParts.slice(1).join(' ') || CONFIG.candidate.lastName;

    // Email
    const emailMatch = cleanText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1] : CONFIG.candidate.email;

    // Téléphone
    const phoneMatch = cleanText.match(/(?:\+33|0033|0)[1-9](?:[\s.-]*\d{2}){4}/);
    const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ') : CONFIG.candidate.phone;

    // Titre de poste détecté (dynamique selon le domaine réel)
    let detectedTitle = '';
    const titleMatch = cleanText.match(/(?:Responsable|Acheteur|Chef de projet|Contrôleur de gestion|Analyste|Directeur|Manager|Consultant|Ingénieur|Développeur)[^\n]{5,65}/i);
    if (titleMatch) {
      detectedTitle = titleMatch[0].replace(/^[„#ï§+\s\n\r\t]+/, '').trim();
    } else {
      // Titre par défaut adapté au domaine
      const defaultTitles: Record<CandidateDomain, string> = {
        achats_sourcing: 'Responsable Achats & Sourcing',
        logistique_supply: 'Responsable Logistique & Supply Chain',
        marketing_communication: 'Chef de Projet Marketing Digital',
        finance_comptabilite: 'Contrôleur de Gestion / Analyste Financier',
        rh_recrutement: 'Talent Acquisition Specialist / Chargé RH',
        commercial_vente: 'Business Developer / Responsable Commercial',
        tech_it: 'Ingénieur Full Stack Java React',
        polyvalent: 'Cadre / Manager Opérationnel',
      };
      detectedTitle = defaultTitles[domain];
    }

    // Localisation / Mobilité
    let city = CONFIG.candidate.city;
    const locationMatch = cleanText.match(/(?:Créteil|Paris|Île-de-France|Casablanca|Lyon|Toulouse|Nantes|Bordeaux|Rennes|Marseille|Lille|Strasbourg)/i);
    if (locationMatch) city = locationMatch[0];

    // URLs
    const linkedinMatch = cleanText.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i);
    const linkedinUrl = linkedinMatch ? `https://${linkedinMatch[0]}` : CONFIG.candidate.links.linkedin;

    const githubMatch = cleanText.match(/github\.com\/([a-zA-Z0-9-]+)/i);
    const githubUrl = githubMatch ? `https://${githubMatch[0]}` : CONFIG.candidate.links.github;

    const portfolioMatch = cleanText.match(/(https?:\/\/[a-zA-Z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?|(?:bayiin\.shop|noorexecution\.com))/i);
    const portfolioUrl = portfolioMatch ? (portfolioMatch[0].startsWith('http') ? portfolioMatch[0] : `https://${portfolioMatch[0]}`) : CONFIG.candidate.links.portfolio;

    // Diplôme / Formation
    let highestDegree = 'Master / Diplôme d\'Ingénieur (Bac+5)';
    if (/mastère|master|bac\+5|diplôme d'ingénieur|cycle d'ingénieur|école de commerce|iae|essec|hec|esc\b/i.test(cleanText)) {
      highestDegree = 'Master / Bac+5 (Grande École / Université)';
    } else if (/licence|bachelor|bac\+3/i.test(cleanText)) {
      highestDegree = 'Licence / Bachelor (Bac+3)';
    } else if (/bts|dut|deust|bac\+2/i.test(cleanText)) {
      highestDegree = 'BTS / DUT (Bac+2)';
    }

    let school = '';
    const schoolMatch = cleanText.match(/(?:EPISEN|IPSSI|INSA|Polytech|Centrale|Epitech|42|Université|IAE|KEDGE|NEOMA|SKEMA|EMLYON|EDHEC|HEC|ESSEC)/i);
    if (schoolMatch) school = schoolMatch[0];

    // Années d'expérience globale
    let experienceYears = CONFIG.candidate.experienceYears || 4;
    const expMatch = cleanText.match(/(\d+)\s*(?:ans?|années?)\s*d'expérience/i);
    if (expMatch) {
      experienceYears = parseInt(expMatch[1], 10);
    } else {
      const yearsFound = cleanText.match(/\b(201\d|202\d)\b/g);
      if (yearsFound && yearsFound.length >= 2) {
        const sorted = yearsFound.map(Number).sort((a, b) => a - b);
        const earliestJobYear = sorted.find((y) => y >= 2018) || sorted[0];
        const latestYear = new Date().getFullYear();
        const diff = latestYear - earliestJobYear;
        if (diff >= 1 && diff <= 30) experienceYears = diff;
      }
    }

    // 2. EXTRACTION UNIVERSELLE DES COMPÉTENCES (Taxonomie + Extraction Heuristique N-Gram)
    const detectedSkills: Record<string, ExtractedSkill> = {};
    const categorized: Record<string, string[]> = {};
    const weighted: Record<string, number> = {};
    const skillsMap: Record<string, number> = {};

    // A. Scan via le dictionnaire universel
    for (const [skillKey, meta] of Object.entries(UNIVERSAL_SKILLS_TAXONOMY)) {
      let frequency = 0;
      let matchedInTitleOrSummary = false;

      for (const alias of meta.aliases) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        const matches = cleanText.match(regex);
        if (matches) {
          frequency += matches.length;
        }

        const headerSnippet = cleanText.substring(0, 1000).toLowerCase();
        if (headerSnippet.includes(alias.toLowerCase())) {
          matchedInTitleOrSummary = true;
        }
      }

      if (frequency > 0) {
        let weight = 1;
        if (frequency >= 3 || matchedInTitleOrSummary) {
          weight = 3;
        } else if (frequency >= 2) {
          weight = 2;
        }

        // Si la compétence est centrale au domaine détecté, booster son poids
        if (meta.primaryDomains.includes(domain)) {
          weight = Math.min(3, weight + 1);
        }

        const skillYears = Math.min(experienceYears, Math.max(1, weight === 3 ? experienceYears : Math.round(experienceYears * 0.75)));

        detectedSkills[skillKey] = {
          name: skillKey,
          category: meta.category,
          weight,
          frequency,
          years: skillYears,
        };

        if (!categorized[meta.category]) categorized[meta.category] = [];
        categorized[meta.category].push(skillKey);
        weighted[skillKey] = weight;
        skillsMap[skillKey] = skillYears;
      }
    }

    // B. Détection de compétences transverses / termes techniques spécifiques présents dans le CV
    // Extrait les acronymes ou outils spécialisés (ex: CRM, WMS, TMS, SAP, SEO, GA4, IFRS, DSN, SQL...)
    const customAcronyms = cleanText.match(/\b([A-Z]{2,6})\b/g);
    if (customAcronyms) {
      const knownAcronyms = new Set(['WMS', 'TMS', 'SAP', 'SRM', 'ADV', 'CRM', 'ERP', 'SEO', 'SEA', 'ROI', 'KPI', 'IFRS', 'PCG', 'SIRH', 'BFR', 'TCO', 'S&OP', 'PDP', 'SQL', 'LLM', 'IA', 'API', 'REST', 'CI/CD']);
      for (const acr of customAcronyms) {
        const lowerAcr = acr.toLowerCase();
        if (knownAcronyms.has(acr) && !detectedSkills[lowerAcr]) {
          detectedSkills[lowerAcr] = {
            name: lowerAcr,
            category: 'methodologies_tools',
            weight: 2,
            frequency: 2,
            years: experienceYears,
          };
          if (!categorized['methodologies_tools']) categorized['methodologies_tools'] = [];
          categorized['methodologies_tools'].push(lowerAcr);
          weighted[lowerAcr] = 2;
          skillsMap[lowerAcr] = experienceYears;
        }
      }
    }

    // Soft skills universelles
    const softSkillsTerms = ['leadership', 'négociation', 'rigueur', 'agilité', 'autonomie', 'communication', 'esprit d\'analyse', 'gestion de projet', 'sens du résultat'];
    for (const term of softSkillsTerms) {
      if (lowerText.includes(term)) {
        if (!detectedSkills[term]) {
          detectedSkills[term] = {
            name: term,
            category: 'soft_skills',
            weight: 1,
            frequency: 1,
            years: experienceYears,
          };
        }
        if (!categorized['soft_skills']) categorized['soft_skills'] = [];
        if (!categorized['soft_skills'].includes(term)) categorized['soft_skills'].push(term);
        weighted[term] = 1;
        skillsMap[term] = experienceYears;
      }
    }

    // Tri des top keywords par poids décroissant puis fréquence
    const topKeywords = Object.values(detectedSkills)
      .sort((a, b) => b.weight - a.weight || b.frequency - a.frequency)
      .map((s) => s.name);

    // 3. GÉNÉRATION DU PITCH DE CANDIDATURE UNIVERSEL
    const top3Skills = topKeywords.slice(0, 4).map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(', ');
    const summaryPitch = cleanText.includes('À PROPOS')
      ? cleanText.split(/COMPÉTENCES/i)[0].replace(/^[\s\S]*?À PROPOS/i, '').trim().substring(0, 400)
      : `Professionnel diplômé ${highestDegree}${school ? ` (${school})` : ''}, ${experienceYears} ans d'expérience dans le domaine ${domainLabel}. Expert reconnu sur ${top3Skills || 'les missions stratégiques'}, orienté performance, rigueur opérationnelle et atteinte des objectifs.`;

    // 4. GÉNÉRATION DES RECOMMANDATIONS DE RECHERCHE D'OFFRES DYNAMIQUES
    // Formule des requêtes adaptées au métier réel du candidat
    const cleanRoleTitle = detectedTitle.replace(/\|.*$/, '').trim();
    const topTechQueryParts = topKeywords.slice(0, 2).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())).join(' ');
    const primaryTitleQuery = `${cleanRoleTitle} ${topTechQueryParts}`.trim();

    // Suggestions de recherche ciblées selon le domaine
    let suggestedQueries: string[] = [primaryTitleQuery];

    if (domain === 'achats_sourcing') {
      suggestedQueries.push(
        'Responsable Achats Sourcing Négociation',
        'Acheteur Senior SAP Supply Chain',
        'Acheteur Prestations Intellectuelles & Indirects',
        'Lead Acheteur International Sourcing'
      );
    } else if (domain === 'logistique_supply') {
      suggestedQueries.push(
        'Responsable Logistique & Supply Chain',
        'Coordinateur Transport & Gestion des Stocks WMS',
        'Supply Chain Manager Planification Flux',
        'Responsable d\'Exploitation Logistique'
      );
    } else if (domain === 'marketing_communication') {
      suggestedQueries.push(
        'Chef de Projet Marketing Digital CRM',
        'Growth Marketing Manager SEO Acquisition',
        'Responsable Marketing & Communication',
        'Brand Content Manager Social Media'
      );
    } else if (domain === 'finance_comptabilite') {
      suggestedQueries.push(
        'Contrôleur de Gestion Senior Business Partner',
        'Analyste Financier Modélisation Reporting',
        'Auditeur Financier Trésorerie IFRS',
        'Responsable Administratif et Financier (RAF)'
      );
    } else if (domain === 'rh_recrutement') {
      suggestedQueries.push(
        'Talent Acquisition Specialist Senior',
        'Responsable Ressources Humaines (RRH)',
        'Chargé de Recrutement & Marque Employeur',
        'Gestionnaire de Paie et ADP'
      );
    } else if (domain === 'commercial_vente') {
      suggestedQueries.push(
        'Business Developer Senior B2B',
        'Ingénieur Commercial Grands Comptes',
        'Key Account Manager (KAM)',
        'Responsable du Développement Commercial'
      );
    } else {
      // Tech / IT
      suggestedQueries.push(
        'Ingénieur Full Stack Java Spring Boot React',
        'Développeur Full Stack React TypeScript Java',
        'Ingénieur Backend Java Spring Boot Microservices',
        'Lead Développeur Architecture Cloud'
      );
    }

    // Requête Booléenne optimisée LinkedIn pour tout métier
    const booleanQueryLinkedIn = `("${cleanRoleTitle.split(' ')[0] || 'Responsable'}") AND (${topKeywords.slice(0, 2).map((k) => `"${k}"`).join(' OR ')})`;

    // Requête HelloWork
    const helloWorkQuery = `${cleanRoleTitle} ${topKeywords.slice(0, 2).join(' ')}`.trim();

    return {
      rawTextLength: cleanText.length,
      extractedAt: new Date().toISOString(),
      sourceFile: sourceName,
      candidate: {
        fullName,
        firstName,
        lastName,
        title: detectedTitle,
        domain,
        domainLabel,
        email,
        phone,
        city,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        degree: highestDegree,
        school,
        experienceYears,
        summaryPitch,
      },
      skills: {
        all: Object.keys(detectedSkills),
        categorized,
        weighted,
        skillsMap,
      },
      searchRecommendations: {
        primaryTitleQuery,
        suggestedQueries,
        booleanQueryLinkedIn,
        helloWorkQuery,
        excludedKeywords: ['stage', 'alternance', 'internship', 'stagiaire', 'bénévole'],
        requiredKeywords: topKeywords.slice(0, 5),
      },
      topKeywords,
      rawTextPreview: cleanText.substring(0, 600) + '...',
    };
  }

  /**
   * Sauvegarde le profil extrait dans le fichier persistant `data/cv_profile.json`.
   */
  public static saveProfile(profile: ExtractedCVProfile): void {
    try {
      const dir = path.dirname(CV_PROFILE_STORAGE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CV_PROFILE_STORAGE_PATH, JSON.stringify(profile, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erreur sauvegarde cv_profile.json:', err);
    }
  }

  /**
   * Charge le profil extrait persistant (s'il existe).
   */
  public static loadSavedProfile(): ExtractedCVProfile | null {
    try {
      if (fs.existsSync(CV_PROFILE_STORAGE_PATH)) {
        const raw = fs.readFileSync(CV_PROFILE_STORAGE_PATH, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {
      // Ignorer
    }
    return null;
  }
}
