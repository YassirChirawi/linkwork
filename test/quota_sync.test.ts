import { CONFIG, saveUserConfig, loadUserConfig } from '../src/config.js';
import { EasyApplyModule } from '../src/modules/easyApply.js';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('   TEST : SYNCHRONISATION ET PRISE EN COMPTE DES QUOTAS');
console.log('================================================================\n');

// 1. Test modification quota via saveUserConfig
saveUserConfig({
  quotas: {
    maxEasyApplyPerSession: 35,
    maxNetworkingPerSession: 20,
    maxOutreachPerSession: 12,
  },
  helloWork: {
    quotas: {
      maxApplyPerSession: 28,
    },
  } as any,
});

if (CONFIG.quotas.maxEasyApplyPerSession === 35) {
  console.log('  ✔ [PASS] CONFIG.quotas.maxEasyApplyPerSession mis à jour à 35');
} else {
  console.error('  ✖ [FAIL] CONFIG.quotas.maxEasyApplyPerSession non mis à jour');
  process.exit(1);
}

if (CONFIG.helloWork.quotas.maxApplyPerSession === 28) {
  console.log('  ✔ [PASS] CONFIG.helloWork.quotas.maxApplyPerSession mis à jour à 28');
} else {
  console.error('  ✖ [FAIL] CONFIG.helloWork.quotas.maxApplyPerSession non mis à jour');
  process.exit(1);
}

// 2. Test persistance .env
const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
if (envContent.includes('MAX_EASY_APPLY=35') && envContent.includes('MAX_HELLOWORK_APPLY=28')) {
  console.log('  ✔ [PASS] Fichier .env synchronisé avec succès (MAX_EASY_APPLY=35, MAX_HELLOWORK_APPLY=28)');
} else {
  console.error('  ✖ [FAIL] Fichier .env non synchronisé');
  process.exit(1);
}

// 3. Test instanciation EasyApplyModule par défaut
const moduleDefault = new EasyApplyModule();
if ((moduleDefault as any).options.maxApply === 35) {
  console.log('  ✔ [PASS] EasyApplyModule prend bien en compte le quota sauvegardé (35)');
} else {
  console.error('  ✖ [FAIL] EasyApplyModule a ignoré le quota sauvegardé');
  process.exit(1);
}

// 4. Test instanciation EasyApplyModule avec quota dynamique explicite
const moduleCustom = new EasyApplyModule(undefined, { maxApply: 7 });
if ((moduleCustom as any).options.maxApply === 7) {
  console.log('  ✔ [PASS] EasyApplyModule applique immédiatement le quota dynamique par session (7)');
} else {
  console.error('  ✖ [FAIL] EasyApplyModule a ignoré le quota dynamique');
  process.exit(1);
}

// 5. Rétablir les valeurs par défaut
saveUserConfig({
  quotas: {
    maxEasyApplyPerSession: 15,
    maxNetworkingPerSession: 15,
    maxOutreachPerSession: 10,
  },
  helloWork: {
    quotas: {
      maxApplyPerSession: 15,
    },
  } as any,
});

console.log('\n================================================================');
console.log('   TOUS LES TESTS DE QUOTAS SONT 100% VALIDÉS !');
console.log('================================================================\n');
