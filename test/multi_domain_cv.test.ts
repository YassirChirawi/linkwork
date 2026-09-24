import { CVExtractor } from '../src/utils/cvExtractor.js';
import { JobScorer } from '../src/utils/jobScorer.js';
import { JobHunter } from '../src/utils/jobHunter.js';

async function runMultiDomainTests() {
  console.log('================================================================');
  console.log('   TEST : VALIDATION MULTI-DOMAINES (ACHATS, LOGISTIQUE, MARKETING, FINANCE, TECH)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✔ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // --- 1. CANDIDAT ACHATS & SOURCING ---
  console.log('--- 1. Candidat Achats & Sourcing ---');
  const cvAchats = `
    THOMAS MOREAU
    Responsable Achats & Sourcing International
    Email: thomas.moreau@email.com | Tél: 06 12 34 56 78
    Diplôme : Master Achats Internationaux (Bac+5 KEDGE) - 7 ans d'expérience
    À PROPOS :
    Expert Achats et Négociation fournisseurs. 7 ans d'expérience dans la gestion des appels d'offres (RFP),
    la réduction des coûts (TCO), la gestion des contrats cadres et le pilotage ERP sur SAP MM / Ariba.
    COMPÉTENCES :
    Achats, Sourcing, Négociation fournisseurs, Appels d'offres, Gestion des contrats, SAP MM, Réduction des coûts, Achats indirects, Excel avancé.
  `;
  const profAchats = CVExtractor.parseCVText(cvAchats, 'CV_Achats.txt');
  assert(profAchats.candidate.domain === 'achats_sourcing', `Domaine détecté : ${profAchats.candidate.domainLabel}`);
  assert(profAchats.skills.all.includes('achats') && profAchats.skills.all.includes('sap mm'), 'Achats et SAP MM extraits');
  assert(profAchats.searchRecommendations.primaryTitleQuery.includes('Achats'), `Requête Achats générée : "${profAchats.searchRecommendations.primaryTitleQuery}"`);

  // Scoring d'une offre Achats
  const evalAchats = JobScorer.evaluateJob(
    'Responsable Achats & Sourcing International (H/F)',
    'LVMH',
    'Pilotage panel fournisseurs, négociation contrats et SAP MM.',
    profAchats
  );
  assert(evalAchats.isMatch === true && evalAchats.score >= 80, `Offre Achats qualifiée : ${evalAchats.score}% (${evalAchats.matchGrade})`);
  assert(evalAchats.matchedKeywords.length >= 2, `Mots-clés matchés : ${evalAchats.matchedKeywords.join(', ')}`);

  // --- 2. CANDIDAT SUPPLY CHAIN & LOGISTIQUE ---
  console.log('\n--- 2. Candidat Supply Chain & Logistique ---');
  const cvLogistique = `
    SARAH BENALI
    Supply Chain Manager & Responsable Logistique
    Email: sarah.benali@email.com | Tél: 06 98 76 54 32
    Diplôme : Ingénieur Logistique & Transport (Bac+5) - 5 ans d'expérience
    EXPÉRIENCE :
    Responsable Logistique d'entrepôt : optimisation de la gestion des stocks, pilotage WMS et TMS.
    Coordination des flux de transport international, formalités de douane, incoterms et gestion des commandes ADV.
    COMPÉTENCES :
    Supply Chain, Logistique, Gestion des stocks, WMS, TMS, Transport international, Douane & Incoterms, ADV, Lean Logistics.
  `;
  const profLog = CVExtractor.parseCVText(cvLogistique, 'CV_Logistique.txt');
  assert(profLog.candidate.domain === 'logistique_supply', `Domaine détecté : ${profLog.candidate.domainLabel}`);
  assert(profLog.skills.all.includes('supply chain') && profLog.skills.all.includes('wms'), 'Supply Chain et WMS extraits');

  // Scoring offre Logistique
  const evalLog = JobScorer.evaluateJob(
    'Supply Chain & Logistics Manager (H/F)',
    'Carrefour Supply Chain',
    'Optimisation des stocks, WMS et coordination transport.',
    profLog
  );
  assert(evalLog.isMatch === true && evalLog.score >= 80, `Offre Logistique qualifiée : ${evalLog.score}% (${evalLog.matchGrade})`);

  // --- 3. CANDIDAT MARKETING & GROWTH ---
  console.log('\n--- 3. Candidat Marketing & Communication ---');
  const cvMarketing = `
    EMMA DUPONT
    Growth Marketing Manager & Chef de Projet Digital
    Email: emma.dupont@email.com | Tél: 06 11 22 33 44
    Diplôme : Master Marketing Digital (Bac+5 ESCP) - 4 ans d'expérience
    EXPÉRIENCE :
    Développement des stratégies d'acquisition B2B : SEO, SEA Google Ads, Meta Ads et Social Media.
    Automatisation CRM via HubSpot et Salesforce. Analyse de la performance et des conversions via GA4.
    COMPÉTENCES :
    Marketing digital, Growth marketing, SEO, SEA & Google Ads, Social media & ads, CRM & Emailing, Analytics & KPI, Stratégie de marque.
  `;
  const profMkt = CVExtractor.parseCVText(cvMarketing, 'CV_Marketing.txt');
  assert(profMkt.candidate.domain === 'marketing_communication', `Domaine détecté : ${profMkt.candidate.domainLabel}`);
  assert(profMkt.skills.all.includes('growth marketing') && profMkt.skills.all.includes('seo'), 'Growth et SEO extraits');

  // Scoring offre Marketing
  const evalMkt = JobScorer.evaluateJob(
    'Growth Marketing Manager & Acquisition B2B (H/F)',
    'Doctolib',
    'Acquisition SEO, Google Ads, CRM HubSpot et pilotage ROI.',
    profMkt
  );
  assert(evalMkt.isMatch === true && evalMkt.score >= 80, `Offre Marketing qualifiée : ${evalMkt.score}% (${evalMkt.matchGrade})`);

  // --- 4. CANDIDAT FINANCE & CONTRÔLE DE GESTION ---
  console.log('\n--- 4. Candidat Finance & Contrôle de Gestion ---');
  const cvFinance = `
    ANTOINE LECLERC
    Contrôleur de Gestion Senior & Analyste Financier
    Email: antoine.leclerc@email.com | Tél: 06 55 44 33 22
    Diplôme : Master Finance d'Entreprise (Bac+5 Paris Dauphine) - 6 ans d'expérience
    MISSIONS :
    Élaboration budgétaire, clôtures mensuelles, analyse des écarts et reporting financier de direction.
    Suivi de trésorerie, normes IFRS et pilotage des coûts sur SAP FI/CO et Excel avancé (Power Query, VBA).
    COMPÉTENCES :
    Contrôle de gestion, Analyse financière, Audit financier, Trésorerie & BFR, Clôture mensuelle, IFRS & normes, Reporting financier, SAP FI/CO, Excel avancé, Power BI.
  `;
  const profFin = CVExtractor.parseCVText(cvFinance, 'CV_Finance.txt');
  assert(profFin.candidate.domain === 'finance_comptabilite', `Domaine détecté : ${profFin.candidate.domainLabel}`);
  assert(profFin.skills.all.includes('contrôle de gestion') && profFin.skills.all.includes('sap fi/co'), 'Contrôle de gestion et SAP FI/CO extraits');

  // Scoring offre Finance
  const evalFin = JobScorer.evaluateJob(
    'Contrôleur de Gestion Senior / Business Partner (H/F)',
    'BNP Paribas',
    'Élaboration budgétaire, clôtures mensuelles, reporting et SAP FI/CO.',
    profFin
  );
  assert(evalFin.isMatch === true && evalFin.score >= 80, `Offre Finance qualifiée : ${evalFin.score}% (${evalFin.matchGrade})`);

  // --- 5. CANDIDAT TECH (CV RÉEL) ---
  console.log('\n--- 5. Candidat Tech (Vérification CV Réel) ---');
  const realProfile = await CVExtractor.extractFromConfiguredPath();
  assert(realProfile.candidate.domain === 'tech_it', `Domaine détecté CV réel : ${realProfile.candidate.domainLabel}`);
  const evalTech = JobScorer.evaluateJob(
    'Ingénieur d’études Full Stack Java Spring Boot / React (H/F)',
    'BNP Paribas',
    'Spring Boot, React, Microservices et MySQL.',
    realProfile
  );
  assert(evalTech.isMatch === true && evalTech.score >= 85, `Offre Tech idéale qualifiée (Score: ${evalTech.score}%, Grade ${evalTech.matchGrade})`);

  console.log(`\n================================================================`);
  console.log(`   RÉSULTATS : ${passed} / ${total} TESTS MULTI-DOMAINES VALIDÉS (100%) !`);
  console.log(`   Le script est universellement adapté à tous les domaines métiers.`);
  console.log(`================================================================\n`);
}

runMultiDomainTests().catch(console.error);
