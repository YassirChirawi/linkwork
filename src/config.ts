import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Chargement des variables d'environnement
dotenv.config();

export interface CandidateProfile {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  experienceYears: number;
  salaryExpectation: string;
  resumePath: string;
  // Liens professionnels
  links: {
    linkedin: string;
    github: string;
    portfolio: string;
  };
  // Formation
  education: {
    highestDegree: string;
    school: string;
  };
  summaryPitch: string;
  // Matrice de compétences et années d'expérience
  skillsMap: Record<string, number>;
  // Réponses types pour questions oui/non fréquentes
  workAuthorization: {
    authorizedInFrance: boolean;
    requiresSponsorship: boolean;
    hasDriverLicense: boolean;
    comfortableWithCommute: boolean;
  };
  languages: {
    french: 'Natif' | 'Courant' | 'Intermédiaire';
    english: 'Natif' | 'Courant' | 'Intermédiaire';
    arabic: 'Natif' | 'Courant' | 'Intermédiaire';
  };
  workPreferences?: {
    remoteOrHybrid: string;
    noticePeriod: string;
    willingToRelocate: boolean;
    willingToTravel: boolean;
  };
  certifications?: string[];
}

export interface OrchestratorConfig {
  sessionStoragePath: string;
  headless: boolean;
  autoMode: boolean; // true = 100% automatique et autonome (zéro freeze stdin)
  minMatchScore: number; // Score de pertinence minimum (0-100) pour postuler
  geminiApiKey?: string;
  quotas: {
    maxEasyApplyPerSession: number;
    maxNetworkingPerSession: number;
    maxOutreachPerSession: number;
  };
  candidate: CandidateProfile;
  delays: {
    // Délais gaussiens (min, max, mean, stdDev en ms)
    typingSpeed: { min: number; max: number; mean: number; stdDev: number };
    microPause: { min: number; max: number };
    actionDelay: { min: number; max: number };
    pageScroll: { min: number; max: number };
    betweenApplications: { min: number; max: number };
  };
  jobSearch: {
    keywords: string;
    location: string;
    easyApplyOnly: boolean; // f_AL=true
    searchUrl?: string;
    excludedKeywords: string[];
    requiredKeywords: string[];
    blacklistedCompanies: string[];
  };
  networking: {
    searchKeywords: string[];
    defaultNoteTemplate: string;
    recruiterKeywords: string[];
    recruiterNoteTemplate: string;
    useAI?: boolean;
  };
  outreach: {
    hashtags: string[];
    likeProbability: number; // 0.0 à 1.0 (ex: 0.7 = 70% de chance de liker)
    commentProbability: number; // 0.0 à 1.0 (ex: 0.6 = 60% de chance de commenter)
    enableAI: boolean;
    connectNoteTemplate: string;
    booleanSearchQuery: string;
    postSearchQueries: {
      id: string;
      label: string;
      query: string;
    }[];
    product: {
      name: string;
      url: string;
      tagline: string;
      targetAudience: string[];
      pillars: {
        id: string;
        name: string;
        badge: string;
        description: string;
      }[];
    };
    targetPersonas: {
      id: string;
      title: string;
      titlesList: string[];
      sectors: string[];
      companySize: string;
      whyThem: string;
      booleanQuery: string;
      noteTemplate: string;
    }[];
  };
  simulation: {
    defaultDurationMinutes: number;
    likeProbability: number;
    expandCommentsProbability: number;
    dwellMinMs: number;
    dwellMaxMs: number;
    jobsBrowseIntervalMinutes: number;
    notificationsIntervalMinutes: number;
  };
  selectors: {
    easyApply: {
      jobCard: string;
      easyApplyButton: string;
      modal: string;
      nextButton: string;
      reviewButton: string;
      submitButton: string;
      dismissButton: string;
      confirmDiscardButton: string;
      errorMessage: string;
    };
    networking: {
      profileConnectButton: string;
      profileMoreButton: string;
      dropdownConnectItem: string;
      addNoteButton: string;
      noteTextarea: string;
      sendButton: string;
    };
    outreach: {
      feedPost: string;
      postActor: string;
      postDescription: string;
      authorHeadline: string;
      likeButton: string;
      commentButton: string;
      commentInput: string;
      commentSubmit: string;
      searchResultItem: string;
      searchResultLink: string;
      searchResultTitle: string;
      searchResultSubtitle: string;
    };
    helloWork: {
      offerCard: string;
      offerTitle: string;
      companyName: string;
      applyButton: string;
      directApplyBadge: string;
      motivationInput: string;
      confirmButton: string;
      successBadge: string;
    };
  };
  helloWorkSessionStoragePath: string;
  helloWork: {
    searchUrl: string;
    keywords: string;
    location: string;
    contractTypes: string[];
    simplifiedApplyOnly: boolean;
    quotas: {
      maxApplyPerSession: number;
    };
  };
}

export function resolveCandidateResumePath(): string {
  if (process.env.RESUME_PATH && fs.existsSync(process.env.RESUME_PATH)) {
    return process.env.RESUME_PATH;
  }
  const assetsDir = path.resolve(process.cwd(), 'assets');
  const defaultPath = path.join(assetsDir, 'CV_Yassir_Chirawi.pdf');
  if (fs.existsSync(defaultPath)) return defaultPath;

  // Détection automatique du 1er PDF présent dans assets/
  if (fs.existsSync(assetsDir)) {
    try {
      const files = fs.readdirSync(assetsDir);
      const foundPdf = files.find((f) => f.toLowerCase().endsWith('.pdf'));
      if (foundPdf) return path.join(assetsDir, foundPdf);
    } catch {
      // Silencieux
    }
  }
  return defaultPath;
}

export const CONFIG: OrchestratorConfig = {
  sessionStoragePath: process.env.SESSION_STORAGE_PATH || path.resolve(process.cwd(), 'state.json'),
  headless: process.env.HEADLESS === 'true',
  autoMode: process.env.AUTO_MODE !== 'false', // 100% automatique par défaut (true)
  minMatchScore: parseInt(process.env.MIN_MATCH_SCORE || '50', 10),
  geminiApiKey: process.env.GEMINI_API_KEY,
  quotas: {
    maxEasyApplyPerSession: parseInt(process.env.MAX_EASY_APPLY || '15', 10),
    maxNetworkingPerSession: parseInt(process.env.MAX_NETWORKING || '15', 10),
    maxOutreachPerSession: parseInt(process.env.MAX_OUTREACH || '10', 10),
  },
  candidate: {
    firstName: process.env.CANDIDATE_FIRST_NAME || 'Yassir',
    lastName: process.env.CANDIDATE_LAST_NAME || 'CHIRAWI',
    phone: process.env.CANDIDATE_PHONE || '+33605741054',
    email: process.env.CANDIDATE_EMAIL || 'yasschirawill@gmail.com',
    city: process.env.CANDIDATE_CITY || 'Créteil',
    experienceYears: parseInt(process.env.CANDIDATE_EXPERIENCE_YEARS || '4', 10),
    salaryExpectation: process.env.CANDIDATE_SALARY_EXPECTATION || '65000',
    resumePath: resolveCandidateResumePath(),
    links: {
      linkedin: 'https://www.linkedin.com/in/yassir-chirawi',
      github: 'https://github.com/YassirChirawi',
      portfolio: 'https://bayiin.shop',
    },
    education: {
      highestDegree: 'Master / Diplôme d\'Ingénieur (Bac+5)',
      school: 'EPISEN / IPSSI',
    },
    summaryPitch:
      'Ingénieur en informatique diplômé Bac+5 (EPISEN / IPSSI), 4 ans d\'expérience alliant la haute rigueur des systèmes financiers (BNP Paribas Securities Services) et l\'agilité des plateformes modernes (React.js, Java Spring Boot, Big Data & IA). Reconnu pour ma capacité à concevoir des architectures microservices performantes, sécurisées et maintenables.',
    skillsMap: {
      'java': 4,
      'spring': 3,
      'spring boot': 3,
      'spring security': 3,
      'react': 4,
      'reactjs': 4,
      'react query': 3,
      'typescript': 4,
      'javascript': 4,
      'node': 3,
      'angular': 3,
      'extjs': 2,
      'sql': 4,
      'mysql': 4,
      'postgresql': 4,
      'procédures stockées': 3,
      'datawarehouse': 3,
      'big data': 2,
      'ia': 2,
      'llm': 2,
      'gemini': 2,
      'claude': 2,
      'docker': 3,
      'jenkins': 3,
      'gitlab': 3,
      'ansible': 3,
      'sonarqube': 3,
      'fortify': 3,
      'burp': 3,
      'pentest': 3,
      'junit': 4,
      'agile': 4,
      'scrum': 4,
      'jira': 4,
      'microservices': 4,
      'rest': 4,
    },
    workAuthorization: {
      authorizedInFrance: true,
      requiresSponsorship: false,
      hasDriverLicense: true,
      comfortableWithCommute: true,
    },
    languages: {
      french: 'Courant',
      english: 'Courant',
      arabic: 'Natif',
    },
    workPreferences: {
      remoteOrHybrid: 'Hybride / Télétravail',
      noticePeriod: '1 mois',
      willingToRelocate: true,
      willingToTravel: true,
    },
    certifications: [
      'Master Bac+5 Ingénierie Logicielle (EPISEN / IPSSI)',
      'Architecture Microservices & Cloud (Java Spring Boot, Docker, CI/CD)',
      'Développeur Full Stack Réactif (React.js, TypeScript, Next.js)',
    ],
  },
  delays: {
    typingSpeed: { min: 45, max: 180, mean: 95, stdDev: 25 },
    microPause: { min: 800, max: 2200 },
    actionDelay: { min: 1400, max: 3200 },
    pageScroll: { min: 1200, max: 3500 },
    betweenApplications: { min: 5000, max: 12000 },
  },
  jobSearch: {
    keywords:
      process.env.JOB_SEARCH_KEYWORDS ||
      'Full Stack Java Spring Boot React TypeScript',
    location: process.env.JOB_SEARCH_LOCATION || 'France',
    easyApplyOnly: true,
    excludedKeywords: [
      'stage',
      'stagiaire',
      'internship',
      'intern',
      'alternance',
      'apprentissage',
      'apprenti',
    ],
    requiredKeywords: [
      'java',
      'j2ee',
      'spring',
      'boot',
      'react',
      'reactjs',
      'angular',
      'angularjs',
      'vue',
      'vuejs',
      'typescript',
      'javascript',
      'js',
      'ts',
      'node',
      'nodejs',
      'sql',
      'postgres',
      'postgresql',
      'mysql',
      'oracle',
      'python',
      'extjs',
      'microservices',
      'api',
      'rest',
      'graphql',
      'full stack',
      'fullstack',
      'full-stack',
      'frontend',
      'front-end',
      'front',
      'backend',
      'back-end',
      'back',
      'développeur',
      'developpeur',
      'developer',
      'dev',
      'ingénieur',
      'ingenieur',
      'engineer',
      'concepteur',
      'consultant',
      'tech lead',
      'lead dev',
      'architecte',
      'informatique',
      'software',
      'web',
    ],
    blacklistedCompanies: [
      'ESN Générique Non Qualifiée',
      'Entreprise Fictive',
    ],
  },
  networking: {
    searchKeywords: [
      'Tech Recruiter Java React',
      'Talent Acquisition Tech',
      'Engineering Manager Java',
      'CTO Startup',
      'Lead Developer Full Stack',
    ],
    recruiterKeywords: [
      'Talent Acquisition Specialist',
      'Talent Acquisition Manager',
      'Recruteur Tech',
      'Chargé de recrutement IT',
      'Responsable Recrutement',
      'Head of Talent',
      'Responsable RH IT',
    ],
    defaultNoteTemplate:
      'Bonjour {{firstName}},\nIngénieur Full Stack (Java Spring Boot, React, Big Data & IA), j\'ai beaucoup apprécié vos projets. Je serais ravi de rejoindre votre réseau et d\'échanger.\nBien à vous, Yassir',
    recruiterNoteTemplate:
      'Bonjour {{firstName}},\nImpressionné par les talents tech que vous accompagnez. Ingénieur Full Stack Java (Spring Boot) & React/Angular (4 ans d\'expérience dont BNP Paribas), je serais ravi d\'intégrer votre réseau et d\'échanger sur vos opportunités.\nBien à vous, Yassir',
    useAI: true,
  },
  outreach: {
    hashtags: [
      '#ecommerce_maroc',
      '#facturation_maroc',
      '#ecom_maroc',
      '#cod_maroc',
      '#pme_maroc',
      '#digitalisation_maroc',
      '#supplychain',
      '#d2c',
    ],
    likeProbability: 0.6,
    commentProbability: 0.65,
    enableAI: true,
    booleanSearchQuery:
      '(Fondateur OR CEO OR "E-commerce Manager" OR Gérant) AND (Marque OR D2C OR "Cash on delivery" OR E-commerce OR Facturation) AND Maroc',
    postSearchQueries: [
      {
        id: 'ecommerce_maroc',
        label: 'E-commerce & Vente en Ligne Maroc',
        query: '("e-commerce maroc" OR "ecommerce maroc" OR "boutique en ligne maroc" OR "cod maroc" OR "vendre en ligne maroc")',
      },
      {
        id: 'facturation_maroc',
        label: 'Facturation, Devis & Trésorerie PME Maroc',
        query: '("facturation maroc" OR "gestion facture maroc" OR "logiciel facturation maroc" OR "devis facture maroc" OR "dématérialisation facture maroc" OR "ice facture maroc")',
      },
      {
        id: 'pme_digital_maroc',
        label: 'Digitalisation & PME Maroc',
        query: '("pme maroc" OR "tpe maroc" OR "digitalisation maroc" OR "transformation digitale maroc" OR "auto entrepreneur maroc")',
      },
    ],
    connectNoteTemplate:
      'Bonjour {{firstName}},\nJ\'ai vu votre publication sur l\'activité d\'entreprise au Maroc. En tant que fondateur de BayIIn (ERP centralisant factures ICE, stocks, transporteurs Cathedis/Sendit et trésorerie), je serais ravi d\'échanger avec vous !',
    product: {
      name: 'BayIIn',
      url: 'https://bayiin.shop',
      tagline: 'L\'ERP SaaS tout-en-un pour marchands e-commerce & marques D2C en Cash on Delivery (COD) au Maroc',
      targetAudience: [
        'Marchands e-commerce et marques D2C opérant principalement au Maroc',
        'Vendeurs en Cash on Delivery (COD) gérant stocks physiques, variantes et réduction des retours',
        'Commerçants omnicanaux centralisant logistique, finance et canaux de vente sans multi-abonnements',
      ],
      pillars: [
        {
          id: 'erp_ops',
          name: 'Gestion Centrale des Opérations (ERP)',
          badge: 'ERP Multi-Dépôts',
          description:
            'Pilotage des stocks en temps réel par dépôt avec déclinaisons (tailles, couleurs). Tunnel d\'administration ultra-rapide pour la capture, validation et traitement des commandes COD.',
        },
        {
          id: 'logistics_hub',
          name: 'Hub Logistique Intégré',
          badge: 'Cathedis / Sendit / O-Livraison',
          description:
            'Connexion directe via API aux transporteurs locaux (Cathedis, Sendit, O-Livraison). Génération automatique des bordereaux d\'expédition (AWB) et calcul dynamique des frais de port par ville.',
        },
        {
          id: 'finance_margin',
          name: 'Réconciliation Financière & Rentabilité',
          badge: 'Marge Nette Temps Réel',
          description:
            'Suivi automatisé des encaissements terrain (Livré, Retourné, Encaissé). Calcul en temps réel de la marge nette (déduction coût d\'achat, transport réel et coûts d\'acquisition).',
        },
        {
          id: 'ai_copilot',
          name: 'Copilote IA Opérationnel (Beya3)',
          badge: 'WhatsApp & Beya3',
          description:
            'Assistance automatisée aux opérations (alertes de réapprovisionnement, détection des anomalies, aide support client). Prise et suivi conversationnel de commandes via WhatsApp.',
        },
        {
          id: 'storefront_builder',
          name: 'Storefront Builder Intégré',
          badge: 'FR / AR RTL Natif',
          description:
            'Moteur de création de vitrine e-commerce bilingue (Français/Arabe RTL natif) modulaire en sections/blocs. Synchronisation ERP en direct (zéro risque de survente), formulaire monopage relié aux grilles transporteurs.',
        },
      ],
    },
    targetPersonas: [
      {
        id: 'd2c_founders',
        title: '1. Fondateurs & Gérants D2C',
        titlesList: ['Fondateur', 'Cofondateur', 'CEO', 'Gérant', 'Brand Owner'],
        sectors: ['Cosmétique / Skincare bio', 'Mode / Prêt-à-porter local', 'Maroquinerie', 'Accessoires tech', 'Décoration d\'intérieur'],
        companySize: '1 à 10 salariés',
        whyThem:
          'Ils portent souvent la casquette de logisticien le soir. Ils en ont marre de saisir les commandes à la main sur les portails de transporteurs et manquent de visibilité sur leur marge nette réelle.',
        booleanQuery:
          '(Fondateur OR Cofondateur OR CEO OR Gérant OR "Brand Owner") AND (Marque OR D2C OR Skincare OR Cosmétique OR Mode OR Maroquinerie OR "Décoration") AND Maroc',
        noteTemplate:
          'Bonjour {{firstName}}, impressionné par votre marque au Maroc. Avec BayIIn, on aide les marques D2C à automatiser stocks et bordereaux AWB (Cathedis, Sendit) pour suivre la vraie marge nette COD sans saisie manuelle le soir. Preneur de votre avis !',
      },
      {
        id: 'ecom_ops_managers',
        title: '2. Responsables E-commerce & Opérations',
        titlesList: ['E-commerce Manager', 'Responsable E-commerce', 'Head of Operations', 'COO', 'Supply Chain Manager'],
        sectors: ['Retailers locaux', 'Distributeurs compléments alimentaires', 'Parfumerie', 'Électronique grand public'],
        companySize: '11 à 50 salariés',
        whyThem:
          'Leur quotidien consiste à réduire le taux de retour (NPAI/refus), suivre les bordereaux d\'expédition (AWB) et éviter les ruptures de stock. La connexion native aux transporteurs et la réconciliation financière résolvent directement leurs irritants.',
        booleanQuery:
          '("E-commerce Manager" OR "Responsable E-commerce" OR "Head of Operations" OR COO OR "Supply Chain Manager") AND (Retail OR "Cash on delivery" OR E-commerce OR Logistique) AND Maroc',
        noteTemplate:
          'Bonjour {{firstName}}, en tant qu\'E-commerce Manager au Maroc, vous connaissez l\'enfer des retours COD et du suivi des AWB. BayIIn connecte directement Cathedis, Sendit & O-Livraison avec réconciliation financière automatisée. Échangeons !',
      },
      {
        id: 'growth_agencies',
        title: '3. Agences Growth & Consultants COD',
        titlesList: ['Founder', 'Head of Acquisition', 'Media Buyer', 'Consultant E-commerce COD', 'Growth Marketer'],
        sectors: ['Agences Growth E-commerce', 'Media Buying COD', 'Consulting acquisition'],
        companySize: 'Indépendants ou agences de 2 à 15 personnes',
        whyThem:
          'Ce sont des prescripteurs. Ils gèrent les budgets de plusieurs boutiques à la fois et se plaignent constamment du décalage entre le ROAS publicitaire et la marge nette réelle encaissée après annulations et retours.',
        booleanQuery:
          '("Head of Acquisition" OR "Media Buyer" OR "Consultant E-commerce" OR "Growth") AND ("Cash on delivery" OR COD OR E-commerce) AND Maroc',
        noteTemplate:
          'Bonjour {{firstName}}, vous pilotez l\'acquisition e-com COD au Maroc : le vrai défi est le décalage entre ROAS publicitaire et marge nette réelle encaissée après retours. C\'est ce que BayIIn synchronise en direct. Discutons !',
      },
    ],
  },
  selectors: {
    easyApply: {
      jobCard: '.jobs-search-results-list li.jobs-search-results__list-item, .scaffold-layout__list-item, div.job-card-container, div[data-job-id]',
      easyApplyButton: 'div.jobs-apply-button--top-card button, .jobs-s-apply button, button.jobs-apply-button, button[aria-label*="Easy Apply"], button[aria-label*="Candidature simplifiée"], button:has-text("Candidature simplifiée"), button:has-text("Easy Apply")',
      modal: 'div.jobs-easy-apply-modal, div[data-test-modal], div.artdeco-modal[role="dialog"], div[role="dialog"], div[data-view-name*="easy-apply"]',
      nextButton: 'button[aria-label*="Continuer vers l\'étape suivante"], button[aria-label*="Continue to next step"], button:has-text("Suivant"), button:has-text("Next"), button.artdeco-button--primary',
      reviewButton: 'button[aria-label*="Vérifier votre candidature"], button[aria-label*="Review your application"], button:has-text("Vérifier"), button:has-text("Review")',
      submitButton: 'button[aria-label*="Envoyer la candidature"], button[aria-label*="Submit application"], button:has-text("Envoyer la candidature"), button:has-text("Submit application")',
      dismissButton: 'button.artdeco-modal__dismiss, button[data-test-modal-close-btn], button[aria-label*="Fermer la boîte de dialogue"], button[aria-label*="Fermer"], button[aria-label*="Dismiss"], button[aria-label*="Close"], button:has-text("Fermer")',
      confirmDiscardButton: 'button[data-control-name="discard_application_confirm_btn"], button[data-test-dialog-primary-btn], button:has-text("Ignorer"), button:has-text("Discard"), button:has-text("Abandonner"), button:has-text("Ne pas enregistrer"), button:has-text("Supprimer")',
      errorMessage: '.artdeco-inline-feedback--error',
    },
    networking: {
      profileConnectButton: 'button.pvs-profile-actions__action:has-text("Se connecter"), button:has-text("Connect")',
      profileMoreButton: 'button[aria-label*="Plus d\'actions"], button[aria-label*="More actions"], div.pvs-profile-actions button:has-text("Plus"), div.pvs-profile-actions button:has-text("More")',
      dropdownConnectItem: 'div[role="button"]:has-text("Se connecter"), div[role="button"]:has-text("Connect"), span:has-text("Se connecter")',
      addNoteButton: 'button[aria-label*="Ajouter une note"], button:has-text("Ajouter une note"), button:has-text("Add a note")',
      noteTextarea: 'textarea[name="message"], textarea#custom-message',
      sendButton: 'button[aria-label*="Envoyer"], button:has-text("Envoyer"), button:has-text("Send")',
    },
    outreach: {
      feedPost: 'div.feed-shared-update-v2, div[data-urn*="urn:li:activity"], div[data-chameleon-result-urn], div.search-results-container div.artdeco-card, div.artdeco-card:has(div.update-components-actor)',
      postActor: '.update-components-actor__meta a.app-aware-link, .update-components-actor__name',
      postDescription: '.feed-shared-update-v2__description, .update-components-text, .feed-shared-inline-show-more-text',
      authorHeadline: '.update-components-actor__description, .update-components-actor__supplementary-actor-info',
      likeButton: 'button.react-button__trigger, button[aria-label*="J’aime"], button[aria-label*="Like"]',
      commentButton: 'button[aria-label*="Commenter"], button[aria-label*="Comment"], button.comment-button',
      commentInput: 'div.ql-editor[role="textbox"], div[aria-placeholder*="Ajouter un commentaire"]',
      commentSubmit: 'button.comments-comment-box__submit-button',
      searchResultItem: 'div[data-view-name*="search-entity"], li.reusable-search__result-container, .reusable-search__result-container, div.entity-result, ul.reusable-search__entity-result-list > li, li.artdeco-list__item',
      searchResultLink: '.entity-result__title-text a.app-aware-link, a.app-aware-link[href*="/in/"], a[href*="/in/"]',
      searchResultTitle: '.entity-result__title-text a span[aria-hidden="true"]',
      searchResultSubtitle: '.entity-result__primary-subtitle',
    },
    helloWork: {
      offerCard: 'li[data-cy="offer-card"], div.cr-offer-item, [data-cy="job-offer"], div.offer--item, [data-cy="offer-preview"], div[data-cy*="offer"]',
      offerTitle: 'h2, [data-cy="offer-title"], .offer--title',
      companyName: '[data-cy="offer-company"], span.cr-offer-company, .offer--company',
      applyButton: 'button[data-cy="apply-button"], a[data-cy="apply-button"], button:has-text("Postuler"), a:has-text("Postuler")',
      directApplyBadge: '[data-cy="direct-apply"], span:has-text("Candidature simplifiée"), span:has-text("1 clic")',
      motivationInput: 'textarea#message, textarea[name="message"], textarea[data-cy="motivation-input"]',
      confirmButton: 'button[type="submit"], button[data-cy="confirm-apply"], button:has-text("Confirmer ma candidature"), button:has-text("Envoyer")',
      successBadge: '[data-cy="apply-success"], div:has-text("Votre candidature a bien été transmise")',
    },
  },
  simulation: {
    defaultDurationMinutes: 60,
    likeProbability: 0.20,
    expandCommentsProbability: 0.15,
    dwellMinMs: 8000,
    dwellMaxMs: 28000,
    jobsBrowseIntervalMinutes: 15,
    notificationsIntervalMinutes: 22,
  },
  helloWorkSessionStoragePath: process.env.HELLOWORK_SESSION_PATH || path.resolve(process.cwd(), 'hellowork_state.json'),
  helloWork: {
    searchUrl: 'https://www.hellowork.com/fr-fr/emploi/recherche.html',
    keywords: process.env.HELLOWORK_KEYWORDS || 'Ingénieur Full Stack Java Spring Boot React',
    location: process.env.HELLOWORK_LOCATION || 'Paris 75000',
    contractTypes: ['CDI'],
    simplifiedApplyOnly: true,
    quotas: {
      maxApplyPerSession: parseInt(process.env.MAX_HELLOWORK_APPLY || '15', 10),
    },
  },
};

const USER_CONFIG_FILE = path.resolve(process.cwd(), 'data', 'user_config.json');

export function syncEnvFile(entries: Record<string, string | number>): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    let content = fs.readFileSync(envPath, 'utf-8');
    for (const [key, val] of Object.entries(entries)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${val}`);
      } else {
        content += `\n${key}=${val}`;
      }
    }
    fs.writeFileSync(envPath, content, 'utf-8');
  } catch {
    // Non bloquant
  }
}

export function loadUserConfig(): void {
  try {
    // Rechargement à chaud de .env pour capter d'éventuelles modifications manuelles
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
    }

    if (fs.existsSync(USER_CONFIG_FILE)) {
      const raw = fs.readFileSync(USER_CONFIG_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (typeof data.autoMode === 'boolean') CONFIG.autoMode = data.autoMode;
      if (typeof data.minMatchScore === 'number') CONFIG.minMatchScore = data.minMatchScore;
      if (data.geminiApiKey) CONFIG.geminiApiKey = data.geminiApiKey;
      if (data.candidate) {
        if (data.candidate.skillsMap) {
          CONFIG.candidate.skillsMap = { ...data.candidate.skillsMap };
        }
        Object.assign(CONFIG.candidate, data.candidate);
      }
      if (data.quotas) Object.assign(CONFIG.quotas, data.quotas);
      if (data.jobSearch) Object.assign(CONFIG.jobSearch, data.jobSearch);
      if (data.helloWork) Object.assign(CONFIG.helloWork, data.helloWork);
      if (data.networking) Object.assign(CONFIG.networking, data.networking);
    }

    // Si une variable d'environnement explicite est présente dans .env, elle est prioritaire
    if (process.env.MAX_EASY_APPLY) {
      CONFIG.quotas.maxEasyApplyPerSession = parseInt(process.env.MAX_EASY_APPLY, 10);
    }
    if (process.env.MAX_NETWORKING) {
      CONFIG.quotas.maxNetworkingPerSession = parseInt(process.env.MAX_NETWORKING, 10);
    }
    if (process.env.MAX_OUTREACH) {
      CONFIG.quotas.maxOutreachPerSession = parseInt(process.env.MAX_OUTREACH, 10);
    }
    if (process.env.MAX_HELLOWORK_APPLY) {
      CONFIG.helloWork.quotas.maxApplyPerSession = parseInt(process.env.MAX_HELLOWORK_APPLY, 10);
    }
  } catch (err) {
    console.warn('Erreur chargement user_config.json:', err);
  }
}

export function saveUserConfig(overrides: Partial<OrchestratorConfig>): void {
  try {
    const dir = path.dirname(USER_CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let current: any = {};
    if (fs.existsSync(USER_CONFIG_FILE)) {
      try {
        current = JSON.parse(fs.readFileSync(USER_CONFIG_FILE, 'utf-8'));
      } catch {
        current = {};
      }
    }

    const updated = {
      ...current,
      ...overrides,
      autoMode: overrides.autoMode !== undefined ? overrides.autoMode : (current.autoMode !== undefined ? current.autoMode : CONFIG.autoMode),
      minMatchScore: overrides.minMatchScore !== undefined ? overrides.minMatchScore : (current.minMatchScore !== undefined ? current.minMatchScore : CONFIG.minMatchScore),
      geminiApiKey: overrides.geminiApiKey !== undefined ? overrides.geminiApiKey : (current.geminiApiKey !== undefined ? current.geminiApiKey : CONFIG.geminiApiKey),
      candidate: {
        ...(current.candidate || {}),
        ...(overrides.candidate || {}),
        ...(overrides.candidate?.skillsMap ? { skillsMap: overrides.candidate.skillsMap } : {}),
      },
      quotas: { ...(current.quotas || {}), ...(overrides.quotas || {}) },
      jobSearch: { ...(current.jobSearch || {}), ...(overrides.jobSearch || {}) },
      helloWork: { ...(current.helloWork || {}), ...(overrides.helloWork || {}) },
      networking: { ...(current.networking || {}), ...(overrides.networking || {}) },
    };

    fs.writeFileSync(USER_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');

    // Appliquer en mémoire
    if (overrides.autoMode !== undefined) CONFIG.autoMode = overrides.autoMode;
    if (overrides.minMatchScore !== undefined) CONFIG.minMatchScore = overrides.minMatchScore;
    if (overrides.geminiApiKey !== undefined) CONFIG.geminiApiKey = overrides.geminiApiKey;
    if (overrides.candidate) {
      if (overrides.candidate.skillsMap) {
        CONFIG.candidate.skillsMap = { ...overrides.candidate.skillsMap };
      }
      Object.assign(CONFIG.candidate, overrides.candidate);
    }

    const envUpdates: Record<string, string | number> = {};

    if (overrides.quotas) {
      Object.assign(CONFIG.quotas, overrides.quotas);
      if (overrides.quotas.maxEasyApplyPerSession !== undefined) {
        process.env.MAX_EASY_APPLY = String(overrides.quotas.maxEasyApplyPerSession);
        envUpdates['MAX_EASY_APPLY'] = overrides.quotas.maxEasyApplyPerSession;
      }
      if (overrides.quotas.maxNetworkingPerSession !== undefined) {
        process.env.MAX_NETWORKING = String(overrides.quotas.maxNetworkingPerSession);
        envUpdates['MAX_NETWORKING'] = overrides.quotas.maxNetworkingPerSession;
      }
      if (overrides.quotas.maxOutreachPerSession !== undefined) {
        process.env.MAX_OUTREACH = String(overrides.quotas.maxOutreachPerSession);
        envUpdates['MAX_OUTREACH'] = overrides.quotas.maxOutreachPerSession;
      }
    }

    if (overrides.helloWork) {
      if (overrides.helloWork.quotas?.maxApplyPerSession !== undefined) {
        const hwQ = overrides.helloWork.quotas.maxApplyPerSession;
        if (!CONFIG.helloWork.quotas) CONFIG.helloWork.quotas = { maxApplyPerSession: hwQ };
        else CONFIG.helloWork.quotas.maxApplyPerSession = hwQ;
        process.env.MAX_HELLOWORK_APPLY = String(hwQ);
        envUpdates['MAX_HELLOWORK_APPLY'] = hwQ;
      }
      Object.assign(CONFIG.helloWork, overrides.helloWork);
    }

    if (Object.keys(envUpdates).length > 0) {
      syncEnvFile(envUpdates);
    }

    if (overrides.jobSearch) Object.assign(CONFIG.jobSearch, overrides.jobSearch);
    if (overrides.networking) Object.assign(CONFIG.networking, overrides.networking);
  } catch (err) {
    console.error('Erreur sauvegarde user_config.json:', err);
    throw err;
  }
}

// Charger les configs personnalisées dès l'initialisation
loadUserConfig();
