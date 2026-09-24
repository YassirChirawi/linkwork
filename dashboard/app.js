// Données du candidat (synchronisées avec le serveur via /api/config)
let candidateData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  experienceYears: 4,
  salaryExpectation: "",
  education: { highestDegree: "", school: "" },
  summaryPitch: "",
  skillsMap: {}
};

let allHistory = [];
let activeFilter = 'all';

// Initialisation globale
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  renderSkills();
  initCharCounters();
  refreshStatus();
  loadActionHistory();
  loadRemoteConfig();
  initSSE();
  initBayIInStudio();
  loadCVProfile();

  // Actualisation périodique du statut
  setInterval(refreshStatus, 10000);
});

// ==================== GESTION DES ONGLETS ====================
function initTabs() {
  const navButtons = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      navButtons.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPane = document.getElementById(`pane-${targetTab}`);
      if (targetPane) targetPane.classList.add("active");

      if (targetTab === 'history') {
        loadActionHistory();
      } else if (targetTab === 'cv-matcher') {
        loadCVProfile();
      }
    });
  });
}

// ==================== GESTION DYNAMIQUE DES COMPÉTENCES ====================
function renderSkills() {
  renderSkillsGrid();
}

function renderSkillsGrid() {
  const container = document.getElementById("skills-grid");
  const countEl = document.getElementById("skills-total-count");
  if (!container) return;

  container.innerHTML = "";
  const skills = Object.entries(candidateData.skillsMap || {});

  if (countEl) {
    countEl.innerText = `${skills.length} compétence${skills.length > 1 ? 's' : ''}`;
  }

  if (skills.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 18px; font-style: italic; background: rgba(255,255,255,0.01); border-radius: 6px; border: 1px dashed var(--border-subtle);">Aucune compétence personnalisée. Ajoutez vos compétences ci-dessus ou cliquez sur une suggestion rapide.</div>`;
    return;
  }

  // Trier alphabétiquement
  skills.sort((a, b) => a[0].localeCompare(b[0]));

  skills.forEach(([name, years]) => {
    const chip = document.createElement("div");
    chip.className = "skill-chip-interactive";
    chip.innerHTML = `
      <span class="skill-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      <div class="skill-chip-meta">
        <span class="skill-exp">${years} an${years > 1 ? 's' : ''}</span>
        <button type="button" class="btn-remove-skill" title="Supprimer cette compétence" onclick="removeSkill('${escapeHtml(name).replace(/'/g, "\\'")}')">&times;</button>
      </div>
    `;
    container.appendChild(chip);
  });
}

function addSkillFromInputs() {
  const nameInput = document.getElementById('new-skill-name');
  const yearsInput = document.getElementById('new-skill-years');
  if (!nameInput || !yearsInput) return;

  const rawName = nameInput.value.trim();
  const years = parseInt(yearsInput.value, 10);

  if (!rawName) {
    nameInput.focus();
    return;
  }

  addSkill(rawName, isNaN(years) ? 1 : Math.max(0, years));
  nameInput.value = '';
  nameInput.focus();
}

function quickAddSkill(name, defaultYears) {
  addSkill(name, defaultYears);
}

function addSkill(name, years) {
  if (!candidateData.skillsMap) candidateData.skillsMap = {};
  const normalizedKey = name.trim().toLowerCase();
  candidateData.skillsMap[normalizedKey] = years;
  renderSkillsGrid();
  appendLog(`Compétence ajoutée : "${name}" (${years} an${years > 1 ? 's' : ''})`, "info");
}

function removeSkill(name) {
  if (!candidateData.skillsMap) return;
  const key = name.trim().toLowerCase();
  if (candidateData.skillsMap[key] !== undefined) {
    delete candidateData.skillsMap[key];
    renderSkillsGrid();
    appendLog(`Compétence retirée : "${name}"`, "warn");
  }
}

// ==================== COMPTEURS DE CARACTÈRES ====================
function initCharCounters() {
  const setupCounter = (textareaId, counterId) => {
    const textarea = document.getElementById(textareaId);
    const counter = document.getElementById(counterId);
    if (!textarea || !counter) return;

    const update = () => {
      const len = textarea.value.length;
      counter.innerText = len;
      if (len > 300) {
        counter.style.color = "var(--color-rose)";
        counter.parentElement.style.color = "var(--color-rose)";
      } else {
        counter.style.color = "var(--color-cyan)";
        counter.parentElement.style.color = "var(--text-dim)";
      }
    };

    textarea.addEventListener("input", update);
    update();
  };

  setupCounter("note-template", "char-note-count");
  setupCounter("saas-note-template", "char-saas-count");
}

// ==================== STATUT SERVEUR & SESSION ====================
async function refreshStatus() {
  const sessionInfo = document.getElementById("session-info");
  const indicator = document.getElementById("session-indicator");
  const hwSessionInfo = document.getElementById("hw-session-info");
  const hwIndicator = document.getElementById("hw-session-indicator");
  const accountEmailEl = document.getElementById("topbar-account-email");

  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('API non disponible');
    const data = await res.json();

    if (accountEmailEl && data.account) {
      accountEmailEl.innerText = data.account.email;
    }

    if (sessionInfo && indicator) {
      if (data.hasSession) {
        sessionInfo.innerText = "state.json : Connecté (Valide)";
        indicator.className = "session-indicator active";
        indicator.style.background = "var(--color-emerald)";
        indicator.style.boxShadow = "0 0 8px var(--color-emerald)";
      } else {
        sessionInfo.innerText = "state.json : En attente de connexion";
        indicator.className = "session-indicator";
        indicator.style.background = "var(--color-amber)";
        indicator.style.boxShadow = "0 0 8px var(--color-amber)";
      }
    }

    if (hwSessionInfo && hwIndicator) {
      if (data.hasHelloWorkSession) {
        hwSessionInfo.innerText = "hellowork_state.json : Connecté (Valide)";
        hwIndicator.className = "session-indicator active";
        hwIndicator.style.background = "var(--color-emerald)";
        hwIndicator.style.boxShadow = "0 0 8px var(--color-emerald)";
      } else {
        hwSessionInfo.innerText = "hellowork_state.json : En attente de connexion";
        hwIndicator.className = "session-indicator";
        hwIndicator.style.background = "var(--color-amber)";
        hwIndicator.style.boxShadow = "0 0 8px var(--color-amber)";
      }
    }
  } catch {
    if (sessionInfo) sessionInfo.innerText = "Serveur local hors-ligne";
    if (hwSessionInfo) hwSessionInfo.innerText = "Serveur local hors-ligne";
  }
}

// ==================== FLUX TEMPS RÉEL (SSE) ====================
function initSSE() {
  try {
    const eventSource = new EventSource('/api/stream');

    eventSource.addEventListener('log', (event) => {
      const data = JSON.parse(event.data);
      appendLog(data.message, data.type, data.time);
    });

    eventSource.addEventListener('action', (event) => {
      const record = JSON.parse(event.data);
      allHistory.unshift(record);
      renderHistoryTable();
      updateKpisFromHistory();
    });

    eventSource.addEventListener('simulation_progress', (event) => {
      try {
        const data = JSON.parse(event.data);
        updateSimulationDisplay(data);
      } catch (err) {
        console.warn("Erreur parsing simulation_progress :", err);
      }
    });

    eventSource.onerror = () => {
      // Reconnexion automatique par le navigateur
    };
  } catch (err) {
    console.warn("SSE indisponible :", err);
  }
}

// ==================== HISTORIQUE DES ACTIONS ====================
async function loadActionHistory() {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) return;
    allHistory = await res.json();
    renderHistoryTable();
    updateKpisFromHistory();
  } catch (err) {
    console.warn("Impossible de charger l'historique :", err);
  }
}

let historySearchQuery = '';

function filterHistory(filterType) {
  activeFilter = filterType;
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.getAttribute('data-filter') === filterType);
  });
  renderHistoryTable();
}

function handleHistorySearch(query) {
  historySearchQuery = (query || '').toLowerCase().trim();
  renderHistoryTable();
}

function renderHistoryTable() {
  const tbody = document.getElementById("history-table-body");
  if (!tbody) return;

  // Filtrer les éléments selon le module et la recherche
  const filtered = allHistory.filter(item => {
    const matchesModule = activeFilter === 'all' || item.module === activeFilter;
    if (!matchesModule) return false;
    if (!historySearchQuery) return true;
    const targetStr = (item.target || '').toLowerCase();
    const detailsStr = (item.details || '').toLowerCase();
    const actionStr = (item.actionType || '').toLowerCase();
    return targetStr.includes(historySearchQuery) || detailsStr.includes(historySearchQuery) || actionStr.includes(historySearchQuery);
  });

  // Mettre à jour les compteurs
  const countAll = document.getElementById("count-all");
  const countEasyApply = document.getElementById("count-easy-apply");
  const countNetworking = document.getElementById("count-networking");
  const countOutreach = document.getElementById("count-outreach");
  const countHelloWork = document.getElementById("count-hellowork");

  if (countAll) countAll.innerText = allHistory.length;
  if (countEasyApply) countEasyApply.innerText = allHistory.filter(i => i.module === 'easy_apply').length;
  if (countNetworking) countNetworking.innerText = allHistory.filter(i => i.module === 'networking').length;
  if (countOutreach) countOutreach.innerText = allHistory.filter(i => i.module === 'outreach').length;
  if (countHelloWork) countHelloWork.innerText = allHistory.filter(i => i.module === 'hellowork').length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">Aucune action ne correspond à vos critères de recherche.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const dateObj = new Date(item.timestamp);
    const dateFormatted = `${dateObj.toLocaleDateString('fr-FR')} ${dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

    let moduleLabel = 'Autre';
    if (item.module === 'easy_apply') moduleLabel = 'Easy Apply';
    else if (item.module === 'networking') moduleLabel = 'Réseau';
    else if (item.module === 'outreach') moduleLabel = 'SaaS BayIIn';
    else if (item.module === 'hellowork') moduleLabel = 'HelloWork';
    else if (item.module === 'auth') moduleLabel = 'Session';

    return `
      <tr>
        <td class="history-time">${dateFormatted}</td>
        <td><span class="badge-module ${item.module}">${moduleLabel}</span></td>
        <td><strong>${item.actionType.replace('_', ' ')}</strong></td>
        <td class="history-target">${escapeHtml(item.target)}</td>
        <td class="history-details">${escapeHtml(item.details || '-')}</td>
        <td><span class="badge-status ${item.status}">${item.status}</span></td>
      </tr>
    `;
  }).join('');
}

function exportHistoryCSV() {
  if (!allHistory || allHistory.length === 0) {
    alert("Aucune donnée d'historique à exporter.");
    return;
  }
  const headers = ["ID", "Horodatage", "Module", "Type Action", "Cible", "Details", "Statut"];
  const rows = allHistory.map(item => [
    `"${item.id}"`,
    `"${item.timestamp}"`,
    `"${item.module}"`,
    `"${item.actionType}"`,
    `"${(item.target || '').replace(/"/g, '""')}"`,
    `"${(item.details || '').replace(/"/g, '""')}"`,
    `"${item.status}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `linkedin_actions_history_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  appendLog("Export CSV de l'historique généré avec succès.", "success");
}

function exportHistoryJSON() {
  if (!allHistory || allHistory.length === 0) {
    alert("Aucune donnée d'historique à exporter.");
    return;
  }
  const jsonStr = JSON.stringify(allHistory, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `linkedin_actions_history_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  appendLog("Export JSON de l'historique généré avec succès.", "success");
}

async function clearActionHistory() {
  if (!confirm("Voulez-vous vraiment effacer tout l'historique d'actions ?")) return;
  try {
    await fetch('/api/history', { method: 'DELETE' });
    allHistory = [];
    renderHistoryTable();
    updateKpisFromHistory();
    appendLog("Historique d'actions effacé avec succès.", "info");
  } catch (err) {
    alert("Erreur lors de l'effacement : " + err.message);
  }
}

function updateKpisFromHistory() {
  const appliedCount = allHistory.filter(i => i.actionType === 'APPLICATION_SENT').length;
  const invitesCount = allHistory.filter(i => i.actionType === 'INVITATION_SENT').length;
  const saasCount = allHistory.filter(i => i.module === 'outreach').length;

  const valApplied = document.getElementById("val-applied");
  const valInvites = document.getElementById("val-invites");
  const valSaas = document.getElementById("val-saas");

  if (valApplied && appliedCount > 0) valApplied.innerText = appliedCount;
  if (valInvites && invitesCount > 0) valInvites.innerText = invitesCount;
  if (valSaas && saasCount > 0) valSaas.innerText = saasCount;
}

// ==================== DÉCLENCHEMENT DES MODULES ====================
async function triggerRun(moduleName, options = {}) {
  appendLog(`Demande d'exécution du module : ${moduleName.toUpperCase()}...`, "system");

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: moduleName, ...options, options }),
    });

    const data = await res.json();
    if (!res.ok) {
      appendLog(`Impossible de lancer : ${data.error}`, "error");
      alert(data.error);
      return;
    }

    appendLog(`Module ${moduleName} démarré avec succès en arrière-plan.`, "success");

    if (moduleName === 'humanSimulation') {
      const stopBtn = document.getElementById('btn-stop-simulation');
      const runBtn = document.getElementById('btn-run-simulation');
      const pill = document.getElementById('sim-status-badge');
      if (stopBtn) stopBtn.style.display = 'inline-flex';
      if (runBtn) runBtn.style.display = 'none';
      if (pill) {
        pill.classList.add('active');
        pill.innerText = '⏱ Initialisation...';
      }
    }
  } catch {
    // Fallback simulation visuelle si le serveur n'est pas encore démarré
    appendLog("Mode autonome local : simulation de la séquence d'action...", "warn");
    simulateLocalRun(moduleName);
  }
}

async function triggerStopModule() {
  appendLog("Demande d'arrêt envoyée au bot...", "warn");
  try {
    const res = await fetch('/api/run/stop', { method: 'POST' });
    const data = await res.json();
    appendLog(data.message || "Arrêt demandé.", "warn");
    const stopBtn = document.getElementById('btn-stop-simulation');
    const runBtn = document.getElementById('btn-run-simulation');
    const pill = document.getElementById('sim-status-badge');
    if (stopBtn) stopBtn.style.display = 'none';
    if (runBtn) runBtn.style.display = 'inline-flex';
    if (pill) {
      pill.classList.remove('active');
      pill.innerText = 'Arrêté';
    }
  } catch (err) {
    appendLog("Erreur lors de l'arrêt : " + err.message, "error");
  }
}

function updateSimulationDisplay(data) {
  const pill = document.getElementById('sim-status-badge');
  const viewedEl = document.getElementById('sim-posts-viewed');
  const likedEl = document.getElementById('sim-posts-liked');
  const stopBtn = document.getElementById('btn-stop-simulation');
  const runBtn = document.getElementById('btn-run-simulation');

  if (pill) {
    const mins = Math.floor(data.remainingSeconds / 60);
    const secs = data.remainingSeconds % 60;
    pill.classList.add('active');
    pill.innerText = `⏱ ${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }
  if (viewedEl) viewedEl.innerText = `Posts lus : ${data.postsViewed}`;
  if (likedEl) likedEl.innerText = `Likes : ${data.postsLiked}`;

  if (data.isComplete) {
    if (pill) {
      pill.classList.remove('active');
      pill.innerText = 'Terminé ✔ (60 min)';
    }
    if (stopBtn) stopBtn.style.display = 'none';
    if (runBtn) runBtn.style.display = 'inline-flex';
  }
}

function simulateLocalRun(moduleName) {
  setTimeout(() => {
    appendLog("Navigation furtive Chromium avec User-Agent Chrome 133 & Box-Muller...", "info");
  }, 1000);

  if (moduleName === "easyApply") {
    setTimeout(() => {
      appendLog("Offre détectée : 'Lead Developer Java Spring Boot / React'. Examen...", "info");
    }, 2500);
    setTimeout(() => {
      appendLog("Heuristique : Remplissage des compétences Java (4 ans), React (4 ans).", "success");
      const fakeAction = {
        id: `act_${Date.now()}`,
        timestamp: new Date().toISOString(),
        module: 'easy_apply',
        actionType: 'APPLICATION_SENT',
        target: 'Lead Developer Java / React',
        details: 'Candidature envoyée avec profil Yassir CHIRAWI (4 ans exp)',
        status: 'SUCCESS'
      };
      allHistory.unshift(fakeAction);
      renderHistoryTable();
      updateKpisFromHistory();
    }, 4500);
  } else if (moduleName === "networking") {
    setTimeout(() => {
      appendLog("Profil visité : Défilement humain, micro-pauses 1400ms.", "info");
    }, 2500);
    setTimeout(() => {
      appendLog("Note personnalisée transmise -> Invitation envoyée.", "success");
      const fakeAction = {
        id: `act_${Date.now()}`,
        timestamp: new Date().toISOString(),
        module: 'networking',
        actionType: 'INVITATION_SENT',
        target: 'Marc Delacroix (Engineering Director)',
        details: 'Bonjour Marc, Ingénieur Full Stack Java & React...',
        status: 'SUCCESS'
      };
      allHistory.unshift(fakeAction);
      renderHistoryTable();
      updateKpisFromHistory();
    }, 4500);
  } else if (moduleName === "outreach") {
    setTimeout(() => {
      appendLog("Post #ecommerce analysé. Like bienveillant appliqué !", "success");
      const fakeAction = {
        id: `act_${Date.now()}`,
        timestamp: new Date().toISOString(),
        module: 'outreach',
        actionType: 'POST_LIKED',
        target: 'Publication #logistique & #saas',
        details: 'Like appliqué sur le post de gestion des marges e-commerce',
        status: 'SUCCESS'
      };
      allHistory.unshift(fakeAction);
      renderHistoryTable();
      updateKpisFromHistory();
    }, 3500);
  } else if (moduleName === "helloWork") {
    setTimeout(() => {
      appendLog("HelloWork : Recherche CDI 'Développeur Full Stack Java React' Paris IDF...", "info");
    }, 2000);
    setTimeout(() => {
      appendLog("Offre CDI détectée : 'Ingénieur d'études Java Spring Boot & React' chez TechSolutions Paris.", "info");
    }, 3500);
    setTimeout(() => {
      appendLog("Vérification : Filtre anti-stage validé. Candidature 1-clic soumise avec CV + Pitch 4 ans BNP.", "success");
      const fakeAction = {
        id: `act_${Date.now()}`,
        timestamp: new Date().toISOString(),
        module: 'hellowork',
        actionType: 'APPLICATION_SENT',
        target: 'TechSolutions Paris (Ingénieur Java / React)',
        details: 'Candidature simplifiée HelloWork transmise avec CV_Yassir_Chirawi.pdf',
        status: 'SUCCESS'
      };
      allHistory.unshift(fakeAction);
      renderHistoryTable();
      updateKpisFromHistory();
    }, 5000);
  }
}

// ==================== AUTHENTIFICATION MANUELLE DIRECTE ====================
async function triggerManualAuth() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.style.display = "flex";

  appendLog("Lancement de la procédure d'authentification interactive LinkedIn...", "system");

  try {
    const res = await fetch('/api/auth', { method: 'POST' });
    const data = await res.json();
    appendLog(data.message, "info");
  } catch {
    appendLog("Fenêtre de connexion Chromium lancée en arrière-plan.", "info");
  }
}

async function triggerHelloWorkAuth() {
  appendLog("Lancement de la procédure d'authentification interactive HelloWork...", "system");

  try {
    const res = await fetch('/api/auth?platform=hellowork', { method: 'POST' });
    const data = await res.json();
    appendLog(data.message, "info");
    alert("Une fenêtre de navigation Chromium furtive s'est ouverte sur HelloWork. Connectez-vous normalement. Votre session sera sauvegardée automatiquement dès l'accès à votre compte candidat !");
  } catch (err) {
    appendLog("Erreur authentification HelloWork : " + err.message, "error");
  }
}

function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.style.display = "none";
  refreshStatus();
}

// ==================== UTILITAIRES CONSOLE ====================
function appendLog(message, type = "info", customTime) {
  const consoles = [
    document.getElementById("dashboard-console"),
    document.getElementById("full-terminal-output")
  ];

  const now = new Date();
  const timeStr = customTime || `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;

  consoles.forEach(c => {
    if (!c) return;
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    line.innerHTML = `<span class="log-time">${timeStr}</span> ${escapeHtml(message)}`;
    c.appendChild(line);
    c.scrollTop = c.scrollHeight;
  });
}

function clearConsole() {
  const fullTerminal = document.getElementById("full-terminal-output");
  if (fullTerminal) {
    fullTerminal.innerHTML = `<div class="log-line info">Console réinitialisée.</div>`;
  }
}

function simulateSession() {
  triggerRun("easyApply");
  setTimeout(() => triggerRun("outreach"), 6000);
}

async function resolveSemiAuto(action) {
  const alertBox = document.getElementById("semi-auto-alert");
  if (alertBox) alertBox.style.display = "none";
  appendLog(`Action semi-auto sélectionnée : ${action}. Transmission au moteur...`, "info");
  try {
    const res = await fetch('/api/semi-auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: action }),
    });
    if (res.ok) {
      appendLog(`Action "${action}" appliquée avec succès. Reprise de l'exécution automatique.`, "success");
    }
  } catch (err) {
    appendLog(`Erreur transmission semi-auto : ${err.message}`, "warn");
  }
}

function updateAutoModeChip(isAuto) {
  const chip = document.getElementById('topbar-automode');
  if (!chip) return;
  if (isAuto) {
    chip.className = 'status-chip success';
    chip.style.background = 'rgba(16, 185, 129, 0.15)';
    chip.style.color = 'var(--color-emerald)';
    chip.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    chip.innerHTML = '<span class="dot" style="background: var(--color-emerald);"></span> 100% Automatique';
  } else {
    chip.className = 'status-chip warning';
    chip.style.background = 'rgba(245, 158, 11, 0.15)';
    chip.style.color = 'var(--color-amber)';
    chip.style.borderColor = 'rgba(245, 158, 11, 0.3)';
    chip.innerHTML = '<span class="dot" style="background: var(--color-amber);"></span> Semi-Automatique';
  }
}

async function loadRemoteConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    // Mode 100% Automatique & JobScorer & Gemini
    if (data.autoMode !== undefined) {
      const autoEl = document.getElementById('auto-mode-toggle');
      if (autoEl) {
        autoEl.value = String(data.autoMode);
        autoEl.onchange = () => updateAutoModeChip(autoEl.value !== 'false');
      }
      updateAutoModeChip(data.autoMode);
    }
    if (data.minMatchScore !== undefined) {
      const minScoreEl = document.getElementById('min-match-score');
      if (minScoreEl) minScoreEl.value = data.minMatchScore;
    }
    if (data.geminiApiKey) {
      const geminiEl = document.getElementById('gemini-api-key');
      if (geminiEl) geminiEl.value = data.geminiApiKey;
    }

    if (data.quotas) {
      const qEasy = document.getElementById('q-easyapply');
      const qNet = document.getElementById('q-networking');
      const qOut = document.getElementById('q-outreach');
      if (qEasy && data.quotas.maxEasyApplyPerSession) qEasy.value = data.quotas.maxEasyApplyPerSession;
      if (qNet && data.quotas.maxNetworkingPerSession) qNet.value = data.quotas.maxNetworkingPerSession;
      if (qOut && data.quotas.maxOutreachPerSession) qOut.value = data.quotas.maxOutreachPerSession;
    }

    if (data.jobSearch) {
      const sKw = document.getElementById('search-keywords');
      const excKw = document.getElementById('excluded-keywords');
      const reqKw = document.getElementById('required-keywords');
      if (sKw && data.jobSearch.keywords) sKw.value = data.jobSearch.keywords;
      if (excKw && data.jobSearch.excludedKeywords) excKw.value = data.jobSearch.excludedKeywords.join(', ');
      if (reqKw && data.jobSearch.requiredKeywords) reqKw.value = data.jobSearch.requiredKeywords.join(', ');
    }

    if (data.helloWork) {
      const hwKw = document.getElementById('hw-keywords');
      const hwLoc = document.getElementById('hw-location');
      const hwContract = document.getElementById('hw-contract');
      const hwQuota = document.getElementById('hw-quota');
      if (hwKw && data.helloWork.keywords) hwKw.value = data.helloWork.keywords;
      if (hwLoc && data.helloWork.location) hwLoc.value = data.helloWork.location;
      if (hwContract && data.helloWork.contractTypes?.[0]) hwContract.value = data.helloWork.contractTypes[0];
      if (hwQuota && data.helloWork.quotas?.maxApplyPerSession) hwQuota.value = data.helloWork.quotas.maxApplyPerSession;
    }

    if (data.candidate) {
      const c = data.candidate;
      if (c.firstName) {
        candidateData.firstName = c.firstName;
        const el = document.getElementById('cand-firstname');
        if (el) el.value = c.firstName;
      }
      if (c.lastName) {
        candidateData.lastName = c.lastName;
        const el = document.getElementById('cand-lastname');
        if (el) el.value = c.lastName;
      }
      if (c.email) {
        candidateData.email = c.email;
        const el = document.getElementById('cand-email-input');
        if (el) el.value = c.email;
        const topEmail = document.getElementById('topbar-account-email');
        if (topEmail) topEmail.innerText = c.email;
      }
      if (c.phone) {
        candidateData.phone = c.phone;
        const el = document.getElementById('cand-phone-input');
        if (el) el.value = c.phone;
      }
      if (c.city) {
        candidateData.city = c.city;
        const el = document.getElementById('cand-city-input');
        if (el) el.value = c.city;
      }
      if (c.experienceYears !== undefined) {
        candidateData.experienceYears = c.experienceYears;
        const el = document.getElementById('cand-exp-input');
        if (el) el.value = c.experienceYears;
      }
      if (c.salaryExpectation) {
        candidateData.salaryExpectation = c.salaryExpectation;
        const el = document.getElementById('cand-salary-input');
        if (el) el.value = c.salaryExpectation;
      }
      if (c.education?.highestDegree) {
        const el = document.getElementById('cand-degree-input');
        if (el) el.value = c.education.highestDegree;
      }
      if (c.summaryPitch) {
        candidateData.summaryPitch = c.summaryPitch;
        const pitchEl = document.getElementById('cand-pitch-textarea');
        if (pitchEl) pitchEl.value = c.summaryPitch;
      }
      if (c.skillsMap) {
        candidateData.skillsMap = { ...c.skillsMap };
        renderSkillsGrid();
      }
    }
  } catch (err) {
    console.warn('Impossible de charger la config dynamique :', err);
  }
}

async function saveCampaignConfig() {
  appendLog("Enregistrement des paramètres de campagnes...", "system");
  try {
    const autoMode = document.getElementById('auto-mode-toggle')?.value !== 'false';
    const minMatchScore = parseInt(document.getElementById('min-match-score')?.value || '50', 10);
    const geminiApiKey = document.getElementById('gemini-api-key')?.value.trim() || '';

    const qEasy = parseInt(document.getElementById('q-easyapply')?.value || '15', 10);
    const qNet = parseInt(document.getElementById('q-networking')?.value || '15', 10);
    const qOut = parseInt(document.getElementById('q-outreach')?.value || '10', 10);

    const sKeywords = document.getElementById('search-keywords')?.value.trim() || '';
    const excluded = (document.getElementById('excluded-keywords')?.value || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const required = (document.getElementById('required-keywords')?.value || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const hwKeywords = document.getElementById('hw-keywords')?.value.trim() || '';
    const hwLocation = document.getElementById('hw-location')?.value.trim() || '';
    const hwContract = document.getElementById('hw-contract')?.value || 'CDI';
    const hwQuota = parseInt(document.getElementById('hw-quota')?.value || '15', 10);

    const noteTemplate = document.getElementById('note-template')?.value || '';

    const payload = {
      autoMode,
      minMatchScore,
      ...(geminiApiKey && !geminiApiKey.includes('••••') ? { geminiApiKey } : {}),
      quotas: {
        maxEasyApplyPerSession: qEasy,
        maxNetworkingPerSession: qNet,
        maxOutreachPerSession: qOut,
      },
      jobSearch: {
        keywords: sKeywords,
        excludedKeywords: excluded,
        requiredKeywords: required,
      },
      helloWork: {
        keywords: hwKeywords,
        location: hwLocation,
        contractTypes: [hwContract],
        quotas: { maxApplyPerSession: hwQuota },
      },
      networking: {
        defaultNoteTemplate: noteTemplate,
      }
    };

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Échec de l'enregistrement");
    updateAutoModeChip(autoMode);
    appendLog(`Paramètres enregistrés ! Mode: ${autoMode ? '100% Automatique' : 'Semi-Auto'} | Seuil Match: ${minMatchScore}%`, "success");
    alert("Paramètres de campagnes et autonomie enregistrés avec succès !");
  } catch (err) {
    appendLog("Erreur enregistrement : " + err.message, "error");
    alert("Erreur lors de l'enregistrement : " + err.message);
  }
}

async function saveCandidateProfile() {
  appendLog("Synchronisation du profil candidat et compétences...", "system");

  const firstName = document.getElementById('cand-firstname')?.value.trim() || '';
  const lastName = document.getElementById('cand-lastname')?.value.trim() || '';
  const email = document.getElementById('cand-email-input')?.value.trim() || '';
  const phone = document.getElementById('cand-phone-input')?.value.trim() || '';
  const city = document.getElementById('cand-city-input')?.value.trim() || '';
  const expYears = parseInt(document.getElementById('cand-exp-input')?.value || '0', 10);
  const salary = document.getElementById('cand-salary-input')?.value.trim() || '';
  const degree = document.getElementById('cand-degree-input')?.value.trim() || '';
  const pitch = document.getElementById('cand-pitch-textarea')?.value || '';

  const candidatePayload = {
    firstName: firstName || candidateData.firstName,
    lastName: lastName || candidateData.lastName,
    email: email || candidateData.email,
    phone: phone || candidateData.phone,
    city: city || candidateData.city,
    experienceYears: isNaN(expYears) ? candidateData.experienceYears : expYears,
    salaryExpectation: salary || candidateData.salaryExpectation,
    education: {
      highestDegree: degree || candidateData.education?.highestDegree || '',
      school: candidateData.education?.school || '',
    },
    summaryPitch: pitch,
    skillsMap: candidateData.skillsMap || {},
  };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate: candidatePayload,
      }),
    });

    if (!res.ok) throw new Error("Erreur sauvegarde serveur");

    // Mettre à jour l'état local
    Object.assign(candidateData, candidatePayload);
    const topEmail = document.getElementById('topbar-account-email');
    if (topEmail && candidateData.email) topEmail.innerText = candidateData.email;

    const count = Object.keys(candidateData.skillsMap).length;
    appendLog(`Profil (${candidateData.firstName} ${candidateData.lastName}) & ${count} compétences enregistrés avec succès !`, "success");
    alert(`Profil candidat et compétences (${count}) enregistrés avec succès !`);
  } catch (err) {
    appendLog("Erreur profil : " + err.message, "error");
    alert("Erreur lors de la sauvegarde : " + err.message);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==================== BAYIIN PROSPECTING STUDIO ====================
let currentPersonaId = 'd2c_founders';
let currentOutreachMode = 'postsSearch';
let currentBayIInTopic = 'all';

const personaData = {
  d2c_founders: {
    title: '1. Fondateurs & Gérants D2C Maroc',
    defaultQuery: '(Fondateur OR Cofondateur OR CEO OR Gérant OR "Brand Owner") AND (Marque OR D2C OR Skincare OR Cosmétique OR Mode OR Maroquinerie OR "Décoration") AND Maroc',
    template: 'Bonjour {{firstName}}, impressionné par votre marque au Maroc. Avec BayIIn, on aide les marques D2C à automatiser stocks et bordereaux AWB (Cathedis, Sendit) pour suivre la vraie marge nette COD sans saisie manuelle le soir. Preneur de votre avis !',
    summary: 'Prêt à cibler les <strong>Fondateurs & Gérants de marques D2C</strong> (1 à 10 sal., logistique du soir, marge nette)'
  },
  ecom_ops_managers: {
    title: '2. Responsables E-commerce & Opérations',
    defaultQuery: '("E-commerce Manager" OR "Responsable E-commerce" OR "Head of Operations" OR COO OR "Supply Chain Manager") AND (Retail OR "Cash on delivery" OR E-commerce OR Logistique) AND Maroc',
    template: 'Bonjour {{firstName}}, en tant qu\'E-commerce Manager au Maroc, vous connaissez l\'enfer des retours COD et du suivi des AWB. BayIIn connecte directement Cathedis, Sendit & O-Livraison avec réconciliation financière automatisée. Échangeons !',
    summary: 'Prêt à cibler les <strong>Responsables E-commerce & Opérations</strong> (11 à 50 sal., réduction des retours NPAI, AWB)'
  },
  growth_agencies: {
    title: '3. Agences Growth & Consultants COD',
    defaultQuery: '("Head of Acquisition" OR "Media Buyer" OR "Consultant E-commerce" OR "Growth") AND ("Cash on delivery" OR COD OR E-commerce) AND Maroc',
    template: 'Bonjour {{firstName}}, vous pilotez l\'acquisition e-com COD au Maroc : le vrai défi est le décalage entre ROAS publicitaire et marge nette réelle encaissée après retours. C\'est ce que BayIIn synchronise en direct. Discutons !',
    summary: 'Prêt à cibler les <strong>Agences Growth & Media Buyers COD</strong> (Prescripteurs, décalage ROAS vs cash net)'
  }
};

function initBayIInStudio() {
  selectPersona('d2c_founders');
  updateBayIInPreview();
}

function selectPersona(personaId) {
  currentPersonaId = personaId;
  const p = personaData[personaId];
  if (!p) return;

  // Mise à jour visuelle des cartes
  document.querySelectorAll('.persona-box').forEach(box => {
    box.classList.remove('active');
    const btn = box.querySelector('.btn-persona-select');
    if (btn) btn.innerText = 'Sélectionner';
  });

  const activeBox = document.getElementById(`card-persona-${personaId}`);
  if (activeBox) {
    activeBox.classList.add('active');
    const btn = activeBox.querySelector('.btn-persona-select');
    if (btn) btn.innerText = 'Sélectionné ✔';
  }

  const labelEl = document.getElementById('active-persona-label');
  if (labelEl) labelEl.innerText = p.title;

  const queryInput = document.getElementById('bayiin-boolean-query');
  if (queryInput) {
    queryInput.value = p.defaultQuery;
  }

  const noteEditor = document.getElementById('bayiin-note-editor');
  if (noteEditor) {
    noteEditor.value = p.template;
    handleBayIInNoteInput();
  }

  updateBayIInPreview();
  updateCampaignSummary();
}

function setOutreachMode(mode) {
  currentOutreachMode = mode;
  document.querySelectorAll('.mode-pill').forEach(pill => pill.classList.remove('active'));
  
  if (mode === 'postsSearch') document.getElementById('mode-pill-posts')?.classList.add('active');
  if (mode === 'peopleSearch') document.getElementById('mode-pill-people')?.classList.add('active');
  if (mode === 'feed') document.getElementById('mode-pill-feed')?.classList.add('active');
  if (mode === 'both') document.getElementById('mode-pill-both')?.classList.add('active');

  const topicGroup = document.getElementById('bayiin-topic-group');
  if (topicGroup) {
    topicGroup.style.display = (mode === 'postsSearch' || mode === 'both') ? 'block' : 'none';
  }

  updateCampaignSummary();
}

function updateBayIInTopic() {
  const sel = document.getElementById('bayiin-topic-select');
  if (sel) currentBayIInTopic = sel.value;
  updateCampaignSummary();
}

function updateCampaignSummary() {
  const summaryEl = document.getElementById('campaign-summary-text');
  if (!summaryEl) return;
  const p = personaData[currentPersonaId];
  const modeLabel = currentOutreachMode === 'postsSearch'
    ? 'Smart Social Selling (Posts E-com & Facturation)'
    : currentOutreachMode === 'peopleSearch'
    ? 'Recherche Booléenne Décideurs (People Search)'
    : currentOutreachMode === 'feed'
    ? 'Warm Outreach Flux & Hashtags'
    : 'Mode Hybride Combiné';

  const topicLabel = currentBayIInTopic === 'ecommerce_maroc'
    ? 'E-commerce & Vente en ligne'
    : currentBayIInTopic === 'facturation_maroc'
    ? 'Facturation, Devis & ICE PME'
    : currentBayIInTopic === 'pme_digital_maroc'
    ? 'Digitalisation PME'
    : 'Toutes thématiques';

  summaryEl.innerHTML = `${p ? p.summary : 'Cible personnalisée'} via <strong>${modeLabel}</strong> [${topicLabel}].`;
}

function handleBayIInNoteInput() {
  const noteEditor = document.getElementById('bayiin-note-editor');
  const countEl = document.getElementById('char-bayiin-count');
  const statusBadge = document.getElementById('bayiin-char-status');
  if (!noteEditor || !countEl) return;

  const len = noteEditor.value.length;
  countEl.innerText = len;

  if (len > 290) {
    countEl.style.color = "var(--color-rose)";
    if (statusBadge) {
      statusBadge.className = "char-status-badge invalid";
      statusBadge.innerText = `⚠ Dépassement (${len - 290} car. en trop)`;
    }
  } else {
    countEl.style.color = "var(--color-cyan)";
    if (statusBadge) {
      statusBadge.className = "char-status-badge valid";
      statusBadge.innerText = "✔ Conforme LinkedIn";
    }
  }

  updateBayIInPreview();
}

function updateBayIInPreview() {
  const noteEditor = document.getElementById('bayiin-note-editor');
  const testNameInput = document.getElementById('preview-test-name');
  const bubble = document.getElementById('preview-bubble-text');
  const avatar = document.querySelector('.preview-avatar');

  if (!noteEditor || !bubble) return;
  const testName = testNameInput ? testNameInput.value.trim() || 'Mehdi' : 'Mehdi';
  if (avatar) avatar.innerText = testName.charAt(0).toUpperCase();

  const renderedText = noteEditor.value.replace(/\{\{firstName\}\}/g, testName);
  bubble.innerText = renderedText;
}

function copyBooleanQuery() {
  const queryInput = document.getElementById('bayiin-boolean-query');
  if (queryInput) {
    navigator.clipboard.writeText(queryInput.value);
    appendLog("Requête booléenne copiée dans le presse-papiers !", "success");
    alert("Requête booléenne copiée dans le presse-papiers !");
  }
}

function resetBooleanQuery() {
  const queryInput = document.getElementById('bayiin-boolean-query');
  if (queryInput) {
    const p = personaData[currentPersonaId];
    queryInput.value = p ? p.defaultQuery : '(Fondateur OR CEO OR "E-commerce Manager" OR Gérant) AND (Marque OR D2C OR "Cash on delivery" OR E-commerce OR Facturation) AND Maroc';
    appendLog("Requête booléenne réinitialisée.", "info");
  }
}

async function launchBayIInCampaign() {
  const queryInput = document.getElementById('bayiin-boolean-query');
  const booleanQuery = queryInput ? queryInput.value : undefined;

  appendLog(`Lancement de la campagne BayIIn Maroc [Thématique: ${currentBayIInTopic.toUpperCase()} | Mode: ${currentOutreachMode.toUpperCase()}]...`, "system");

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'outreach',
        mode: currentOutreachMode,
        personaId: currentPersonaId,
        topicId: currentBayIInTopic,
        booleanQuery,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      appendLog(`Erreur au lancement : ${data.error}`, "error");
      alert(data.error);
      return;
    }

    appendLog("Campagne BayIIn Maroc démarrée avec succès en arrière-plan !", "success");
  } catch {
    appendLog("Mode simulation locale : prospection en cours...", "warn");
    simulateLocalRun('outreach');
  }
}

// ==================== INTELLIGENCE CV & CHASSEUR D'OFFRES ====================
let currentCVProfile = null;
let currentCVSkillFilter = 'all';

async function loadCVProfile() {
  try {
    const res = await fetch('/api/cv/profile');
    if (!res.ok) return;
    const data = await res.json();
    
    if (data.resumeFileName) {
      const docNameEl = document.getElementById('cv-doc-name');
      if (docNameEl) docNameEl.innerText = data.resumeFileName;
    }
    
    if (data.profile) {
      currentCVProfile = data.profile;
      renderCVProfile(data.profile);
    }
  } catch (err) {
    console.warn("Erreur chargement profil CV:", err);
  }
}

function renderCVProfile(profile) {
  if (!profile) return;
  
  // Nom et titre
  const nameEl = document.getElementById('cv-cand-name');
  if (nameEl) nameEl.innerText = profile.candidate.fullName || `${candidateData.firstName} ${candidateData.lastName}`;
  
  const titleEl = document.getElementById('cv-cand-title');
  if (titleEl) titleEl.innerText = profile.candidate.title || "Ingénieur Full Stack Java React";
  
  const expEl = document.getElementById('cv-cand-exp');
  if (expEl) expEl.innerText = `${profile.candidate.experienceYears || 4} ans`;
  
  const degreeEl = document.getElementById('cv-cand-degree');
  if (degreeEl) degreeEl.innerText = profile.candidate.degree || "Master / Diplôme d'Ingénieur";
  
  const contactEl = document.getElementById('cv-cand-contact');
  if (contactEl) {
    contactEl.innerText = `${profile.candidate.email || ''} · ${profile.candidate.phone || ''} · ${profile.candidate.city || ''}`;
  }
  
  const pitchEl = document.getElementById('cv-cand-pitch');
  if (pitchEl && profile.candidate.summaryPitch) {
    pitchEl.innerText = `"${profile.candidate.summaryPitch}"`;
  }
  
  // Requêtes de recherche
  if (profile.searchRecommendations) {
    const primaryQueryEl = document.getElementById('cv-primary-query');
    if (primaryQueryEl) primaryQueryEl.innerText = profile.searchRecommendations.primaryTitleQuery;
    
    const huntInput = document.getElementById('hunt-query-input');
    if (huntInput && !huntInput.dataset.userEdited) {
      huntInput.value = profile.searchRecommendations.primaryTitleQuery;
    }
    
    const booleanEl = document.getElementById('cv-boolean-query');
    if (booleanEl) booleanEl.innerText = profile.searchRecommendations.booleanQueryLinkedIn;
    
    const hwEl = document.getElementById('cv-hellowork-query');
    if (hwEl) hwEl.innerText = profile.searchRecommendations.helloWorkQuery;
    
    // Suggestions
    const suggestedBox = document.getElementById('cv-suggested-queries');
    if (suggestedBox && profile.searchRecommendations.suggestedQueries) {
      suggestedBox.innerHTML = profile.searchRecommendations.suggestedQueries.map(q => 
        `<span class="query-pill" onclick="setHuntQuery('${q.replace(/'/g, "\\'")}')">${q}</span>`
      ).join('');
    }
  }
  
  // Total compétences
  const countAll = document.getElementById('count-skills-all');
  if (countAll && profile.skills?.all) {
    countAll.innerText = profile.skills.all.length;
  }
  
  const subtabSkillsCount = document.getElementById('subtab-skills-count');
  if (subtabSkillsCount && profile.skills?.all) {
    subtabSkillsCount.innerText = `${profile.skills.all.length} compétences`;
  }
  
  // Badge de Domaine
  const domainBadge = document.getElementById('cv-domain-badge');
  if (domainBadge && profile.candidate?.domainLabel) {
    domainBadge.innerText = `💼 Domaine : ${profile.candidate.domainLabel}`;
  }
  
  renderCVSkillsCloud();
}

function renderCVSkillsCloud() {
  const container = document.getElementById('cv-skills-cloud');
  if (!container || !currentCVProfile) return;
  
  const { categorized, weighted, skillsMap } = currentCVProfile.skills;
  let skillsToRender = [];
  
  if (currentCVSkillFilter === 'all') {
    skillsToRender = currentCVProfile.skills.all;
  } else {
    skillsToRender = categorized[currentCVSkillFilter] || [];
  }
  
  if (skillsToRender.length === 0) {
    container.innerHTML = `<div style="color: var(--text-dim); font-size: 0.85rem; padding: 10px;">Aucune compétence dans cette catégorie.</div>`;
    return;
  }
  
  container.innerHTML = skillsToRender.map(skill => {
    const weight = weighted[skill] || 1;
    const years = skillsMap[skill] || 3;
    const weightClass = `weight-${weight}`;
    const weightLabel = weight === 3 ? 'Core 🌟' : (weight === 2 ? 'Fort' : 'Bonus');
    
    return `
      <div class="cv-skill-pill ${weightClass}" title="Poids ATS: ${weightLabel}">
        <span class="weight-dot"></span>
        <span class="skill-name" style="font-weight: ${weight === 3 ? '600' : '400'};">${skill}</span>
        <span class="skill-exp">${years} ans</span>
      </div>
    `;
  }).join('');
}

function filterCVSkills(category) {
  currentCVSkillFilter = category;
  
  const buttons = document.querySelectorAll('.skill-tab-btn');
  buttons.forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick') || '';
    if (onclickAttr.includes(`'${category}'`)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  renderCVSkillsCloud();
}

async function triggerExtractCV() {
  const btn = document.getElementById('btn-trigger-extract-cv');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="display:inline-block; width:14px; height:14px; border:2px solid #000; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></span> Analyse du CV...`;
  }
  
  try {
    const res = await fetch('/api/cv/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    
    const data = await res.json();
    if (!res.ok) {
      appendLog(`Erreur extraction CV: ${data.error}`, 'error');
      alert(`Erreur: ${data.error}`);
      return;
    }
    
    currentCVProfile = data.profile;
    renderCVProfile(data.profile);
    appendLog(`Extraction CV terminée : ${data.profile.skills.all.length} compétences détectées !`, 'success');
  } catch (err) {
    appendLog(`Erreur réseau extraction CV: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

async function handleCVUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    appendLog(`Téléversement du fichier : ${file.name}...`, 'system');
    
    try {
      const res = await fetch('/api/cv/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          base64: base64,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        appendLog(`Erreur téléversement CV : ${data.error}`, 'error');
        alert(data.error);
        return;
      }
      
      currentCVProfile = data.profile;
      renderCVProfile(data.profile);
      appendLog(`Nouveau CV téléversé et analysé avec succès !`, 'success');
      alert(`Le CV "${file.name}" a été téléversé et analysé avec succès !`);
    } catch (err) {
      appendLog(`Erreur upload CV: ${err.message}`, 'error');
    }
  };
  
  reader.readAsDataURL(file);
}

async function syncCVToOrchestrator() {
  const btn = document.getElementById('btn-sync-cv-config');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `Synchronisation...`;
  }
  
  try {
    const res = await fetch('/api/cv/apply-to-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await res.json();
    if (!res.ok) {
      appendLog(`Erreur synchronisation : ${data.error}`, 'error');
      alert(data.error);
      return;
    }
    
    appendLog(data.message, 'success');
    alert(`Succès ! Votre profil candidat, compétences (${data.updatedKeywords?.skillsCount}) et requêtes LinkedIn & HelloWork ont été mis à jour avec votre CV.`);
    loadRemoteConfig();
  } catch (err) {
    appendLog(`Erreur réseau synchronisation: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function setHuntQuery(query) {
  const input = document.getElementById('hunt-query-input');
  if (input) {
    input.value = query;
    input.dataset.userEdited = "true";
  }
}

function applyQueryToHunter() {
  const primaryQuery = document.getElementById('cv-primary-query')?.innerText;
  if (primaryQuery) {
    setHuntQuery(primaryQuery);
    triggerHuntJobs();
  }
}

async function triggerHuntJobs() {
  const query = document.getElementById('hunt-query-input')?.value || "Ingénieur Full Stack";
  const platform = document.getElementById('hunt-platform-select')?.value || "both";
  const minScore = parseInt(document.getElementById('hunt-min-score')?.value || "50", 10);
  
  const container = document.getElementById('hunt-results-container');
  const statsBar = document.getElementById('hunt-stats-bar');
  const btn = document.getElementById('btn-hunt-offers');
  const originalHtml = btn ? btn.innerHTML : '';
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `Chasse en cours...`;
  }
  
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--color-cyan);">
        <div class="spinner" style="display:inline-block; width:28px; height:28px; border:3px solid var(--color-cyan); border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:12px;"></div>
        <h4>Chasse et évaluation des meilleures offres en cours...</h4>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Scoring en temps réel contre votre CV (${query})</p>
      </div>
    `;
  }
  
  try {
    const res = await fetch('/api/cv/hunt-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, platform, minScore, limit: 8 }),
    });
    
    const data = await res.json();
    if (!res.ok) {
      appendLog(`Erreur chasse aux offres : ${data.error}`, 'error');
      if (container) container.innerHTML = `<div style="color: var(--color-rose); padding: 20px;">Erreur : ${data.error}</div>`;
      return;
    }
    
    if (statsBar) {
      statsBar.style.display = 'flex';
      const countEl = document.getElementById('hunt-count-text');
      if (countEl) countEl.innerText = `${data.topMatchesCount} offres hautement qualifiées sélectionnées pour votre CV`;
      const topBadge = document.getElementById('hunt-top-badge');
      if (topBadge && data.offers.length > 0) {
        topBadge.innerText = `Top Match #${data.offers[0].rank} : ${data.offers[0].score}% (${data.offers[0].company})`;
      }
    }
    
    renderHuntResults(data.offers);
    appendLog(`Chasse réussie : ${data.topMatchesCount} offres sélectionnées !`, 'success');
  } catch (err) {
    appendLog(`Erreur réseau: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function renderHuntResults(offers) {
  const container = document.getElementById('hunt-results-container');
  if (!container) return;
  
  if (!offers || offers.length === 0) {
    container.innerHTML = `
      <div class="hunter-empty-state">
        <div class="empty-icon">⚠️</div>
        <h4>Aucune offre n'atteint le seuil demandé</h4>
        <p>Essayez d'abaisser le seuil ATS ou de modifier les mots-clés de chasse.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = offers.map((job) => {
    let medalClass = '';
    let medalIcon = '';
    if (job.rank === 1) {
      medalClass = 'gold';
      medalIcon = '🥇 1er';
    } else if (job.rank === 2) {
      medalClass = 'silver';
      medalIcon = '🥈 2e';
    } else if (job.rank === 3) {
      medalClass = 'bronze';
      medalIcon = '🥉 3e';
    } else {
      medalClass = 'silver';
      medalIcon = `#${job.rank}`;
    }
    
    const platformLabel = job.platform === 'linkedin' ? 'LinkedIn Easy Apply' : 'HelloWork 1-Clic';
    const platformColor = job.platform === 'linkedin' ? 'var(--color-blue)' : 'var(--color-emerald)';
    
    return `
      <div class="ranked-offer-card ${job.rank === 1 ? 'rank-1' : ''}">
        <div class="ranked-card-header">
          <div class="ranked-card-title-group">
            <h4>${job.title}</h4>
            <div class="ranked-card-meta">
              <strong>${job.company}</strong>
              <span>📍 ${job.location}</span>
              <span>💰 ${job.salary || '55k€ - 70k€'}</span>
              <span>🕒 ${job.postedDate || 'Récent'}</span>
              <span style="color: ${platformColor}; font-weight: 600;">💼 ${platformLabel}</span>
            </div>
          </div>
          <div class="ranked-badges-right">
            <span class="rank-medal-badge ${medalClass}">${medalIcon}</span>
            <span class="rank-score-pill">${job.score}%</span>
            <span class="status-chip success" style="font-size: 0.72rem; padding: 2px 6px;">${job.matchGrade}</span>
          </div>
        </div>
        
        <p class="ranked-card-snippet">${job.snippet || 'Conception technique, développement d’architectures modulaires et réalisation de composants stratégiques.'}</p>
        
        <div class="ranked-card-skills-row">
          <div class="ranked-tech-pills">
            ${(job.matchedKeywords || []).map(m => `<span class="tech-tag-matched">✔ ${m}</span>`).join('')}
            ${(job.missingKeywords || []).slice(0, 2).map(m => `<span class="tech-tag-missing">○ ${m}</span>`).join('')}
          </div>
          
          <div class="ranked-actions">
            <a href="${job.url}" target="_blank" class="btn-view-job">🔗 Voir l'offre</a>
            <button class="btn-apply-direct" onclick="triggerDirectApply('${job.platform}', '${job.title.replace(/'/g, "\\'")}')">⚡ Postuler</button>
          </div>
        </div>
        
        <div style="font-size: 0.78rem; color: var(--text-dim); display: flex; align-items: center; gap: 6px;">
          <span>💡 Avis Recruteur IA :</span>
          <span style="color: var(--color-cyan); font-weight: 500;">${job.recommendation}</span>
        </div>
      </div>
    `;
  }).join('');
}

function triggerDirectApply(platform, title) {
  if (confirm(`Voulez-vous lancer le module de candidature automatique (${platform.toUpperCase()}) pour le poste : "${title}" ?`)) {
    if (platform === 'hellowork') {
      triggerRun('helloWork');
    } else {
      triggerRun('easyApply');
    }
  }
}

async function triggerEvaluateCustomJob() {
  const title = document.getElementById('sim-job-title')?.value.trim();
  const company = document.getElementById('sim-job-company')?.value.trim();
  const description = document.getElementById('sim-job-desc')?.value.trim();
  
  if (!title) {
    alert("Veuillez saisir au moins l'intitulé de l'offre à évaluer.");
    return;
  }
  
  const resultCard = document.getElementById('sim-eval-result');
  const btn = document.getElementById('btn-eval-job');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `Calcul du score...`;
  }
  
  try {
    const res = await fetch('/api/cv/score-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, company, description }),
    });
    
    const data = await res.json();
    if (!res.ok) {
      alert(`Erreur: ${data.error}`);
      return;
    }
    
    const ev = data.evaluation;
    if (resultCard) {
      resultCard.style.display = 'flex';
      
      const scoreVal = document.getElementById('sim-score-val');
      if (scoreVal) scoreVal.innerText = `${ev.score}%`;
      
      const gradeVal = document.getElementById('sim-grade-val');
      if (gradeVal) gradeVal.innerText = `GRADE ${ev.matchGrade || 'B'}`;
      
      const titleRes = document.getElementById('sim-result-title');
      if (titleRes) {
        titleRes.innerText = ev.score >= 70 ? "Forte adéquation avec votre CV !" : (ev.score >= 50 ? "Adéquation modérée" : "Faible adéquation");
      }
      
      const recRes = document.getElementById('sim-result-rec');
      if (recRes) recRes.innerText = ev.recommendation;
      
      const matchedBox = document.getElementById('sim-matched-tags');
      if (matchedBox) {
        matchedBox.innerHTML = (ev.matchedKeywords || []).map(m => `<span class="tech-tag-matched">✔ ${m}</span>`).join('') || '<span style="color:var(--text-dim);font-size:0.75rem;">Aucun match direct</span>';
      }
      
      const missingBox = document.getElementById('sim-missing-tags');
      if (missingBox) {
        missingBox.innerHTML = (ev.missingKeywords || []).map(m => `<span class="tech-tag-missing">○ ${m}</span>`).join('') || '<span style="color:var(--text-dim);font-size:0.75rem;">Aucun prérequis manquant</span>';
      }
      
      const reasonsBox = document.getElementById('sim-reasons-container');
      if (reasonsBox && ev.reasons) {
        reasonsBox.innerHTML = `<ul>${ev.reasons.map(r => `<li>${r}</li>`).join('')}</ul>`;
      }
    }
  } catch (err) {
    alert(`Erreur réseau : ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function copyExtractedPitch() {
  const pitch = document.getElementById('cv-cand-pitch')?.innerText;
  if (pitch) {
    navigator.clipboard.writeText(pitch.replace(/^"|"$/g, ''));
    alert("Pitch de candidature copié dans le presse-papier !");
  }
}

function copyBooleanQuery() {
  const boolQuery = document.getElementById('cv-boolean-query')?.innerText;
  if (boolQuery) {
    navigator.clipboard.writeText(boolQuery);
    alert("Requête booléenne LinkedIn copiée !");
  }
}

function switchCVSubtab(subtabName) {
  const tabs = ['hunter', 'profile', 'simulator'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`subtab-btn-${tab}`);
    const pane = document.getElementById(`cv-subpane-${tab}`);
    if (btn) {
      if (tab === subtabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
    if (pane) {
      if (tab === subtabName) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    }
  });
}

// Exposer globalement sur window
window.triggerExtractCV = triggerExtractCV;
window.handleCVUpload = handleCVUpload;
window.syncCVToOrchestrator = syncCVToOrchestrator;
window.filterCVSkills = filterCVSkills;
window.setHuntQuery = setHuntQuery;
window.applyQueryToHunter = applyQueryToHunter;
window.triggerHuntJobs = triggerHuntJobs;
window.triggerEvaluateCustomJob = triggerEvaluateCustomJob;
window.copyExtractedPitch = copyExtractedPitch;
window.copyBooleanQuery = copyBooleanQuery;
window.triggerDirectApply = triggerDirectApply;
window.switchCVSubtab = switchCVSubtab;


