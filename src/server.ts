import http from 'http';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { CONFIG, saveUserConfig } from './config.js';
import { historyManager } from './utils/history.js';
import { authenticateInteractive, authenticateHelloWorkInteractive } from './auth.js';
import { EasyApplyModule } from './modules/easyApply.js';
import { NetworkingModule } from './modules/networking.js';
import { OutreachModule } from './modules/outreach.js';
import { HelloWorkModule } from './modules/helloWork.js';
import { HumanSimulationModule } from './modules/humanSimulation.js';

import { logEmitter } from './utils/events.js';
import { resolvePendingSemiAuto } from './utils/cli.js';
import { CVExtractor } from './utils/cvExtractor.js';
import { JobHunter } from './utils/jobHunter.js';

export const serverEmitter = new EventEmitter();

// Instance active pour arrêt d'urgence
let activeSimulationInstance: HumanSimulationModule | null = null;

// Diffusion de logs vers SSE
export function broadcastLog(type: 'info' | 'success' | 'warn' | 'error' | 'system' | 'human', message: string) {
  logEmitter.emit('log', {
    time: new Date().toLocaleTimeString(),
    type,
    message,
  });
}

export function isHelloWorkSessionValid(storagePath: string): boolean {
  try {
    if (!fs.existsSync(storagePath)) return false;
    const content = fs.readFileSync(storagePath, 'utf-8');
    const data = JSON.parse(content);
    // Dans localStorage HelloWork, _hw_t.s === true indique une session active
    const originHw = data.origins?.find((o: any) => o.origin?.includes('hellowork.com'));
    const hwT = originHw?.localStorage?.find((item: any) => item.name === '_hw_t');
    if (hwT) {
      try {
        const parsed = JSON.parse(hwT.value);
        if (parsed && parsed.s === false) return false;
        if (parsed && parsed.s === true) return true;
      } catch {}
    }
    // Présence de cookies HelloWork cohérents
    return Array.isArray(data.cookies) && data.cookies.length > 5;
  } catch {
    return false;
  }
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DASHBOARD_DIR = path.resolve(process.cwd(), 'dashboard');

// Types MIME pour les fichiers statiques
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Ensemble des clients SSE connectés
const sseClients = new Set<http.ServerResponse>();

logEmitter.on('log', (data) => {
  const payload = `event: log\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => res.write(payload));
});

logEmitter.on('simulation_progress', (data) => {
  const payload = `event: simulation_progress\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => res.write(payload));
});

historyManager.on('action_logged', (record) => {
  const payload = `event: action\ndata: ${JSON.stringify(record)}\n\n`;
  sseClients.forEach((res) => res.write(payload));
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // En-têtes CORS pour le dev local
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ==================== ROUTES API ====================

  // 1. Flux SSE (Server-Sent Events)
  if (pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': sse connected\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. Statut général
  if (pathname === '/api/status' && req.method === 'GET') {
    const hasSession = fs.existsSync(CONFIG.sessionStoragePath);
    const hasHelloWorkSession = isHelloWorkSessionValid(CONFIG.helloWorkSessionStoragePath);
    const hasResume = fs.existsSync(path.resolve(CONFIG.candidate.resumePath));
    const history = historyManager.getHistory(5);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        hasSession,
        sessionPath: CONFIG.sessionStoragePath,
        hasHelloWorkSession,
        helloWorkSessionPath: CONFIG.helloWorkSessionStoragePath,
        hasResume,
        resumePath: CONFIG.candidate.resumePath,
        account: {
          email: CONFIG.candidate.email,
          name: `${CONFIG.candidate.firstName} ${CONFIG.candidate.lastName}`,
          city: CONFIG.candidate.city,
          experienceYears: CONFIG.candidate.experienceYears,
          salaryExpectation: CONFIG.candidate.salaryExpectation,
          highestDegree: CONFIG.candidate.education.highestDegree,
          skillsCount: Object.keys(CONFIG.candidate.skillsMap).length,
        },
        quotas: CONFIG.quotas,
        headless: CONFIG.headless,
        autoMode: CONFIG.autoMode,
        minMatchScore: CONFIG.minMatchScore,
        hasGeminiKey: !!CONFIG.geminiApiKey,
        bayiin: {
          product: CONFIG.outreach.product,
          targetPersonas: CONFIG.outreach.targetPersonas,
          booleanSearchQuery: CONFIG.outreach.booleanSearchQuery,
          hashtags: CONFIG.outreach.hashtags,
        },
        helloWork: CONFIG.helloWork,
        recentActions: history,
      })
    );
    return;
  }

  // 3. Historique des actions
  if (pathname === '/api/history' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(historyManager.getHistory(200)));
    return;
  }

  if (pathname === '/api/history' && req.method === 'DELETE') {
    historyManager.clearHistory();
    broadcastLog('info', 'Historique des actions réinitialisé.');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 3.5 Configuration dynamique & persistante
  if (pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        autoMode: CONFIG.autoMode,
        minMatchScore: CONFIG.minMatchScore,
        hasGeminiKey: !!CONFIG.geminiApiKey,
        geminiApiKey: CONFIG.geminiApiKey ? '••••••••••••••••' : '',
        candidate: CONFIG.candidate,
        quotas: CONFIG.quotas,
        jobSearch: CONFIG.jobSearch,
        helloWork: CONFIG.helloWork,
        networking: CONFIG.networking,
      })
    );
    return;
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const overrides = JSON.parse(body || '{}');
        // Ne pas écraser la clé si elle est masquée
        if (overrides.geminiApiKey && overrides.geminiApiKey.includes('••••')) {
          delete overrides.geminiApiKey;
        }
        saveUserConfig(overrides);
        broadcastLog('success', 'Configuration mise à jour et sauvegardée avec succès !');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            message: 'Configuration enregistrée',
            config: {
              autoMode: CONFIG.autoMode,
              minMatchScore: CONFIG.minMatchScore,
              hasGeminiKey: !!CONFIG.geminiApiKey,
              candidate: CONFIG.candidate,
              quotas: CONFIG.quotas,
              jobSearch: CONFIG.jobSearch,
              helloWork: CONFIG.helloWork,
              networking: CONFIG.networking,
            },
          })
        );
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  // 3.8 Résolution d'intervention semi-automatique depuis le Dashboard
  if (pathname === '/api/semi-auto' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const decision = payload.decision || 'resume';
        const resolved = resolvePendingSemiAuto(decision);
        broadcastLog('info', `Décision Semi-Auto reçue du Dashboard : "${decision}" (appliquée : ${resolved})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, decision, resolved }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  // ==================== 3.9 INTELLIGENCE CV & CHASSEUR D'OFFRES ====================

  // A. Consultation du profil CV extrait
  if (pathname === '/api/cv/profile' && req.method === 'GET') {
    const resumePath = path.resolve(CONFIG.candidate.resumePath);
    const hasResume = fs.existsSync(resumePath);
    const savedProfile = CVExtractor.loadSavedProfile();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        hasResume,
        resumePath: CONFIG.candidate.resumePath,
        resumeFileName: path.basename(CONFIG.candidate.resumePath),
        profile: savedProfile,
      })
    );
    return;
  }

  // B. Déclenchement de l'analyse et extraction du CV
  if (pathname === '/api/cv/extract' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const targetPath = payload.path || CONFIG.candidate.resumePath;

        broadcastLog('system', `Analyse et extraction sémantique du CV : ${path.basename(targetPath)}...`);
        const profile = await CVExtractor.extractFromConfiguredPath(targetPath);

        broadcastLog(
          'success',
          `CV extrait avec succès ! ${profile.skills.all.length} compétences détectées, profil candidat qualifié.`
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, profile }));
      } catch (err) {
        broadcastLog('error', `Erreur extraction CV : ${(err as Error).message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  // C. Téléversement d'un nouveau CV (PDF ou Texte)
  if (pathname === '/api/cv/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const filename = payload.filename || `CV_${Date.now()}.pdf`;
        const base64Data = payload.base64;

        if (!base64Data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Données base64 manquantes.' }));
          return;
        }

        const assetsDir = path.resolve(process.cwd(), 'assets');
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

        const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const targetPath = path.join(assetsDir, filename);

        fs.writeFileSync(targetPath, buffer);
        CONFIG.candidate.resumePath = targetPath;
        saveUserConfig({ candidate: { resumePath: targetPath } as any });

        broadcastLog('info', `Nouveau fichier CV sauvegardé : ${filename}`);
        const profile = await CVExtractor.extractFromBuffer(buffer, filename);

        broadcastLog('success', `Nouveau CV analysé : ${profile.skills.all.length} compétences extraites !`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filename, targetPath, profile }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  // D. Application des mots-clés et données du CV au profil Orchestrator
  if (pathname === '/api/cv/apply-to-config' && req.method === 'POST') {
    try {
      const profile = CVExtractor.loadSavedProfile();
      if (!profile) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Aucun profil CV analysé. Veuillez d\'abord extraire un CV.' }));
        return;
      }

      // Synchronisation intelligente de la configuration
      const candidateOverrides: any = {
        skillsMap: { ...CONFIG.candidate.skillsMap, ...profile.skills.skillsMap },
      };

      if (profile.candidate.summaryPitch) {
        candidateOverrides.summaryPitch = profile.candidate.summaryPitch;
      }
      if (profile.candidate.firstName && profile.candidate.firstName !== 'Yassir') {
        candidateOverrides.firstName = profile.candidate.firstName;
      }
      if (profile.candidate.lastName && profile.candidate.lastName !== 'CHIRAWI') {
        candidateOverrides.lastName = profile.candidate.lastName;
      }
      if (profile.candidate.degree) {
        candidateOverrides.education = {
          highestDegree: profile.candidate.degree,
          school: profile.candidate.school || CONFIG.candidate.education.school,
        };
      }
      if (profile.candidate.experienceYears) {
        candidateOverrides.experienceYears = profile.candidate.experienceYears;
      }

      const jobSearchOverrides: any = {
        keywords: profile.searchRecommendations.primaryTitleQuery,
        requiredKeywords: profile.searchRecommendations.requiredKeywords,
        excludedKeywords: profile.searchRecommendations.excludedKeywords,
      };

      const helloWorkOverrides: any = {
        keywords: profile.searchRecommendations.helloWorkQuery,
      };

      saveUserConfig({
        candidate: candidateOverrides,
        jobSearch: jobSearchOverrides,
        helloWork: helloWorkOverrides,
      });

      broadcastLog(
        'success',
        `Profil Orchestrator synchronisé avec le CV : ${Object.keys(candidateOverrides.skillsMap).length} compétences injectées, requêtes mises à jour !`
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: 'Profil, compétences et requêtes de recherche synchronisés avec succès.',
          updatedKeywords: {
            linkedin: CONFIG.jobSearch.keywords,
            helloWork: CONFIG.helloWork.keywords,
            skillsCount: Object.keys(CONFIG.candidate.skillsMap).length,
          },
        })
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return;
  }

  // E. Simulation / Évaluation d'une offre unitaire contre le CV
  if (pathname === '/api/cv/score-job' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const title = payload.title || '';
        const company = payload.company || '';
        const description = payload.description || '';

        if (!title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Le titre de l\'offre est obligatoire.' }));
          return;
        }

        const evaluation = JobHunter.evaluateCustomOffer(title, company, description);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, evaluation }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  // F. Chasseur des Meilleures Offres (Top Matches Hunter)
  if (pathname === '/api/cv/hunt-jobs' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        broadcastLog('system', `Chasse des meilleures offres en cours pour : "${payload.query || CONFIG.jobSearch.keywords}"...`);

        const huntResult = await JobHunter.huntTopOffers(payload);

        broadcastLog(
          'success',
          `Chasse terminée : ${huntResult.topMatchesCount} offres hautement qualifiées sélectionnées (Top Score: ${huntResult.offers[0]?.score || 0}%).`
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...huntResult }));
      } catch (err) {
        broadcastLog('error', `Erreur chasse aux offres : ${(err as Error).message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  // 4. Authentification manuelle via interface (LinkedIn ou HelloWork)
  if (pathname === '/api/auth' && req.method === 'POST') {
    const platform = url.searchParams.get('platform') || 'linkedin';

    if (platform === 'hellowork') {
      broadcastLog('system', 'Lancement de l\'authentification interactive HelloWork Chromium...');
      authenticateHelloWorkInteractive({ autoDetectOnly: true })
        .then(() => {
          broadcastLog('success', 'Authentification HelloWork réussie et session sauvegardée !');
        })
        .catch((err) => {
          broadcastLog('error', `Échec d'authentification HelloWork : ${(err as Error).message}`);
        });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: 'Fenêtre de connexion HelloWork ouverte. Connectez-vous sur Chromium pour valider la session.',
          platform: 'hellowork',
          status: 'pending',
        })
      );
      return;
    }

    broadcastLog('system', 'Lancement de l\'authentification interactive LinkedIn Chromium...');
    // Exécution asynchrone non-bloquante
    authenticateInteractive({ autoDetectOnly: true })
      .then(() => {
        broadcastLog('success', 'Authentification réussie et session sauvegardée !');
      })
      .catch((err) => {
        broadcastLog('error', `Échec d'authentification : ${(err as Error).message}`);
      });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        message: 'Fenêtre de connexion ouverte. Connectez-vous sur Chromium pour valider la session.',
        platform: 'linkedin',
        status: 'pending',
      })
    );
    return;
  }

  // 5. Lancement d'un module du bot
  if (pathname === '/api/run' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const moduleType = payload.module || 'easyApply';

        // Validation de session selon la plateforme
        if (moduleType === 'helloWork') {
          if (!isHelloWorkSessionValid(CONFIG.helloWorkSessionStoragePath)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Aucune session HelloWork valide trouvée. Veuillez d\'abord vous connecter à HelloWork via le bouton "Connecter HelloWork".',
              })
            );
            return;
          }

          broadcastLog('system', 'Lancement du module : HELLOWORK');
          new HelloWorkModule(undefined, payload.options).run().catch((err) => {
            broadcastLog('error', `Erreur HelloWork : ${(err as Error).message}`);
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, module: 'helloWork' }));
          return;
        }

        // Modules LinkedIn
        if (!fs.existsSync(CONFIG.sessionStoragePath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Aucune session state.json trouvée. Veuillez d\'abord vous connecter.' }));
          return;
        }

        broadcastLog('system', `Lancement du module : ${moduleType.toUpperCase()}`);

        // Lancement en arrière-plan selon le module sélectionné
        if (moduleType === 'easyApply') {
          new EasyApplyModule().run().catch((err) => {
            broadcastLog('error', `Erreur Easy Apply : ${(err as Error).message}`);
          });
        } else if (moduleType === 'networking') {
          const netHelper = new NetworkingModule(undefined, {
            targetCategory: payload.targetCategory || payload.options?.targetCategory || 'general',
            customQuery: payload.customQuery || payload.options?.customQuery,
            withNote: payload.withNote !== undefined ? payload.withNote : true,
          });
          netHelper.run().catch((err) => {
            broadcastLog('error', `Erreur Réseautage : ${(err as Error).message}`);
          });
        } else if (moduleType === 'outreach') {
          const outreach = new OutreachModule(undefined, {
            mode: payload.mode || 'postsSearch',
            personaId: payload.personaId || 'all',
            topicId: payload.topicId || 'all',
            booleanQuery: payload.booleanQuery,
            hashtags: payload.hashtags,
            postQuery: payload.postQuery,
          });
          outreach.run().catch((err) => {
            broadcastLog('error', `Erreur Outreach BayIIn : ${(err as Error).message}`);
          });
        } else if (moduleType === 'humanSimulation') {
          broadcastLog('system', 'Lancement de la simulation humaine & warm-up (navigation naturelle)...');
          activeSimulationInstance = new HumanSimulationModule(undefined, payload.options);
          activeSimulationInstance
            .run()
            .catch((err) => {
              broadcastLog('error', `Erreur Simulation Humaine : ${(err as Error).message}`);
            })
            .finally(() => {
              activeSimulationInstance = null;
            });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, module: moduleType }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  // 6. Arrêt d'urgence ou interruption de module en cours
  if (pathname === '/api/run/stop' && req.method === 'POST') {
    if (activeSimulationInstance) {
      activeSimulationInstance.stop();
      broadcastLog('warn', 'Signal d\'arrêt envoyé à la simulation humaine.');
      activeSimulationInstance = null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Simulation humaine arrêtée.' }));
      return;
    }
    broadcastLog('info', 'Demande d\'arrêt reçue.');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Aucun module continu actif.' }));
    return;
  }

  // ==================== FICHIERS STATIQUES (DASHBOARD) ====================
  let filePath = path.join(DASHBOARD_DIR, pathname === '/' ? 'index.html' : pathname);

  // Sécurité traversée de dossier
  if (!filePath.startsWith(DASHBOARD_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Fallback sur index.html pour SPA
    const indexPath = path.join(DASHBOARD_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Fichier non trouvé');
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Serveur Dashboard LinkedIn Orchestrator démarré sur : http://localhost:${PORT}`);
  console.log(`   - Compte configuré : ${CONFIG.candidate.email} (${CONFIG.candidate.firstName} ${CONFIG.candidate.lastName})`);
  console.log(`   - Session : ${fs.existsSync(CONFIG.sessionStoragePath) ? '✔ Valide' : '✖ En attente de connexion'}\n`);
});
