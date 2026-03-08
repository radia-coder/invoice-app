"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
exports.ensureAdminUser = ensureAdminUser;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("./config");
function hashPassword(password) {
    const iterations = 120000;
    const keyLen = 32;
    const digest = 'sha256';
    const salt = crypto_1.default.randomBytes(16).toString('hex');
    const hash = crypto_1.default
        .pbkdf2Sync(password, salt, iterations, keyLen, digest)
        .toString('hex');
    return `pbkdf2$${iterations}$${salt}$${hash}`;
}
function getPrismaCliPath() {
    const resourcesBase = process.resourcesPath
        ?? path_1.default.join(__dirname, '..', 'resources');
    const bundled = path_1.default.join(resourcesBase, 'prisma-cli', 'prisma');
    const localCli = path_1.default.join(__dirname, '..', 'node_modules', '.bin', 'prisma');
    const devCli = path_1.default.join(__dirname, '..', '..', 'node_modules', '.bin', 'prisma');
    for (const p of [bundled, localCli, devCli]) {
        try {
            if (fs_1.default.existsSync(p))
                return p;
        }
        catch { /* skip */ }
    }
    return 'prisma';
}
function getSchemaPath() {
    const resourcesBase = process.resourcesPath
        ?? path_1.default.join(__dirname, '..', 'resources');
    const bundled = path_1.default.join(resourcesBase, 'schema.desktop.prisma');
    const local = path_1.default.join(__dirname, '..', 'prisma', 'schema.desktop.prisma');
    const dev = path_1.default.join(__dirname, '..', '..', 'prisma', 'schema.desktop.prisma');
    for (const p of [bundled, local, dev]) {
        try {
            if (fs_1.default.existsSync(p))
                return p;
        }
        catch { /* skip */ }
    }
    return local;
}
function findSeedDb() {
    const resourcesBase = process.resourcesPath
        ?? path_1.default.join(__dirname, '..', 'resources');
    // In packaged app: resources/seed.db
    const bundled = path_1.default.join(resourcesBase, 'seed.db');
    // In dev mode: project root/prisma/seed.db
    const dev1 = path_1.default.join(__dirname, '..', 'prisma', 'seed.db');
    const dev2 = path_1.default.join(__dirname, '..', '..', 'prisma', 'seed.db');
    for (const p of [bundled, dev1, dev2]) {
        if (fs_1.default.existsSync(p))
            return p;
    }
    return null;
}
async function normalizeDateFormats() {
    // Prisma 6 stores DateTime as integer milliseconds in SQLite, but data
    // imported from PostgreSQL/Supabase uses ISO text strings. Normalize all
    // text-format dates to integers so ORDER BY behaves correctly.
    const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
    const prisma = new PrismaClient();
    try {
        const tables = [
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
            await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = CAST(strftime('%s', "${column}") * 1000 AS INTEGER) WHERE typeof("${column}") = 'text'`);
        }
        console.log('[DB] Date formats normalized.');
    }
    catch (err) {
        console.error('[DB] Date normalization error:', err?.message ?? err);
    }
    finally {
        await prisma.$disconnect();
    }
}
async function runMigrations() {
    console.log('[DB] Setting up database...');
    const dbPath = (0, config_1.getDbPath)();
    // First launch: copy pre-populated seed.db so all 200 invoices are available
    if (!fs_1.default.existsSync(dbPath)) {
        const seedDb = findSeedDb();
        if (seedDb) {
            console.log('[DB] First launch — copying seed database with all invoices...');
            fs_1.default.copyFileSync(seedDb, dbPath);
            console.log('[DB] Database ready at', dbPath);
            return; // seed.db is already migrated; no need to run db push
        }
        console.log('[DB] No seed database found — creating fresh database...');
    }
    // Existing db: apply any schema updates
    try {
        const prismaCli = getPrismaCliPath();
        const schemaPath = getSchemaPath();
        (0, child_process_1.execFileSync)(prismaCli, ['db', 'push', '--skip-generate', '--accept-data-loss', `--schema=${schemaPath}`], {
            env: { ...process.env },
            stdio: 'pipe',
            timeout: 60000,
        });
        console.log('[DB] Schema up to date.');
    }
    catch (err) {
        console.error('[DB] Schema push error:', err?.message ?? err);
        // Non-fatal — continue with existing schema
    }
    await normalizeDateFormats();
}
async function ensureAdminUser() {
    console.log('[DB] Checking for admin user...');
    try {
        const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
        const prisma = new PrismaClient();
        try {
            const existing = await prisma.user.findFirst({
                where: { role: 'super_admin' },
            });
            if (!existing) {
                console.log('[DB] Creating admin user...');
                await prisma.user.create({
                    data: {
                        email: config_1.ADMIN_EMAIL,
                        password_hash: hashPassword(config_1.ADMIN_PASSWORD),
                        role: 'super_admin',
                        company_id: null,
                    },
                });
                console.log('[DB] Admin user created.');
            }
            else {
                console.log('[DB] Admin user already exists.');
            }
        }
        finally {
            await prisma.$disconnect();
        }
    }
    catch (err) {
        console.error('[DB] Error ensuring admin user:', err?.message ?? err);
    }
}
//# sourceMappingURL=db-setup.js.map