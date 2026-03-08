/**
 * One-time migration: reads ALL data from Supabase (PostgreSQL via Prisma)
 * and writes it into a local SQLite seed database using Node's built-in sqlite.
 *
 * Run BEFORE changing prisma/schema.prisma to sqlite:
 *   node scripts/import-from-supabase.js
 *
 * If DATABASE_URL has already been changed to sqlite, set:
 *   SUPABASE_DATABASE_URL="postgresql://..." node scripts/import-from-supabase.js
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'prisma', 'seed.db');
const PROJECT_ROOT = path.join(__dirname, '..');

function toSqlite(val) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val;
}

async function main() {
  // Validate source URL
  const sourceUrl =
    process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!sourceUrl.startsWith('postgresql://') && !sourceUrl.startsWith('postgres://')) {
    console.error('\nERROR: No PostgreSQL URL found.');
    console.error(
      'DATABASE_URL must point to Supabase, or set SUPABASE_DATABASE_URL=postgresql://...\n'
    );
    process.exit(1);
  }

  // Step 1: Create SQLite schema via prisma db push
  console.log('\n[1/9] Creating SQLite schema at:', DB_PATH);
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('      Deleted existing seed.db');
  }
  execSync(
    'npx prisma db push --schema=prisma/schema.desktop.prisma --accept-data-loss --skip-generate',
    {
      cwd: PROJECT_ROOT,
      env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
      stdio: 'inherit',
    }
  );
  console.log('      Schema created.\n');

  // Step 2: Open SQLite (Node 22+ built-in)
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(DB_PATH);
  sqlite.exec('PRAGMA foreign_keys = OFF');
  sqlite.exec('PRAGMA journal_mode = WAL');

  // Step 3: Connect to Supabase using existing Prisma client (postgresql)
  console.log('[2/9] Connecting to Supabase...');
  const { PrismaClient } = require('@prisma/client');
  const pg = new PrismaClient({
    datasources: { db: { url: sourceUrl } },
  });

  try {
    // ── Companies ──────────────────────────────────────────────────────────
    console.log('[3/9] Migrating Companies...');
    const companies = await pg.company.findMany({ orderBy: { id: 'asc' } });
    const insertCompany = sqlite.prepare(`
      INSERT INTO "Company" (id, name, address, email, phone, logo_url, brand_color,
        invoice_template, default_percent, default_tax_percent, default_currency,
        factoring_rate, dispatch_rate, auto_deduction_base, invoice_prefix,
        footer_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of companies) {
      insertCompany.run(
        c.id, c.name, c.address, c.email, c.phone, c.logo_url, c.brand_color,
        c.invoice_template, c.default_percent, c.default_tax_percent, c.default_currency,
        c.factoring_rate, c.dispatch_rate, c.auto_deduction_base, c.invoice_prefix,
        c.footer_note, toSqlite(c.created_at)
      );
    }
    console.log(`      ✓ ${companies.length} companies`);

    // ── Drivers ────────────────────────────────────────────────────────────
    console.log('[4/9] Migrating Drivers...');
    const drivers = await pg.driver.findMany({ orderBy: { id: 'asc' } });
    const insertDriver = sqlite.prepare(`
      INSERT INTO "Driver" (id, company_id, name, truck_number, type, email,
        whatsapp_number, whatsapp_link, address, default_percent_override, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const d of drivers) {
      insertDriver.run(
        d.id, d.company_id, d.name, d.truck_number, d.type, d.email,
        d.whatsapp_number, d.whatsapp_link, d.address, d.default_percent_override,
        d.status, toSqlite(d.created_at)
      );
    }
    console.log(`      ✓ ${drivers.length} drivers`);

    // ── Invoices ───────────────────────────────────────────────────────────
    console.log('[5/9] Migrating Invoices...');
    const invoices = await pg.invoice.findMany({ orderBy: { id: 'asc' } });
    const insertInvoice = sqlite.prepare(`
      INSERT INTO "Invoice" (id, company_id, driver_id, invoice_number, public_token,
        public_token_expires_at, week_start, week_end, invoice_date, percent, tax_percent,
        status, due_date, sent_at, paid_at, notes, currency, manual_net_pay,
        credit_payback, created_at, updated_at, last_opened_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const inv of invoices) {
      insertInvoice.run(
        inv.id, inv.company_id, inv.driver_id, inv.invoice_number,
        inv.public_token, toSqlite(inv.public_token_expires_at),
        toSqlite(inv.week_start), toSqlite(inv.week_end), toSqlite(inv.invoice_date),
        inv.percent, inv.tax_percent, inv.status,
        toSqlite(inv.due_date), toSqlite(inv.sent_at), toSqlite(inv.paid_at),
        inv.notes, inv.currency, inv.manual_net_pay, inv.credit_payback,
        toSqlite(inv.created_at), toSqlite(inv.updated_at), toSqlite(inv.last_opened_at)
      );
    }
    console.log(`      ✓ ${invoices.length} invoices`);

    // ── InvoiceLoads ───────────────────────────────────────────────────────
    console.log('[6/9] Migrating InvoiceLoads...');
    const loads = await pg.invoiceLoad.findMany({ orderBy: { id: 'asc' } });
    const insertLoad = sqlite.prepare(`
      INSERT INTO "InvoiceLoad" (id, invoice_id, load_ref, vendor, from_location,
        to_location, load_date, delivery_date, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of loads) {
      insertLoad.run(
        l.id, l.invoice_id, l.load_ref, l.vendor, l.from_location,
        l.to_location, toSqlite(l.load_date), toSqlite(l.delivery_date), l.amount
      );
    }
    console.log(`      ✓ ${loads.length} loads`);

    // ── InvoiceDeductions ──────────────────────────────────────────────────
    console.log('[7/9] Migrating InvoiceDeductions...');
    const deductions = await pg.invoiceDeduction.findMany({ orderBy: { id: 'asc' } });
    const insertDeduction = sqlite.prepare(`
      INSERT INTO "InvoiceDeduction" (id, invoice_id, deduction_type, amount, note, deduction_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const d of deductions) {
      insertDeduction.run(
        d.id, d.invoice_id, d.deduction_type, d.amount, d.note, toSqlite(d.deduction_date)
      );
    }
    console.log(`      ✓ ${deductions.length} deductions`);

    // ── InvoiceCredits ─────────────────────────────────────────────────────
    console.log('[8/9] Migrating InvoiceCredits...');
    const credits = await pg.invoiceCredit.findMany({ orderBy: { id: 'asc' } });
    const insertCredit = sqlite.prepare(`
      INSERT INTO "InvoiceCredit" (id, invoice_id, credit_type, amount, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const c of credits) {
      insertCredit.run(c.id, c.invoice_id, c.credit_type, c.amount, c.note);
    }
    console.log(`      ✓ ${credits.length} credits`);

    // ── DeductionTypes & CreditTypes ───────────────────────────────────────
    console.log('[9/9] Migrating DeductionTypes & CreditTypes...');
    const dedTypes = await pg.deductionType.findMany({ orderBy: { id: 'asc' } });
    const insertDedType = sqlite.prepare(`
      INSERT OR IGNORE INTO "DeductionType" (id, name, company_id, is_default, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const t of dedTypes) {
      insertDedType.run(t.id, t.name, t.company_id, toSqlite(t.is_default), toSqlite(t.created_at));
    }

    const credTypes = await pg.creditType.findMany({ orderBy: { id: 'asc' } });
    const insertCredType = sqlite.prepare(`
      INSERT OR IGNORE INTO "CreditType" (id, name, company_id, is_default, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const t of credTypes) {
      insertCredType.run(t.id, t.name, t.company_id, toSqlite(t.is_default), toSqlite(t.created_at));
    }
    console.log(`      ✓ ${dedTypes.length} deduction types, ${credTypes.length} credit types`);

    console.log('\n========================================');
    console.log('Migration complete!');
    console.log(`seed.db created at: ${DB_PATH}`);
    console.log('========================================\n');
  } finally {
    await pg.$disconnect();
    sqlite.close();
  }
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message || err);
  process.exit(1);
});
