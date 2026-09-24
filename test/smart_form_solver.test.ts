import { SmartFormSolver } from '../src/utils/formSolver.js';
import { CONFIG } from '../src/config.js';

async function runSmartFormSolverTests() {
  console.log('================================================================');
  console.log('   TEST : CERVEAU INTELLIGENT DE RESOLUTION DES FORMULAIRES');
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

  // --- 1. QUESTIONS D'EXPÉRIENCE (ANNÉES) ---
  console.log('--- 1. Résolution des Questions d\'Années d\'Expérience ---');

  // A. Compétence connue exacte
  const expJava = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience avez-vous avec Java ?");
  assert(expJava === 4, `Expérience Java résolue : ${expJava} ans`);

  const expReact = SmartFormSolver.resolveYearsOfExperience("How many years of work experience do you have with React.js?");
  assert(expReact === 4, `Expérience React résolue : ${expReact} ans`);

  const expSpring = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience sur Spring Boot avez-vous ?");
  assert(expSpring === 3, `Expérience Spring Boot résolue : ${expSpring} ans`);

  // B. Compétence métier transverse / multi-domaines
  const expSupply = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience avez-vous en Supply Chain ?");
  assert(expSupply >= 2 && expSupply <= 5, `Expérience Supply Chain résolue : ${expSupply} ans`);

  const expAchats = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience avez-vous dans les Achats ?");
  assert(expAchats >= 2 && expAchats <= 5, `Expérience Achats résolue : ${expAchats} ans`);

  // C. Question d'expérience globale / totale
  const expGlobaleFr = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience professionnelle globale avez-vous ?");
  assert(expGlobaleFr === (CONFIG.candidate.experienceYears || 4), `Expérience globale FR résolue : ${expGlobaleFr} ans`);

  const expGlobalEn = SmartFormSolver.resolveYearsOfExperience("What is your total years of work experience?");
  assert(expGlobalEn === (CONFIG.candidate.experienceYears || 4), `Expérience globale EN résolue : ${expGlobalEn} ans`);

  // D. Outil inconnu ou technologie rare (NE DOIT JAMAIS METTRE 0 NI BLOQUER)
  const expInconnu = SmartFormSolver.resolveYearsOfExperience("Combien d'années d'expérience avez-vous avec OutilUltraRare2026 ?");
  assert(expInconnu >= 2 && expInconnu <= 5, `Outil rare résolu avec valeur réaliste et positive : ${expInconnu} ans (Jamais 0 !)`);

  // --- 2. ANALYSE DE POLARITÉ DES QUESTIONS OUI / NON ---
  console.log('\n--- 2. Détection de Polarité des Questions Oui / Non ---');

  // A. Questions où la réponse attendue est OUI (favorable)
  assert(SmartFormSolver.isPositivePolarityQuestion("Avez-vous le droit de travailler légalement en France ?"), 'Autorisation de travail en France -> Polarité OUI');
  assert(SmartFormSolver.isPositivePolarityQuestion("Are you legally authorized to work in the country of this job?"), 'Authorized to work -> Polarité OUI');
  assert(SmartFormSolver.isPositivePolarityQuestion("Possédez-vous un permis de conduire valide (Permis B) ?"), 'Permis de conduire -> Polarité OUI');
  assert(SmartFormSolver.isPositivePolarityQuestion("Êtes-vous disposé(e) à vous rendre sur le lieu de travail / faire le trajet vers Paris ?"), 'Commute / trajet -> Polarité OUI');
  assert(SmartFormSolver.isPositivePolarityQuestion("Acceptez-vous un rythme hybride avec 2 jours de télétravail ?"), 'Rythme hybride -> Polarité OUI');
  assert(SmartFormSolver.isPositivePolarityQuestion("Avez-vous un diplôme de niveau Master / Bac+5 ?"), 'Diplôme Master -> Polarité OUI');
  assert(SmartFormSolver.isPositivePolarityQuestion("Acceptez-vous une vérification de références / background check ?"), 'Background check -> Polarité OUI');
  assert(SmartFormSolver.isPositivePolarityQuestion("Êtes-vous disponible immédiatement ou sous un préavis court ?"), 'Disponibilité -> Polarité OUI');

  // B. Questions où la réponse attendue est NON (négative)
  assert(SmartFormSolver.isNegativePolarityQuestion("Aurez-vous besoin d'un visa ou d'un parrainage / sponsorship ?"), 'Besoin de visa sponsorship -> Polarité NON');
  assert(SmartFormSolver.isNegativePolarityQuestion("Will you now or in the future require visa sponsorship?"), 'Require sponsorship -> Polarité NON');
  assert(SmartFormSolver.isNegativePolarityQuestion("Avez-vous déjà fait l'objet d'une condamnation inscrite au casier judiciaire ?"), 'Casier judiciaire -> Polarité NON');
  assert(SmartFormSolver.isNegativePolarityQuestion("Êtes-vous lié(e) par une clause de non-concurrence en vigueur ?"), 'Non-concurrence -> Polarité NON');

  // --- 3. RECHERCHE DE COMPÉTENCES AVEC SYNONYMES & CV ---
  console.log('\n--- 3. Détection de Compétences et Synonymes Avancés ---');
  const skillJs = SmartFormSolver.findMatchingSkill("connaissance de js et de ts");
  assert(skillJs !== null && skillJs.years >= 3, `Synonyme 'js' détecté : ${skillJs?.name} (${skillJs?.years} ans)`);

  const skillK8s = SmartFormSolver.findMatchingSkill("maîtrise de k8s en production");
  assert(skillK8s !== null && skillK8s.name === 'docker', `Synonyme 'k8s' résolu vers Docker : ${skillK8s?.years} ans`);

  const skillCicd = SmartFormSolver.findMatchingSkill("pratique de la ci/cd");
  assert(skillCicd !== null && skillCicd.years >= 3, `Synonyme 'ci/cd' résolu : ${skillCicd?.years} ans`);

  console.log(`\n================================================================`);
  console.log(`   RÉSULTATS : ${passed} / ${total} TESTS VALIDÉS AVEC SUCCÈS (100%) !`);
  console.log(`   Le SmartFormSolver répond intelligemment à toutes les questions.`);
  console.log(`================================================================\n`);
}

runSmartFormSolverTests().catch(console.error);
