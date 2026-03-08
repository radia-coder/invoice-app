import { app, BrowserWindow, session, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { execFile } from 'child_process';
import { autoUpdater } from 'electron-updater';
import { setupEnvironment, PORT, getPdfStoragePath } from './config';
import { startServer, waitForServer, stopServer } from './server';
import { runMigrations, ensureAdminUser } from './db-setup';
import { showSplash, hideSplash } from './splash';

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;

function createMainWindow(loggedIn: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    backgroundColor: '#09090b',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
  });

  // When logged in, intercept any page-initiated navigation to /login
  // and redirect back to /dashboard instead (e.g. if cookie expires)
  if (loggedIn) {
    win.webContents.on('will-navigate', (event, url) => {
      if (url.includes('/login')) {
        event.preventDefault();
        win.loadURL(`http://localhost:${PORT}/dashboard`);
      }
    });
  }

  // Hide logout button via CSS injection
  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
      [data-logout-button],
      button[aria-label="Logout"],
      button[aria-label="Log out"],
      .logout-button,
      a[href="/login"] { display: none !important; }
    `);
  });

  return win;
}

async function launch(): Promise<void> {
  // 0. Set dock icon (works in dev mode; packaged builds use electron-builder.yml)
  if (process.platform === 'darwin') {
    // Try PNG first (more reliable in dev), fall back to .icns
    const pngPath = path.join(__dirname, '..', '..', 'LogoInvoice-icon.png');
    const icnsPath = path.join(__dirname, '..', '..', 'build', 'icon.icns');
    try { app.dock?.setIcon(pngPath); } catch {
      try { app.dock?.setIcon(icnsPath); } catch { /* ignore */ }
    }
  }

  // 1. Show splash immediately
  showSplash();

  // 2. Set up all environment variables
  setupEnvironment();

  // 3. Inject X-Electron-App header into all requests
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['X-Electron-App'] = 'true';
    callback({ requestHeaders: details.requestHeaders });
  });

  // 4. Start Next.js standalone server
  startServer();

  // 5. Wait for server to be ready
  await waitForServer(45000);

  // 6. Run database migrations
  await runMigrations();

  // 7. Ensure admin user exists
  await ensureAdminUser();

  // 8. Create main window (hidden)
  // Auth is handled server-side via x-electron-app header — no login needed
  mainWindow = createMainWindow(true);

  // 9. Load dashboard directly
  const startUrl = `http://localhost:${PORT}/dashboard`;

  // Listen for first paint before loadURL so we don't miss it
  // 10s fallback in case ready-to-show never fires
  const readyToShow = new Promise<void>((resolve) => {
    const fallback = setTimeout(resolve, 10000);
    mainWindow!.once('ready-to-show', () => { clearTimeout(fallback); resolve(); });
  });

  await mainWindow.loadURL(startUrl);
  await readyToShow;

  // 11. Hide splash and show main window with fade
  hideSplash();
  mainWindow.show();
  mainWindow.focus();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Open WhatsApp macOS app — optionally copies PDF to clipboard, then opens chat
ipcMain.handle('open-whatsapp', (_event, { phone, invoiceId, text }: { phone: string; invoiceId: number | null; text: string }) => {
  const digits = phone.replace(/\D/g, '');

  if (invoiceId !== null) {
    const pdfPath = path.join(getPdfStoragePath(), `${invoiceId}.pdf`);
    const script = `set the clipboard to (POSIX file "${pdfPath}")`;
    execFile('osascript', ['-e', script], (err) => {
      if (err) console.error('[WhatsApp] Failed to copy PDF to clipboard:', err.message);
    });
  }

  const url = `whatsapp://send?phone=${digits}&text=${encodeURIComponent(text)}`;
  shell.openExternal(url);
});

// Reveal invoice PDF in macOS Finder
ipcMain.handle('show-pdf-in-finder', (_event, { invoiceId }: { invoiceId: number }) => {
  const pdfPath = path.join(getPdfStoragePath(), `${invoiceId}.pdf`);
  shell.showItemInFolder(pdfPath);
});

// ── Auto-updater ────────────────────────────────────────────────────────────
function setupAutoUpdater(): void {
  if (!app.isPackaged) return; // skip in dev

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
  });

  // Check on launch, then every 4 hours
  autoUpdater.checkForUpdates().catch(console.error);
  setInterval(() => autoUpdater.checkForUpdates().catch(console.error), 4 * 60 * 60 * 1000);
}

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => { launch(); setupAutoUpdater(); }).catch((err) => {
  console.error('[Main] Fatal launch error:', err);
  hideSplash();
  app.quit();
});

// Handle second instance — focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS: re-open window when clicking dock icon
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    launch().catch(console.error);
  } else if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// Clean up on quit
app.on('before-quit', () => {
  stopServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});
