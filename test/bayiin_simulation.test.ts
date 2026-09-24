import { describe, it, expect } from 'vitest'; // or standalone test runner
import { AIGenerator } from '../src/utils/aiGenerator.js';
import { HumanSimulationModule } from '../src/modules/humanSimulation.js';
import { CONFIG } from '../src/config.js';

// Standalone executable test runner for Node / tsx
async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 LANCEMENT DES TESTS : BAYIIN, RH & SIMULATION 1H');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✔ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${testName}`);
      failed++;
    }
  }

  const ai = new AIGenerator();

  // Test 1 : Détection thématique Facturation Maroc
  const resInvoicing = await ai.generateContent({
    postText: "La gestion de devis et factures conformes avec l'ICE au Maroc reste complexe pour les PME.",
    authorName: 'Karim Bennani',
    authorHeadline: 'Gérant PME Casablanca',
    context: 'saas_bayiin',
  });
  assert(
    resInvoicing.detectedTopic === 'morocco_invoicing_management',
    'Détection sémantique thématique : morocco_invoicing_management'
  );
  assert(
    resInvoicing.comment !== undefined && resInvoicing.comment.includes('facturation'),
    'Génération commentaire d\'expert sur la facturation marocaine'
  );
  assert(
    resInvoicing.inviteNote.includes('BayIIn') && resInvoicing.inviteNote.length <= 290,
    `Note d'invitation BayIIn Facturation valide (${resInvoicing.inviteNote.length} car. <= 290)`
  );

  // Test 2 : Détection thématique E-commerce Maroc
  const resEcom = await ai.generateContent({
    postText: "Lancement de notre nouvelle boutique e-commerce au Maroc avec paiement en ligne et livraison rapide.",
    authorName: 'Sara Alami',
    authorHeadline: 'E-commerce Specialist',
    context: 'saas_bayiin',
  });
  assert(
    resEcom.detectedTopic === 'morocco_ecommerce_growth',
    'Détection sémantique thématique : morocco_ecommerce_growth'
  );
  assert(
    resEcom.comment !== undefined && resEcom.comment.length > 30,
    'Commentaire d\'expert généré pour l\'e-commerce au Maroc'
  );

  // Test 3 : Détection thématique Talent Acquisition & RH
  const resRecruiter = await ai.generateContent({
    postText: "Nous recrutons activement pour nos équipes techniques en France.",
    authorName: 'Claire Dupont',
    authorHeadline: 'Talent Acquisition Specialist @ FinTech Paris',
    context: 'job_hunting',
  });
  assert(
    resRecruiter.detectedTopic === 'talent_acquisition_rh' || resRecruiter.detectedTopic === 'tech_recruiting',
    'Détection thématique Talent Acquisition & Recruteur'
  );
  assert(
    resRecruiter.inviteNote.includes('Full Stack') && resRecruiter.inviteNote.length <= 290,
    `Note personnalisée pour Recruteur RH conforme (< 290 car. : ${resRecruiter.inviteNote.length})`
  );

  // Test 4 : Initialisation et arrêt propre du module HumanSimulationModule
  const sim = new HumanSimulationModule(undefined, { durationMinutes: 60 });
  const initialStats = sim.getStats();
  assert(initialStats.durationMinutes === 60, 'Simulation 1h : Durée configurée à 60 minutes');
  assert(initialStats.remainingSeconds === 3600, 'Simulation 1h : Chronomètre initialisé à 3600 secondes');

  sim.stop();
  const stoppedStats = sim.getStats();
  assert(stoppedStats.currentActivity.includes('Arrêt'), 'Simulation 1h : Signal d\'arrêt pris en compte instantanément');

  // Test 5 : Configuration des requêtes posts BayIIn Maroc et recruteurs RH
  assert(
    CONFIG.outreach.postSearchQueries.length >= 3,
    'Configuration : Requêtes de recherche de publications BayIIn Maroc présentes (>= 3)'
  );
  assert(
    CONFIG.networking.recruiterKeywords.includes('Talent Acquisition Specialist'),
    'Configuration : Mots-clés Talent Acquisition configurés pour le networking'
  );

  console.log('\n------------------------------------------------------');
  console.log(`TOTAL : ${passed} passés, ${failed} échoués.`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Erreur exécution tests :', err);
  process.exit(1);
});
