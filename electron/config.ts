import { app } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';

export const PORT = 3421;
export const ADMIN_EMAIL = 'admin@invoiceapp.local';
export const ADMIN_PASSWORD = 'desktop-admin-2026';

export function getUserDataPath(): string {
  return app.getPath('userData');
}

export function getDbPath(): string {
  return path.join(getUserDataPath(), 'invoice.db');
}

export function getAuthSecretPath(): string {
  return path.join(getUserDataPath(), '.auth_secret');
}

export function getLogoCachePath(): string {
  return path.join(getUserDataPath(), 'logo-cache');
}

export function getPdfStoragePath(): string {
  return path.join(os.homedir(), 'Downloads', 'invoices');
}

function readOrGenerateAuthSecret(): string {
  const secretPath = getAuthSecretPath();
  try {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing && existing.length >= 32) {
      return existing;
    }
  } catch {
    // file does not exist yet
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, secret, { mode: 0o600 });
  return secret;
}

export function setupEnvironment(): void {
  const userData = getUserDataPath();

  // Ensure all required directories exist
  fs.mkdirSync(userData, { recursive: true });
  fs.mkdirSync(getLogoCachePath(), { recursive: true });
  fs.mkdirSync(getPdfStoragePath(), { recursive: true });

  const authSecret = readOrGenerateAuthSecret();
  const dbPath = getDbPath();

  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.AUTH_SECRET = authSecret;
  process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  Object.assign(process.env, { NODE_ENV: 'production' });
  process.env.PORT = String(PORT);
  process.env.PDF_STORAGE_PATH = getPdfStoragePath();
  fs.mkdirSync(getPdfStoragePath(), { recursive: true });
  process.env.PUPPETEER_NO_SANDBOX = 'true';
  process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
  process.env.STORAGE_PATH = userData;

  // Point Puppeteer to bundled Chromium
  const chromiumMac = path.join(
    process.resourcesPath ?? path.join(__dirname, '..', 'resources'),
    'chromium',
    'chrome-mac',
    'Chromium.app',
    'Contents',
    'MacOS',
    'Chromium'
  );
  if (fs.existsSync(chromiumMac)) {
    process.env.PUPPETEER_EXECUTABLE_PATH = chromiumMac;
  }
}
