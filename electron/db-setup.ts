import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ADMIN_EMAIL, ADMIN_PASSWORD, getDbPath } from './config';

function hashPassword(password: string): string {
  const iterations = 120000;
  const keyLen = 32;
  const digest = 'sha256';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, keyLen, digest)
    .toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function getPrismaCliPath(): string {
  const resourcesBase = process.resourcesPath
    ?? path.join(__dirname, '..', 'resources');
  const bundled = path.join(resourcesBase, 'prisma-cli', 'prisma');
  const localCli = path.join(__dirname, '..', 'node_modules', '.bin', 'prisma');
  const devCli = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'prisma');

  for (const p of [bundled, localCli, devCli]) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* skip */ }
  }
  return 'prisma';
}

function getSchemaPath(): string {
  const resourcesBase = process.resourcesPath
    ?? path.join(__dirname, '..', 'resources');
  const bundled = path.join(resourcesBase, 'schema.desktop.prisma');
  const local = path.join(__dirname, '..', 'prisma', 'schema.desktop.prisma');
  const dev = path.join(__dirname, '..', '..', 'prisma', 'schema.desktop.prisma');

  for (const p of [bundled, local, dev]) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* skip */ }
  }
  return local;
}

function findSeedDb(): string | null {
  const resourcesBase = process.resourcesPath
    ?? path.join(__dirname, '..', 'resources');

  // In packaged app: resources/seed.db
  const bundled = path.join(resourcesBase, 'seed.db');
  // In dev mode: project root/prisma/seed.db
  const dev1 = path.join(__dirname, '..', 'prisma', 'seed.db');
  const dev2 = path.join(__dirname, '..', '..', 'prisma', 'seed.db');

  for (const p of [bundled, dev1, dev2]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function normalizeDateFormats(): Promise<void> {
  // Prisma 6 stores DateTime as integer milliseconds in SQLite, but data
  // imported from PostgreSQL/Supabase uses ISO text strings. Normalize all
  // text-format dates to integers so ORDER BY behaves correctly.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const tables: Array<{ table: string; column: string }> = [
      { table: 'Invoice', column: 'week_start' },
      { table: 'Invoice', column: 'week_end' },
      { table: 'Invoice', column: 'invoice_date' },
      { table: 'Invoice', column: 'created_at' },
      { table: 'Invoice', column: 'updated_at' },
      { table: 'Invoice', column: 'due_date' },
      { table: 'Invoice', column: 'sent_at' },
      { table: 'Invoice', column: 'paid_at' },
      { table: 'Invoice', column: 'last_opened_at' },
      { table: 'Invoice', column: 'public_token_expires_at' },
      { table: 'InvoiceLoad', column: 'load_date' },
      { table: 'InvoiceLoad', column: 'delivery_date' },
      { table: 'InvoiceDeduction', column: 'deduction_date' },
      { table: 'UserSession', column: 'created_at' },
      { table: 'UserSession', column: 'expires_at' },
    ];
    for (const { table, column } of tables) {
      await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET "${column}" = CAST(strftime('%s', "${column}") * 1000 AS INTEGER) WHERE typeof("${column}") = 'text'`
      );
    }
    console.log('[DB] Date formats normalized.');
  } catch (err: any) {
    console.error('[DB] Date normalization error:', err?.message ?? err);
  } finally {
    await prisma.$disconnect();
  }
}

export async function runMigrations(): Promise<void> {
  console.log('[DB] Setting up database...');
  const dbPath = getDbPath();

  // First launch: copy pre-populated seed.db so all 200 invoices are available
  if (!fs.existsSync(dbPath)) {
    const seedDb = findSeedDb();
    if (seedDb) {
      console.log('[DB] First launch — copying seed database with all invoices...');
      fs.copyFileSync(seedDb, dbPath);
      console.log('[DB] Database ready at', dbPath);
      return; // seed.db is already migrated; no need to run db push
    }
    console.log('[DB] No seed database found — creating fresh database...');
  }

  // Existing db: apply any schema updates
  try {
    const prismaCli = getPrismaCliPath();
    const schemaPath = getSchemaPath();
    execFileSync(
      prismaCli,
      ['db', 'push', '--skip-generate', '--accept-data-loss', `--schema=${schemaPath}`],
      {
        env: { ...process.env },
        stdio: 'pipe',
        timeout: 60000,
      }
    );
    console.log('[DB] Schema up to date.');
  } catch (err: any) {
    console.error('[DB] Schema push error:', err?.message ?? err);
    // Non-fatal — continue with existing schema
  }

  await normalizeDateFormats();
}

export async function ensureAdminUser(): Promise<void> {
  console.log('[DB] Checking for admin user...');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const existing = await prisma.user.findFirst({
        where: { role: 'super_admin' },
      });

      if (!existing) {
        console.log('[DB] Creating admin user...');
        await prisma.user.create({
          data: {
            email: ADMIN_EMAIL,
            password_hash: hashPassword(ADMIN_PASSWORD),
            role: 'super_admin',
            company_id: null,
          },
        });
        console.log('[DB] Admin user created.');
      } else {
        console.log('[DB] Admin user already exists.');
      }
    } finally {
      await prisma.$disconnect();
    }
  } catch (err: any) {
    console.error('[DB] Error ensuring admin user:', err?.message ?? err);
  }
}
