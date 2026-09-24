const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const PORT = 3000;

/**
 * Vérifie si le serveur local HTTP répond.
 */
function checkServerReady(url, maxRetries = 25, interval = 400) {
  return new Promise((resolve) => {
    let retries = 0;
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve(true);
          } else {
            retry();
          }
        })
        .on('error', () => {
          retry();
        });
    };

    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        resolve(false);
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

/**
 * Lance le serveur local en arrière-plan s'il ne tourne pas déjà.
 */
function startBackendServer() {
  const rootDir = path.resolve(__dirname, '..');
  const serverScript = path.join(rootDir, 'src', 'server.ts');
  const tsxCli = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');

  console.log('[Electron] Démarrage du serveur local via tsx...');
  serverProcess = spawn(process.execPath, [tsxCli, serverScript], {
    cwd: rootDir,
    env: { ...process.env, PORT: '3000' },
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (d) => console.log(`[Server] ${d}`));
  serverProcess.stderr.on('data', (d) => console.error(`[Server Err] ${d}`));
}

/**
 * Crée la fenêtre principale de l'application bureau.
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    title: 'LinkedIn & BayIIn Growth Orchestrator',
    backgroundColor: '#0a0d14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  // 1. Vérifier si le serveur répond déjà
  let isReady = await checkServerReady(`http://localhost:${PORT}/api/status`);

  // 2. Sinon, le lancer automatiquement
  if (!isReady) {
    startBackendServer();
    isReady = await checkServerReady(`http://localhost:${PORT}/api/status`);
  }

  // 3. Charger le Dashboard
  if (isReady) {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  } else {
    // Fallback fichier HTML direct
    mainWindow.loadFile(path.join(__dirname, '..', 'dashboard', 'index.html'));
  }

  // Ouvrir les liens externes (ex: bayiin.shop) dans le navigateur par défaut
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialisation de l'application Electron
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Arrêt propre du serveur à la fermeture de la fenêtre
app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
