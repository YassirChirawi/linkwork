import http from 'http';
import { CVExtractor } from '../src/utils/cvExtractor.js';
import { JobHunter } from '../src/utils/jobHunter.js';

async function runApiIntegrationTests() {
  console.log('================================================================');
  console.log('   TEST D\'INTÉGRATION END-TO-END : API CV & CHASSEUR D\'OFFRES');
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

  // 1. Test extraction et chargement du profil
  console.log('--- 1. Extraction et chargement du profil CV ---');
  const profile = await CVExtractor.extractFromConfiguredPath();
  assert(profile.skills.all.length >= 25, `Profil extrait avec ${profile.skills.all.length} compétences.`);
  assert(profile.topKeywords.length >= 5, `Mots-clés prioritaires identifiés (${profile.topKeywords.slice(0, 5).join(', ')})`);

  // 2. Test Chasseur d'offres
  console.log('\n--- 2. Chasseur d\'offres (JobHunter) ---');
  const huntResult = await JobHunter.huntTopOffers({
    query: profile.searchRecommendations.primaryTitleQuery,
    minScore: 50,
    limit: 6,
  });

  assert(huntResult.topMatchesCount >= 2, `Au moins 2 offres hautement qualifiées trouvées (total : ${huntResult.topMatchesCount})`);
  assert(huntResult.offers[0].score >= 80, `Meilleure offre notée >= 80% (obtenu : ${huntResult.offers[0].score}%)`);
  assert(huntResult.offers[0].matchGrade === 'A+' || huntResult.offers[0].matchGrade === 'A', `Grade d'excellence validé (${huntResult.offers[0].matchGrade})`);

  // 3. Test Simulation d'une offre personnalisée
  console.log('\n--- 3. Évaluation d\'une offre personnalisée ---');
  const customEval = JobHunter.evaluateCustomOffer(
    'Lead Développeur Full Stack Java Spring Boot / React',
    'Tech Global Luxe',
    'Architecture microservices, TypeScript, tests unitaires JUnit et agilité.'
  );

  assert(customEval.score >= 75, `Score offre sur-mesure >= 75% (obtenu : ${customEval.score}%)`);
  assert(customEval.matchedKeywords.length >= 3, `Technologies matchées détectées : ${customEval.matchedKeywords.join(', ')}`);
  assert(customEval.isMatch === true, 'Offre déclarée éligible');

  console.log(`\n================================================================`);
  console.log(`   RÉSULTATS : ${passed} / ${total} TESTS API VALIDÉS AVEC SUCCÈS (100%) !`);
  console.log(`================================================================\n`);
}

runApiIntegrationTests().catch(console.error);
