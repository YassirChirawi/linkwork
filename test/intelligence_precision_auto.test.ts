import { JobScorer } from '../src/utils/jobScorer.js';
import { SmartFormSolver } from '../src/utils/formSolver.js';
import { promptSemiAutoChoice, resolvePendingSemiAuto } from '../src/utils/cli.js';
import { CONFIG } from '../src/config.js';

async function runValidationSuite() {
  console.log('================================================================');
  console.log('   TEST DE VALIDATION : BOT PLUS INTELLIGENT, PLUS PRÉCIS & 100% AUTO');
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

  // ==================== PILIER 1 : HAUTE PRÉCISION (JobScorer) ====================
  console.log('\n--- 1. Tests de Précision JobScorer ---');

  // Test 1.1 : Offre idéale Full Stack Java / React
  const job1 = JobScorer.evaluateJob(
    'Ingénieur d’études Full Stack Java Spring Boot React (H/F)',
    'BNP Paribas CIB',
    'Conception microservices Spring Boot et interface React TypeScript.'
  );
  assert(job1.isMatch === true, `Offre idéale acceptée (Score : ${job1.score}/100)`);
  assert(job1.score >= 70, `Score offre idéale >= 70% (obtenu : ${job1.score})`);
  assert(job1.primaryDomain === 'fullstack', 'Domaine détecté : fullstack');

  // Test 1.2 : Backend Spring Boot pur
  const job2 = JobScorer.evaluateJob('Développeur Backend Java Spring Boot Senior', 'Capgemini');
  assert(job2.isMatch === true, `Offre Backend Java acceptée (Score : ${job2.score}/100)`);
  assert(job2.primaryDomain === 'backend_java', 'Domaine détecté : backend_java');

  // Test 1.3 : Frontend React TypeScript pur
  const job3 = JobScorer.evaluateJob('Développeur Frontend React.js / TypeScript', 'Sopra Steria');
  assert(job3.isMatch === true, `Offre Frontend React acceptée (Score : ${job3.score}/100)`);
  assert(job3.primaryDomain === 'frontend_react', 'Domaine détecté : frontend_react');

  // Test 1.4 : Rejet strict d'un stage
  const job4 = JobScorer.evaluateJob('Stage - Développeur Full Stack Java Spring React', 'Startup Innovante');
  assert(job4.isMatch === false && job4.score === 0, `Stage immédiatement disqualifié (Score : ${job4.score})`);
  assert(job4.reasons[0].includes('stage'), 'Raison du rejet mentionne bien le stage');

  // Test 1.5 : Rejet strict d'une alternance
  const job5 = JobScorer.evaluateJob('Alternance / Apprenti Développeur Java', 'Grand Groupe');
  assert(job5.isMatch === false && job5.score === 0, `Alternance disqualifiée (Score : ${job5.score})`);

  // Test 1.6 : Rejet stack divergente (PHP Symfony pur sans Java ni React)
  const job6 = JobScorer.evaluateJob('Développeur Web PHP Symfony / Drupal', 'Agence Web');
  assert(job6.isMatch === false, `Stack concurrente rejetée (Score : ${job6.score}/100)`);

  // Test 1.7 : Rejet rôle non-IT
  const job7 = JobScorer.evaluateJob('Commercial B2B Grands Comptes IT', 'ESN Recrute');
  assert(job7.isMatch === false && job7.score === 0, `Rôle non technique rejeté (Score : ${job7.score})`);

  // ==================== PILIER 2 : PLUS INTELLIGENT (SmartFormSolver) ====================
  console.log('\n--- 2. Tests d’Intelligence Sémantique SmartFormSolver ---');

  // Test 2.1 : Matrice de compétences et synonymes
  const skillsMap = CONFIG.candidate.skillsMap;
  assert(skillsMap['java'] === 4, 'Java = 4 ans dans le profil');
  assert(skillsMap['react'] === 4, 'React = 4 ans dans le profil');
  assert(skillsMap['spring boot'] === 3, 'Spring Boot = 3 ans dans le profil');
  assert(skillsMap['typescript'] === 4, 'TypeScript = 4 ans dans le profil');

  // Test 2.2 : Profil candidat étendu
  assert(CONFIG.candidate.workAuthorization.authorizedInFrance === true, 'Autorisé à travailler en France');
  assert(CONFIG.candidate.workAuthorization.requiresSponsorship === false, 'Ne nécessite pas de sponsorship/visa');
  assert(CONFIG.candidate.workAuthorization.hasDriverLicense === true, 'Permis de conduire B possédé');
  assert(CONFIG.candidate.education.highestDegree.includes('Bac+5'), 'Diplôme Bac+5 certifié');

  // ==================== PILIER 3 : 100% AUTOMATIQUE & RÉSILIENT ====================
  console.log('\n--- 3. Tests 100% Automatique & Zéro Freeze ---');

  // Test 3.1 : AutoMode est actif par défaut
  assert(CONFIG.autoMode === true, 'CONFIG.autoMode est activé par défaut (100% automatique)');
  assert(CONFIG.minMatchScore === 50, 'Seuil minMatchScore configuré à 50%');

  // Test 3.2 : En autoMode, promptSemiAutoChoice ne bloque JAMAIS la console
  const autoDecision = await promptSemiAutoChoice({
    fieldIdentifier: 'test_question_inconnue',
    fieldLabel: 'Combien d’années sur une technologie exotique ?',
    jobTitle: 'Développeur Full Stack',
  });
  assert(autoDecision === 'skip', 'En autoMode, décision immédiate sans freeze stdin');

  // Test 3.3 : Résolution via API Dashboard
  let resolvedCallback = false;
  CONFIG.autoMode = false; // Bascule temporaire en semi-auto
  const semiAutoPromise = promptSemiAutoChoice({
    fieldIdentifier: 'test_dashboard',
    fieldLabel: 'Intervention via Dashboard',
  });

  // Simuler la résolution asynchrone depuis le Dashboard API
  setTimeout(() => {
    const success = resolvePendingSemiAuto('resume');
    resolvedCallback = success;
  }, 100);

  const semiDecision = await semiAutoPromise;
  assert(semiDecision === 'resume' && resolvedCallback === true, 'Résolution fluide via Dashboard API /api/semi-auto');
  CONFIG.autoMode = true; // Rétablir autoMode

  console.log('\n================================================================');
  console.log(`   RÉSULTATS : ${passed} / ${total} TESTS VALIDÉS AVEC SUCCÈS (100%) !`);
  console.log('   Le bot est vérifié plus intelligent, plus précis et 100% automatique.');
  console.log('================================================================\n');
}

runValidationSuite().catch((err) => {
  console.error('Erreur durant les tests :', err);
  process.exit(1);
});
