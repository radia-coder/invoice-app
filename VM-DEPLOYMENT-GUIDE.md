# Deployment Guide for Google Cloud VM

**Your VM Path**: `sucaadarif@invoiceapp:~/invoice-app`

---

## 🚀 Quick Deployment Steps

### Step 1: SSH into Your VM

```bash
# From your local machine
ssh sucaadarif@invoiceapp
cd ~/invoice-app
```

### Step 2: Pull Latest Changes

```bash
# Pull the new code
git pull origin main

# You should see:
# - 15 files changed, 5697 insertions(+), 723 deletions(-)
# - New features: Sentry, PostgreSQL, backups, PDF cleanup
```

### Step 3: Install New Dependencies

```bash
# Install Sentry and other new packages
npm install
```

### Step 4: Choose Your Database Strategy

You have **two options**:

---

## OPTION A: Stay with SQLite (Quick - No Migration Needed)

If you want to keep SQLite for now and migrate later:

### 1. Revert Schema to SQLite

```bash
nano prisma/schema.prisma

# Change line 9 from:
#   provider = "postgresql"
# To:
#   provider = "sqlite"
```

### 2. Reinstall SQLite Dependencies

```bash
npm install better-sqlite3 @prisma/adapter-better-sqlite3 --save
```

### 3. Regenerate Prisma Client

```bash
npx prisma generate
```

### 4. Set Up Backups and Cleanup

```bash
# Test backup
npm run backup-db

# Test PDF cleanup (dry run)
npm run cleanup-pdfs -- --dry-run

# Set up automated backups (daily at 2 AM)
crontab -e
# Add this line:
0 2 * * * cd ~/invoice-app && npm run backup-db >> /var/log/invoice-backup.log 2>&1

# Set up PDF cleanup (monthly on 1st at 3 AM)
0 3 1 * * cd ~/invoice-app && npm run cleanup-pdfs >> /var/log/pdf-cleanup.log 2>&1
```

### 5. Rebuild and Restart

```bash
# Build the application
npm run build

# Restart with PM2
pm2 restart invoice

# Check status
pm2 status
pm2 logs invoice --lines 50
```

**You're done!** ✅ You now have backups and PDF cleanup with SQLite.

---

## OPTION B: Migrate to PostgreSQL (Recommended - Better for Production)

### 1. Set Up PostgreSQL on Supabase (Easiest - Free)

```bash
# 1. Go to https://supabase.com
# 2. Sign in with GitHub
# 3. Click "New Project"
# 4. Fill in:
#    - Name: invoice-app
#    - Database Password: (generate a strong one)
#    - Region: Choose closest to your VM location
# 5. Wait 2-3 minutes for project creation
# 6. Go to Settings → Database → Connection String
# 7. Copy the "URI" connection string
```

### 2. Backup Current SQLite Database

```bash
cd ~/invoice-app

# Create backup
npm run backup-db

# Verify backup exists
ls -lh ~/backups/invoice-db/
```

### 3. Update .env File

```bash
nano .env

# Add/update these lines:
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Example:
# DATABASE_URL="postgresql://postgres.abcdefgh:your_password@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# Optional: Add Sentry for error monitoring
# Sign up at https://sentry.io and add:
# NEXT_PUBLIC_SENTRY_DSN="https://your-key@sentry.io/project-id"

# Save and exit (Ctrl+X, then Y, then Enter)
```

### 4. Run PostgreSQL Migration

```bash
# Generate Prisma client for PostgreSQL
npx prisma generate

# Run migrations to create tables
npx prisma migrate deploy
```

### 5. Migrate Data from SQLite to PostgreSQL

**Option 5a: Using pgloader (Recommended)**

```bash
# Install pgloader
sudo apt update
sudo apt install -y pgloader

# Create migration config
cat > ~/migrate-to-postgres.load << 'EOF'
LOAD DATABASE
  FROM sqlite://prisma/dev.db
  INTO postgresql://postgres.[YOUR-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512 MB';
EOF

# IMPORTANT: Replace [YOUR-REF] and [YOUR-PASSWORD] in the file above
nano ~/migrate-to-postgres.load

# Run migration
cd ~/invoice-app
pgloader ~/migrate-to-postgres.load
```

**Option 5b: Manual Export/Import (If pgloader fails)**

```bash
# Export from SQLite
sqlite3 prisma/dev.db .dump > sqlite-export.sql

# You'll need to manually clean up the SQL and import
# See MIGRATION-GUIDE.md for detailed steps
```

### 6. Verify Data Migration

```bash
# Run Prisma Studio to check data
npx prisma studio

# Open in browser: http://localhost:5555
# Check that all records are present:
# - Companies
# - Drivers
# - Invoices
# - InvoiceLoads
# - InvoiceDeductions
# - Users
```

### 7. Test the Application

```bash
# Build
npm run build

# Start in development mode to test
npm run dev

# Open: http://your-vm-ip:3000
# Test:
# - Login works
# - Dashboard shows invoices
# - Can create new invoice
# - PDF generation works
# - Reports export works
```

### 8. Deploy to Production

```bash
# Stop dev mode (Ctrl+C)

# Restart production with PM2
pm2 restart invoice

# Check logs
pm2 logs invoice --lines 100

# Monitor for errors
pm2 monit
```

### 9. Set Up Automated Backups

```bash
# PostgreSQL backups work automatically with the script
# Set up cron job
crontab -e

# Add these lines:
# Backup daily at 2 AM
0 2 * * * cd ~/invoice-app && npm run backup-db >> /var/log/invoice-backup.log 2>&1

# PDF cleanup monthly on 1st at 3 AM
0 3 1 * * cd ~/invoice-app && npm run cleanup-pdfs >> /var/log/pdf-cleanup.log 2>&1

# Save and exit
```

### 10. Optional: Set Up Google Cloud Storage for Backups

```bash
# Install Google Cloud SDK (if not already installed)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Create bucket for backups
gsutil mb gs://invoice-backups-$(date +%s)

# Note the bucket name, then add to .env
nano .env
# Add:
# GCS_BACKUP_BUCKET="invoice-backups-1234567890"

# Test backup with cloud upload
npm run backup-db
```

---

## 📋 Post-Deployment Checklist

- [ ] Code pulled from GitHub
- [ ] Dependencies installed (`npm install`)
- [ ] Database configured (SQLite or PostgreSQL)
- [ ] Environment variables updated (`.env`)
- [ ] Migrations run (`npx prisma migrate deploy`)
- [ ] Data migrated (if using PostgreSQL)
- [ ] Application built (`npm run build`)
- [ ] PM2 restarted (`pm2 restart invoice`)
- [ ] Application tested (login, create invoice, PDF, export)
- [ ] Backups scheduled (crontab)
- [ ] PDF cleanup scheduled (crontab)
- [ ] Logs checked (`pm2 logs invoice`)

---

## 🔍 Troubleshooting

### Issue: "Module not found" errors after npm install

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npx prisma generate
npm run build
pm2 restart invoice
```

### Issue: Prisma migration fails

```bash
# Check DATABASE_URL
cat .env | grep DATABASE_URL

# Test connection (PostgreSQL)
psql "$DATABASE_URL" -c "SELECT version();"

# Force reset (CAUTION: This will delete data)
npx prisma migrate reset
```

### Issue: PM2 won't restart

```bash
# Check PM2 status
pm2 list

# Delete and recreate
pm2 delete invoice
pm2 start npm --name "invoice" -- start
pm2 save
```

### Issue: Backup script fails

```bash
# Check if backup directory exists
mkdir -p ~/backups/invoice-db

# Test manually
./scripts/backup-database.sh

# Check logs
cat /var/log/invoice-backup.log
```

### Issue: PDF cleanup fails

```bash
# Check if storage directory exists
mkdir -p ~/invoice-app/storage/pdfs

# Test dry-run
npm run cleanup-pdfs -- --dry-run

# Check permissions
ls -la ~/invoice-app/storage/pdfs
```

---

## 📊 Monitoring

### Check Application Status

```bash
# PM2 status
pm2 status

# Recent logs
pm2 logs invoice --lines 100

# Monitor in real-time
pm2 monit
```

### Check Disk Space

```bash
# Overall disk usage
df -h

# PDF storage
du -sh ~/invoice-app/storage/pdfs/

# Database size (SQLite)
du -sh ~/invoice-app/prisma/dev.db

# Backup size
du -sh ~/backups/invoice-db/
```

### Check Backups

```bash
# List recent backups
ls -lht ~/backups/invoice-db/ | head -n 10

# Test restore (with confirmation prompt)
npm run restore-db ~/backups/invoice-db/invoice-db-2026-01-04-020000.sql.gz
```

### View Cron Jobs

```bash
# List scheduled tasks
crontab -l

# View cron logs
grep CRON /var/log/syslog | tail -n 20
```

---

## 🎯 Quick Commands Reference

```bash
# Navigate to app
cd ~/invoice-app

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Restart application
pm2 restart invoice

# View logs
pm2 logs invoice

# Backup database
npm run backup-db

# Clean up PDFs
npm run cleanup-pdfs

# Check status
pm2 status && df -h

# Monitor real-time
pm2 monit
```

---

## 🆘 Emergency Rollback

If something goes wrong:

### Rollback Code

```bash
cd ~/invoice-app
git log --oneline -5  # See recent commits
git checkout <previous-commit-hash>
npm install
npm run build
pm2 restart invoice
```

### Rollback Database (PostgreSQL → SQLite)

```bash
# Restore SQLite backup
npm run restore-db ~/backups/invoice-db/invoice-db-YYYY-MM-DD-*.db.gz

# Update schema
nano prisma/schema.prisma
# Change provider to "sqlite"

# Reinstall SQLite packages
npm install better-sqlite3 @prisma/adapter-better-sqlite3

# Update .env
nano .env
# Change: DATABASE_URL="file:./prisma/dev.db"

# Rebuild
npx prisma generate
npm run build
pm2 restart invoice
```

---

## ✅ Success Indicators

After successful deployment, you should see:

1. **PM2 Status**: `online` with uptime > 0s
2. **Application**: Accessible at https://invoice.khitma.com
3. **Login**: Working with your credentials
4. **Dashboard**: Shows existing invoices
5. **Create Invoice**: Can create new invoices
6. **PDF Generation**: PDFs download successfully
7. **Backups**: Daily backups in `~/backups/invoice-db/`
8. **Logs**: No errors in `pm2 logs invoice`

---

## 📞 Need Help?

- **Check logs**: `pm2 logs invoice`
- **Check documentation**: `cat MIGRATION-GUIDE.md`
- **Email**: maahir.engineer@gmail.com

---

**Last Updated**: January 4, 2026
**Your VM**: sucaadarif@invoiceapp:~/invoice-app
**App URL**: https://invoice.khitma.com

cd ~/invoice-app
git pull origin main
npm run build
pm2 restart all
