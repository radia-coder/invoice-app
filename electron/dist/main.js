"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const config_1 = require("./config");
const server_1 = require("./server");
const db_setup_1 = require("./db-setup");
const splash_1 = require("./splash");
// Prevent multiple instances
if (!electron_1.app.requestSingleInstanceLock()) {
    electron_1.app.quit();
    process.exit(0);
}
let mainWindow = null;
function createMainWindow(loggedIn) {
    const win = new electron_1.BrowserWindow({
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
            preload: path_1.default.join(__dirname, 'preload.js'),
            webSecurity: true,
        },
    });
    // When logged in, intercept any page-initiated navigation to /login
    // and redirect back to /dashboard instead (e.g. if cookie expires)
    if (loggedIn) {
        win.webContents.on('will-navigate', (event, url) => {
            if (url.includes('/login')) {
                event.preventDefault();
                win.loadURL(`http://localhost:${config_1.PORT}/dashboard`);
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
async function launch() {
    // 0. Set dock icon (works in dev mode; packaged builds use electron-builder.yml)
    if (process.platform === 'darwin') {
        // Try PNG first (more reliable in dev), fall back to .icns
        const pngPath = path_1.default.join(__dirname, '..', '..', 'LogoInvoice-icon.png');
        const icnsPath = path_1.default.join(__dirname, '..', '..', 'build', 'icon.icns');
        try {
            electron_1.app.dock?.setIcon(pngPath);
        }
        catch {
            try {
                electron_1.app.dock?.setIcon(icnsPath);
            }
            catch { /* ignore */ }
        }
    }
    // 1. Show splash immediately
    (0, splash_1.showSplash)();
    // 2. Set up all environment variables
    (0, config_1.setupEnvironment)();
    // 3. Inject X-Electron-App header into all requests
    electron_1.session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['X-Electron-App'] = 'true';
        callback({ requestHeaders: details.requestHeaders });
    });
    // 4. Start Next.js standalone server
    (0, server_1.startServer)();
    // 5. Wait for server to be ready
    await (0, server_1.waitForServer)(45000);
    // 6. Run database migrations
    await (0, db_setup_1.runMigrations)();
    // 7. Ensure admin user exists
    await (0, db_setup_1.ensureAdminUser)();
    // 8. Create main window (hidden)
    // Auth is handled server-side via x-electron-app header — no login needed
    mainWindow = createMainWindow(true);
    // 9. Load dashboard directly
    const startUrl = `http://localhost:${config_1.PORT}/dashboard`;
    // Listen for first paint before loadURL so we don't miss it
    // 10s fallback in case ready-to-show never fires
    const readyToShow = new Promise((resolve) => {
        const fallback = setTimeout(resolve, 10000);
        mainWindow.once('ready-to-show', () => { clearTimeout(fallback); resolve(); });
    });
    await mainWindow.loadURL(startUrl);
    await readyToShow;
    // 11. Hide splash and show main window with fade
    (0, splash_1.hideSplash)();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// Open WhatsApp macOS app — optionally copies PDF to clipboard, then opens chat
electron_1.ipcMain.handle('open-whatsapp', (_event, { phone, invoiceId, text }) => {
    const digits = phone.replace(/\D/g, '');
    if (invoiceId !== null) {
        const pdfPath = path_1.default.join((0, config_1.getPdfStoragePath)(), `${invoiceId}.pdf`);
        const script = `set the clipboard to (POSIX file "${pdfPath}")`;
        (0, child_process_1.execFile)('osascript', ['-e', script], (err) => {
            if (err)
                console.error('[WhatsApp] Failed to copy PDF to clipboard:', err.message);
        });
    }
    const url = `whatsapp://send?phone=${digits}&text=${encodeURIComponent(text)}`;
    electron_1.shell.openExternal(url);
});
// Reveal invoice PDF in macOS Finder
electron_1.ipcMain.handle('show-pdf-in-finder', (_event, { invoiceId }) => {
    const pdfPath = path_1.default.join((0, config_1.getPdfStoragePath)(), `${invoiceId}.pdf`);
    electron_1.shell.showItemInFolder(pdfPath);
});
electron_1.app.whenReady().then(launch).catch((err) => {
    console.error('[Main] Fatal launch error:', err);
    (0, splash_1.hideSplash)();
    electron_1.app.quit();
});
// Handle second instance — focus existing window
electron_1.app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
    }
});
// macOS: re-open window when clicking dock icon
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        launch().catch(console.error);
    }
    else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
});
// Clean up on quit
electron_1.app.on('before-quit', () => {
    (0, server_1.stopServer)();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        (0, server_1.stopServer)();
        electron_1.app.quit();
    }
});
//# sourceMappingURL=main.js.map