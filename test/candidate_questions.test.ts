import fs from 'fs';
import path from 'path';
import { SmartFormSolver } from '../src/utils/formSolver.js';
import { CandidateQuestionsManager } from '../src/utils/questionsManager.js';
import { CONFIG } from '../src/config.js';

async function runCandidateQuestionsTests() {
  console.log('================================================================');
  console.log('   TEST : QUESTIONS CANDIDAT & RÈGLE PAR DÉFAUT 3 ANS');
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

  // --- 1. QUESTIONS COMMENÇANT PAR "COMBIEN D'ANNÉES" ---
  console.log('--- 1. Règle "Combien d\'années" : Tiré des skills sinon 3 ---');

  // A. Compétence présente dans les skills (Java = 4 dans CONFIG)
  const javaExp = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience avez-vous avec Java ?");
  assert(javaExp === 4, `Question 'Java' résolue depuis les skills : ${javaExp} ans`);

  // B. Compétence inconnue non présente dans les skills (ex: "RustLangInconnu2026")
  const rustExp = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience avez-vous avec RustLangInconnu2026 ?");
  assert(rustExp === 3, `Compétence inconnue 'RustLangInconnu2026' résolue avec le chiffre 3 : ${rustExp} ans`);

  // C. Question commençant par "Combien d'années d'expérience..." avec formulation variée
  const angularExp = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience avez-vous sur Flutter ?");
  assert(angularExp === 3, `Compétence non configurée 'Flutter' résolue avec 3 ans : ${angularExp} ans`);

  // D. Question en anglais "How many years of experience do you have with Go?"
  const goExp = SmartFormSolver.resolveYearsOfExperience("How many years of work experience do you have with Go?");
  assert(goExp === 3, `Question anglophone inconnue 'Go' résolue avec 3 ans : ${goExp} ans`);

  // --- 2. ENREGISTREMENT DANS CANDIDATE QUESTIONS MANAGER ---
  console.log('\n--- 2. Enregistrement automatique des questions posées ---');

  const pendingQuestions = CandidateQuestionsManager.getPendingQuestions();
  assert(pendingQuestions.length >= 2, `Au moins 2 questions en attente de précision enregistrées (${pendingQuestions.length} détectées)`);

  const rustQuestion = pendingQuestions.find(q => q.skillName === 'rustlanginconnu2026');
  assert(rustQuestion !== undefined, "Question 'rustlanginconnu2026' retrouvée dans les questions enregistrées");
  assert(rustQuestion?.botAnswer === '3', `Réponse temporaire du bot enregistrée à 3 : ${rustQuestion?.botAnswer}`);
  assert(rustQuestion?.fallbackApplied === true, "Indicateur fallbackApplied bien à true");

  // --- 3. FINALISATION DE TOUR & GÉNÉRATION MARKDOWN ---
  console.log('\n--- 3. Finalisation du tour & Création de QUESTIONS_A_REMPLIR.md ---');

  const tourResult = CandidateQuestionsManager.finalizeTour('TestTour');
  assert(tourResult.length > 0, `Tour finalisé avec ${tourResult.length} questions à compléter`);

  const mdPath = path.resolve(process.cwd(), 'QUESTIONS_A_REMPLIR.md');
  assert(fs.existsSync(mdPath), "Fichier QUESTIONS_A_REMPLIR.md généré sur le disque");

  const mdContent = fs.readFileSync(mdPath, 'utf-8');
  assert(mdContent.includes('Suite de Questions Candidat'), "En-tête présent dans QUESTIONS_A_REMPLIR.md");
  assert(mdContent.includes('RUSTLANGINCONNU2026') || mdContent.includes('rustlanginconnu2026'), "Compétence 'rustlanginconnu2026' présente dans QUESTIONS_A_REMPLIR.md");
  assert(mdContent.includes('[ 3 ]'), "Valeur par défaut 3 ans présente entre crochets dans QUESTIONS_A_REMPLIR.md");

  // --- 4. RÉPONSE DU CANDIDAT & MISE À JOUR POUR LE TOUR SUIVANT ---
  console.log('\n--- 4. Précision par le candidat pour le tour suivant ---');

  // Le candidat indique qu'il a en réalité 6 ans d'expérience sur Rust
  if (rustQuestion) {
    CandidateQuestionsManager.answerQuestion(rustQuestion.id, '6');
    assert(CONFIG.candidate.skillsMap['rustlanginconnu2026'] === 6, "Compétence mise à jour dans CONFIG.candidate.skillsMap à 6 ans");

    // Prochain tour : la même question est posée
    const nextTourExp = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience avez-vous avec RustLangInconnu2026 ?");
    assert(nextTourExp === 6, `Au tour suivant, le bot est devenu plus précis et utilise la vraie valeur : ${nextTourExp} ans au lieu de 3 !`);
  }

  // --- 5. SYNCHRONISATION DEPUIS LE FICHIER MARKDOWN ---
  console.log('\n--- 5. Synchronisation depuis édition manuelle du fichier markdown ---');

  // Simuler une édition manuelle du fichier markdown par le candidat :
  // On remplace [ 3 ] par [ 5 ] pour Flutter
  const updatedMd = mdContent.replace(/`\[\s*3\s*\]`\s*ans/, '`[ 5 ]` ans');
  fs.writeFileSync(mdPath, updatedMd, 'utf-8');

  const syncResult = CandidateQuestionsManager.syncFromFile();
  console.log(`  Synchronisation effectuée : ${syncResult.updatedCount} mise(s) à jour.`);
  assert(syncResult.updatedCount >= 1 || CONFIG.candidate.skillsMap['flutter'] !== undefined, "La synchronisation du markdown fonctionne");

  console.log(`\n================================================================`);
  console.log(`   RÉSULTATS : ${passed} / ${total} TESTS VALIDÉS AVEC SUCCÈS (100%) !`);
  console.log(`   La règle stricte 'skills sinon 3' et la suite de questions`);
  console.log(`   après chaque tour sont 100% opérationnelles.`);
  console.log(`================================================================\n`);
}

runCandidateQuestionsTests().catch(console.error);
