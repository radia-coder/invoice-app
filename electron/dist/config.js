"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_PASSWORD = exports.ADMIN_EMAIL = exports.PORT = void 0;
exports.getUserDataPath = getUserDataPath;
exports.getDbPath = getDbPath;
exports.getAuthSecretPath = getAuthSecretPath;
exports.getLogoCachePath = getLogoCachePath;
exports.getPdfStoragePath = getPdfStoragePath;
exports.setupEnvironment = setupEnvironment;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
exports.PORT = 3421;
exports.ADMIN_EMAIL = 'admin@invoiceapp.local';
exports.ADMIN_PASSWORD = 'desktop-admin-2026';
function getUserDataPath() {
    return electron_1.app.getPath('userData');
}
function getDbPath() {
    return path_1.default.join(getUserDataPath(), 'invoice.db');
}
function getAuthSecretPath() {
    return path_1.default.join(getUserDataPath(), '.auth_secret');
}
function getLogoCachePath() {
    return path_1.default.join(getUserDataPath(), 'logo-cache');
}
function getPdfStoragePath() {
    return path_1.default.join(os_1.default.homedir(), 'Downloads', 'invoices');
}
function readOrGenerateAuthSecret() {
    const secretPath = getAuthSecretPath();
    try {
        const existing = fs_1.default.readFileSync(secretPath, 'utf8').trim();
        if (existing && existing.length >= 32) {
            return existing;
        }
    }
    catch {
        // file does not exist yet
    }
    const secret = crypto_1.default.randomBytes(32).toString('hex');
    fs_1.default.writeFileSync(secretPath, secret, { mode: 0o600 });
    return secret;
}
function setupEnvironment() {
    const userData = getUserDataPath();
    // Ensure all required directories exist
    fs_1.default.mkdirSync(userData, { recursive: true });
    fs_1.default.mkdirSync(getLogoCachePath(), { recursive: true });
    fs_1.default.mkdirSync(getPdfStoragePath(), { recursive: true });
    const authSecret = readOrGenerateAuthSecret();
    const dbPath = getDbPath();
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.AUTH_SECRET = authSecret;
    process.env.ADMIN_EMAIL = exports.ADMIN_EMAIL;
    process.env.ADMIN_PASSWORD = exports.ADMIN_PASSWORD;
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.PORT = String(exports.PORT);
    process.env.PDF_STORAGE_PATH = getPdfStoragePath();
    fs_1.default.mkdirSync(getPdfStoragePath(), { recursive: true });
    process.env.PUPPETEER_NO_SANDBOX = 'true';
    process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
    process.env.STORAGE_PATH = userData;
    // Point Puppeteer to bundled Chromium
    const chromiumMac = path_1.default.join(process.resourcesPath ?? path_1.default.join(__dirname, '..', 'resources'), 'chromium', 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
    if (fs_1.default.existsSync(chromiumMac)) {
        process.env.PUPPETEER_EXECUTABLE_PATH = chromiumMac;
    }
}
//# sourceMappingURL=config.js.map