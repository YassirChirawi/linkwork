import { CVExtractor } from '../src/utils/cvExtractor.js';
import path from 'path';

async function testExtractor() {
  console.log('--- TEST EXTRACTION DU CV REEL ---');
  const cvPath = path.resolve('assets/CV_Yassir_Chirawi.pdf');
  const profile = await CVExtractor.extractFromConfiguredPath(cvPath);

  console.log('✅ Candidat extrait :', profile.candidate.fullName);
  console.log('✅ Titre détecté    :', profile.candidate.title);
  console.log('✅ Email            :', profile.candidate.email);
  console.log('✅ Téléphone        :', profile.candidate.phone);
  console.log('✅ Expérience (ans) :', profile.candidate.experienceYears);
  console.log('✅ Diplôme          :', profile.candidate.degree);
  console.log('✅ Total Skills     :', profile.skills.all.length);
  console.log('✅ Top 10 Keywords  :', profile.topKeywords.slice(0, 10));
  console.log('✅ Requête Chasse 1 :', profile.searchRecommendations.primaryTitleQuery);
  console.log('✅ Requête HelloWork:', profile.searchRecommendations.helloWorkQuery);
  console.log('✅ Requête LinkedIn :', profile.searchRecommendations.booleanQueryLinkedIn);

  console.log('\n--- COMPÉTENCES PAR CATÉGORIES ---');
  for (const [cat, list] of Object.entries(profile.skills.categorized)) {
    if (list.length > 0) {
      console.log(`  [${cat}] : ${list.join(', ')}`);
    }
  }

  console.log('\n--- PITCH CANDIDAT EXTRAIT ---');
  console.log(profile.candidate.summaryPitch.substring(0, 200) + '...');
}

testExtractor().catch(console.error);
