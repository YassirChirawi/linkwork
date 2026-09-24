import { aiGenerator } from '../src/utils/aiGenerator.js';
import { CONFIG } from '../src/config.js';

async function runTests() {
  console.log('=== TEST 1 : BAYIIN PERSONA 1 (FONDATEURS & GÉRANTS D2C MAROC) ===');
  const persona1 = aiGenerator.detectPersona('Fondateur & CEO - Marque Cosmétique Bio D2C');
  console.log('Persona détecté :', persona1);
  if (persona1 !== 'd2c_founders') throw new Error(`Échec détection Persona 1, reçu : ${persona1}`);

  const pitch1 = aiGenerator.getPersonaPitch('d2c_founders', 'Kenza');
  console.log('Pitch 1 :', pitch1);
  console.log('Longueur note :', pitch1.length, 'caractères');
  if (pitch1.length > 290) throw new Error('Note Persona 1 > 290 caractères !');
  if (!pitch1.includes('Cathedis') || !pitch1.includes('AWB')) throw new Error('Note Persona 1 manque Cathedis/AWB !');

  console.log('\n=== TEST 2 : BAYIIN PERSONA 2 (RESPONSABLES E-COMMERCE & OPS) ===');
  const persona2 = aiGenerator.detectPersona('E-commerce Manager & Head of Supply Chain');
  console.log('Persona détecté :', persona2);
  if (persona2 !== 'ecom_ops_managers') throw new Error(`Échec détection Persona 2, reçu : ${persona2}`);

  const pitch2 = aiGenerator.getPersonaPitch('ecom_ops_managers', 'Amine');
  console.log('Pitch 2 :', pitch2);
  console.log('Longueur note :', pitch2.length, 'caractères');
  if (pitch2.length > 290) throw new Error('Note Persona 2 > 290 caractères !');
  if (!pitch2.includes('O-Livraison') || !pitch2.includes('retours COD')) throw new Error('Note Persona 2 manque transporteurs/retours !');

  console.log('\n=== TEST 3 : BAYIIN PERSONA 3 (AGENCES GROWTH & MEDIA BUYERS COD) ===');
  const persona3 = aiGenerator.detectPersona('Head of Acquisition & Media Buyer E-commerce COD');
  console.log('Persona détecté :', persona3);
  if (persona3 !== 'growth_agencies') throw new Error(`Échec détection Persona 3, reçu : ${persona3}`);

  const pitch3 = aiGenerator.getPersonaPitch('growth_agencies', 'Yassine');
  console.log('Pitch 3 :', pitch3);
  console.log('Longueur note :', pitch3.length, 'caractères');
  if (pitch3.length > 290) throw new Error('Note Persona 3 > 290 caractères !');
  if (!pitch3.includes('ROAS') || !pitch3.includes('marge nette réelle')) throw new Error('Note Persona 3 manque ROAS/marge nette !');

  console.log('\n=== TEST 4 : REQUÊTE BOOLÉENNE BAYIIN LINKEDIN ===');
  console.log('Requête configurée :', CONFIG.outreach.booleanSearchQuery);
  if (!CONFIG.outreach.booleanSearchQuery.includes('Maroc') || !CONFIG.outreach.booleanSearchQuery.includes('Fondateur')) {
    throw new Error('Requête booléenne invalide !');
  }

  console.log('\n=== TEST 5 : CONTEXTE RECRUTEMENT JOB HUNTING & ANTI-STAGE ===');
  const resJob = await aiGenerator.generateContent({
    postText: 'Nous recrutons un Lead Developer Java Spring Boot & React microservices.',
    authorName: 'Claire Dupond',
    authorHeadline: 'Talent Acquisition Tech',
    context: 'job_hunting',
  });
  console.log('Note recrutement :', resJob.inviteNote);
  if (resJob.inviteNote.length > 290) throw new Error('Note recrutement > 290 caractères !');

  const testOffers = [
    { title: 'Stage - Développeur Web Full Stack', expected: false },
    { title: 'Alternance Développeur Java Spring Boot', expected: false },
    { title: 'Ingénieur Full Stack Java React (H/F)', expected: true },
    { title: 'Senior Software Engineer TypeScript Node.js', expected: true },
    { title: 'Stagiaire Data Analyst', expected: false },
  ];

  for (const offer of testOffers) {
    const lower = offer.title.toLowerCase();
    const isExcluded = CONFIG.jobSearch.excludedKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
    const passed = !isExcluded;
    console.log(`Offre "${offer.title}" -> ${passed ? '✔ ACCEPTÉE' : '✖ REJETÉE'}`);
    if (passed !== offer.expected) throw new Error(`Échec filtre pour: ${offer.title}`);
  }

  console.log('\n=== TEST 6 : MODULE HELLOWORK (ANTI-STAGE & INJECTION CANDIDAT) ===');
  const helloWorkOffers = [
    { title: 'Stage - Développeur Java Junior', expected: false },
    { title: 'Développeur Full Stack Java / React CDI (H/F)', expected: true },
    { title: 'Alternance Concepteur Développeur Web', expected: false },
    { title: 'Ingénieur d\'études Spring Boot & Angular CDI', expected: true }
  ];

  for (const offer of helloWorkOffers) {
    const lower = offer.title.toLowerCase();
    const isExcluded = CONFIG.jobSearch.excludedKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
    const passed = !isExcluded;
    console.log(`HelloWork Offre "${offer.title}" -> ${passed ? '✔ QUALIFIÉE' : '✖ EXCLUE (Anti-stage)'}`);
    if (passed !== offer.expected) throw new Error(`Échec filtre HelloWork pour: ${offer.title}`);
  }

  if (!CONFIG.helloWork.searchUrl.includes('hellowork.com')) {
    throw new Error('URL HelloWork invalide');
  }
  console.log(`HelloWork Config vérifiée : URL = ${CONFIG.helloWork.searchUrl}, Quota = ${CONFIG.helloWork.quotas.maxApplyPerSession}`);

  console.log('\n✔ TOUS LES TESTS (6/6) SONT PASSÉS AVEC SUCCÈS !');
}

runTests().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
