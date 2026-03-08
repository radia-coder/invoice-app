'use strict';
/**
 * One-time migration: reads all data from local SQLite (seed.db)
 * and writes it into Neon (PostgreSQL) via Prisma.
 *
 * Run: node scripts/migrate-sqlite-to-neon.js
 *
 * Requires DATABASE_URL to point to Neon (set in .env).
 */

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { PrismaClient } = require('@prisma/client');

const DB_PATH = path.join(__dirname, '..', 'prisma', 'seed.db');

function fromSqlite(val, type) {
  if (val === null || val === undefined) return null;
  if (type === 'bool') return val === 1 || val === true;
  if (type === 'date') return val ? new Date(val) : null;
  return val;
}

async function main() {
  console.log('\n[migrate-sqlite-to-neon] Starting migration...');
  console.log(`  Source: ${DB_PATH}`);
  console.log(`  Target: Neon (DATABASE_URL)\n`);

  const sqlite = new DatabaseSync(DB_PATH, { open: true });
  const pg = new PrismaClient();

  try {
    // ── Companies ─────────────────────────────────────────────────────────
    const companies = sqlite.prepare('SELECT * FROM "Company" ORDER BY id').all();
    console.log(`[1/9] Companies: ${companies.length}`);
    for (const c of companies) {
      await pg.company.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          name: c.name,
          address: c.address,
          email: c.email,
          phone: c.phone,
          logo_url: c.logo_url,
          brand_color: c.brand_color,
          invoice_template: c.invoice_template ?? 'classic',
          default_percent: c.default_percent ?? 12.0,
          default_tax_percent: c.default_tax_percent ?? 0.0,
          default_currency: c.default_currency ?? 'USD',
          factoring_rate: c.factoring_rate ?? 2.0,
          dispatch_rate: c.dispatch_rate ?? 6.0,
          auto_deduction_base: c.auto_deduction_base ?? 'YTD_INSURANCE',
          invoice_prefix: c.invoice_prefix ?? 'INV-',
          footer_note: c.footer_note,
          created_at: fromSqlite(c.created_at, 'date') ?? new Date(),
        },
      });
    }
    console.log(`  ✓ ${companies.length} companies inserted`);

    // ── Drivers ───────────────────────────────────────────────────────────
    const drivers = sqlite.prepare('SELECT * FROM "Driver" ORDER BY id').all();
    console.log(`[2/9] Drivers: ${drivers.length}`);
    for (const d of drivers) {
      await pg.driver.upsert({
        where: { id: d.id },
        update: {},
        create: {
          id: d.id,
          company_id: d.company_id,
          name: d.name,
          truck_number: d.truck_number,
          type: d.type ?? 'Company Driver',
          email: d.email,
          whatsapp_number: d.whatsapp_number,
          whatsapp_link: d.whatsapp_link,
          address: d.address,
          default_percent_override: d.default_percent_override,
          status: d.status ?? 'active',
          created_at: fromSqlite(d.created_at, 'date') ?? new Date(),
        },
      });
    }
    console.log(`  ✓ ${drivers.length} drivers inserted`);

    // ── DeductionTypes ────────────────────────────────────────────────────
    const dedTypes = sqlite.prepare('SELECT * FROM "DeductionType" ORDER BY id').all();
    console.log(`[3/9] DeductionTypes: ${dedTypes.length}`);
    for (const t of dedTypes) {
      await pg.deductionType.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          name: t.name,
          company_id: t.company_id,
          is_default: fromSqlite(t.is_default, 'bool') ?? false,
          created_at: fromSqlite(t.created_at, 'date') ?? new Date(),
        },
      });
    }
    console.log(`  ✓ ${dedTypes.length} deduction types inserted`);

    // ── CreditTypes ───────────────────────────────────────────────────────
    const credTypes = sqlite.prepare('SELECT * FROM "CreditType" ORDER BY id').all();
    console.log(`[4/9] CreditTypes: ${credTypes.length}`);
    for (const t of credTypes) {
      await pg.creditType.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          name: t.name,
          company_id: t.company_id,
          is_default: fromSqlite(t.is_default, 'bool') ?? false,
          created_at: fromSqlite(t.created_at, 'date') ?? new Date(),
        },
      });
    }
    console.log(`  ✓ ${credTypes.length} credit types inserted`);

    // ── Users ─────────────────────────────────────────────────────────────
    const users = sqlite.prepare('SELECT * FROM "User" ORDER BY id').all();
    console.log(`[5/9] Users: ${users.length}`);
    for (const u of users) {
      await pg.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          email: u.email,
          password_hash: u.password_hash,
          role: u.role ?? 'admin',
          company_id: u.company_id,
          created_at: fromSqlite(u.created_at, 'date') ?? new Date(),
        },
      });
    }
    console.log(`  ✓ ${users.length} users inserted`);

    // ── Invoices ──────────────────────────────────────────────────────────
    const invoices = sqlite.prepare('SELECT * FROM "Invoice" ORDER BY id').all();
    console.log(`[6/9] Invoices: ${invoices.length}`);
    await pg.invoice.createMany({
      data: invoices.map((inv) => ({
        id: inv.id,
        company_id: inv.company_id,
        driver_id: inv.driver_id,
        invoice_number: inv.invoice_number,
        public_token: inv.public_token,
        public_token_expires_at: fromSqlite(inv.public_token_expires_at, 'date'),
        week_start: fromSqlite(inv.week_start, 'date'),
        week_end: fromSqlite(inv.week_end, 'date'),
        invoice_date: fromSqlite(inv.invoice_date, 'date'),
        percent: inv.percent,
        tax_percent: inv.tax_percent ?? 0.0,
        status: inv.status ?? 'draft',
        due_date: fromSqlite(inv.due_date, 'date'),
        sent_at: fromSqlite(inv.sent_at, 'date'),
        paid_at: fromSqlite(inv.paid_at, 'date'),
        notes: inv.notes,
        currency: inv.currency ?? 'USD',
        manual_net_pay: inv.manual_net_pay,
        credit_payback: inv.credit_payback ?? 0,
        created_at: fromSqlite(inv.created_at, 'date') ?? new Date(),
        updated_at: fromSqlite(inv.updated_at, 'date') ?? new Date(),
        last_opened_at: fromSqlite(inv.last_opened_at, 'date'),
      })),
      skipDuplicates: true,
    });
    console.log(`  ✓ ${invoices.length} invoices inserted`);

    // ── InvoiceLoads ──────────────────────────────────────────────────────
    const loads = sqlite.prepare('SELECT * FROM "InvoiceLoad" ORDER BY id').all();
    console.log(`[7/9] InvoiceLoads: ${loads.length}`);
    await pg.invoiceLoad.createMany({
      data: loads.map((l) => ({
        id: l.id,
        invoice_id: l.invoice_id,
        load_ref: l.load_ref,
        vendor: l.vendor,
        from_location: l.from_location,
        to_location: l.to_location,
        load_date: fromSqlite(l.load_date, 'date'),
        delivery_date: fromSqlite(l.delivery_date, 'date'),
        amount: l.amount,
      })),
      skipDuplicates: true,
    });
    console.log(`  ✓ ${loads.length} loads inserted`);

    // ── InvoiceDeductions ─────────────────────────────────────────────────
    const deductions = sqlite.prepare('SELECT * FROM "InvoiceDeduction" ORDER BY id').all();
    console.log(`[8/9] InvoiceDeductions: ${deductions.length}`);
    await pg.invoiceDeduction.createMany({
      data: deductions.map((d) => ({
        id: d.id,
        invoice_id: d.invoice_id,
        deduction_type: d.deduction_type,
        amount: d.amount,
        note: d.note,
        deduction_date: fromSqlite(d.deduction_date, 'date'),
      })),
      skipDuplicates: true,
    });
    console.log(`  ✓ ${deductions.length} deductions inserted`);

    // ── InvoiceCredits ────────────────────────────────────────────────────
    const credits = sqlite.prepare('SELECT * FROM "InvoiceCredit" ORDER BY id').all();
    console.log(`[9/9] InvoiceCredits: ${credits.length}`);
    await pg.invoiceCredit.createMany({
      data: credits.map((c) => ({
        id: c.id,
        invoice_id: c.invoice_id,
        credit_type: c.credit_type,
        amount: c.amount,
        note: c.note,
      })),
      skipDuplicates: true,
    });
    console.log(`  ✓ ${credits.length} credits inserted`);

    console.log('\n========================================');
    console.log('Migration complete! All data is in Neon.');
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
