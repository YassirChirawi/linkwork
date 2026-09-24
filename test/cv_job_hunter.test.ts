import { CVExtractor } from '../src/utils/cvExtractor.js';
import { JobScorer } from '../src/utils/jobScorer.js';
import { JobHunter } from '../src/utils/jobHunter.js';
import path from 'path';

async function runCVAndHunterTests() {
  console.log('================================================================');
  console.log('   TEST : EXTRACTION CV, ATS SCORING & CHASSEUR DE MEILLEURES OFFRES');
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

  // --- 1. EXTRACTION DU CV ---
  console.log('--- 1. Extraction et Analyse Sémantique du CV ---');
  const cvPath = path.resolve('assets/CV_Yassir_Chirawi.pdf');
  const profile = await CVExtractor.extractFromConfiguredPath(cvPath);

  assert(profile.candidate.fullName.includes('CHIRAWI'), `Nom candidat extrait : ${profile.candidate.fullName}`);
  assert(profile.candidate.email === 'yasschirawill@gmail.com', `Email candidat vérifié : ${profile.candidate.email}`);
  assert(profile.skills.all.length >= 25, `Au moins 25 compétences détectées (total: ${profile.skills.all.length})`);
  assert(profile.skills.all.includes('java'), 'Java présent dans les compétences');
  assert(profile.skills.all.includes('spring boot'), 'Spring Boot présent dans les compétences');
  assert(profile.skills.all.includes('react'), 'React présent dans les compétences');
  assert(profile.skills.all.includes('typescript'), 'TypeScript présent dans les compétences');
  assert(profile.searchRecommendations.primaryTitleQuery.length > 10, `Requête recommandée générée : "${profile.searchRecommendations.primaryTitleQuery}"`);

  // --- 2. SCORING ATS D'OFFRES D'EMPLOI AVEC LE PROFIL CV ---
  console.log('\n--- 2. Qualification ATS d\'Offres contre le CV ---');

  // Offre 1 : Top Match BNP Paribas
  const eval1 = JobScorer.evaluateJob(
    'Ingénieur d’études Full Stack Java Spring Boot / React (H/F)',
    'BNP Paribas Securities Services',
    'Conception microservices Spring Boot, interface React TypeScript, sécurité Fortify et base MySQL.',
    profile
  );
  assert(eval1.isMatch === true, `Offre BNP qualifiée (Score: ${eval1.score}/100)`);
  assert(eval1.score >= 85, `Score BNP >= 85% pour l'offre idéale (obtenu: ${eval1.score})`);
  assert(eval1.matchGrade === 'A+', `Grade A+ obtenu pour l'offre idéale (${eval1.matchGrade})`);
  assert(eval1.matchedKeywords.length >= 3, `Mots-clés matchés : ${eval1.matchedKeywords.join(', ')}`);

  // Offre 2 : Rejet Stage
  const evalStage = JobScorer.evaluateJob(
    'Stage Développeur Java React (6 mois)',
    'Startup',
    'Recherche stagiaire.',
    profile
  );
  assert(evalStage.isMatch === false && evalStage.score === 0, `Stage immédiatement éliminé (Score: ${evalStage.score})`);

  // Offre 3 : Stack PHP sans Java ni React
  const evalPhp = JobScorer.evaluateJob(
    'Développeur PHP Symfony / WordPress',
    'Agence Web',
    'Maintenance de sites web vitrines.',
    profile
  );
  assert(evalPhp.isMatch === false && evalPhp.score <= 10, `Offre PHP disqualifiée (Score: ${evalPhp.score}/100)`);

  // --- 3. CHASSEUR ET CLASSEMENT DES MEILLEURES OFFRES (JobHunter) ---
  console.log('\n--- 3. Classement & Tirage des Meilleures Offres (JobHunter) ---');
  const huntResults = await JobHunter.huntTopOffers({ minScore: 50, limit: 5 });

  assert(huntResults.offers.length >= 3, `Au moins 3 offres qualifiées trouvées (total: ${huntResults.offers.length})`);
  assert(huntResults.offers[0].rank === 1, 'Première offre au rang 1');
  assert(huntResults.offers[0].score >= huntResults.offers[1].score, `Tri décroissant validé : #${huntResults.offers[0].rank} (${huntResults.offers[0].score}%) >= #${huntResults.offers[1].rank} (${huntResults.offers[1].score}%)`);

  console.log(`\n  🏆 TOP OFFRE DU MARCHÉ SÉLECTIONNÉE :`);
  console.log(`     - Titre   : ${huntResults.offers[0].title}`);
  console.log(`     - Entreprise : ${huntResults.offers[0].company}`);
  console.log(`     - Score   : ${huntResults.offers[0].score}% (Grade ${huntResults.offers[0].matchGrade})`);
  console.log(`     - Conseils: ${huntResults.offers[0].recommendation}`);
  console.log(`     - Matchs  : ${huntResults.offers[0].matchedKeywords.join(', ')}`);

  // --- 4. ÉVALUATION UNITAIRE PERSONNALISÉE ---
  console.log('\n--- 4. Évaluation Interactive Immédiate ---');
  const customEval = JobHunter.evaluateCustomOffer(
    'Architecte Technique Java Spring Cloud & React',
    'Tech Leader Paris',
    'Encadrement équipe, microservices, cloud Docker, React Query.'
  );
  assert(customEval.score >= 70, `Offre personnalisée correctement notée (${customEval.score}%)`);

  console.log(`\n================================================================`);
  console.log(`   RÉSULTATS : ${passed} / ${total} TESTS VALIDÉS AVEC SUCCÈS (100%) !`);
  console.log(`   L'extraction CV et le Chasseur d'Offres fonctionnent parfaitement.`);
  console.log(`================================================================\n`);
}

runCVAndHunterTests().catch(console.error);
