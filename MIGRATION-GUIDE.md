# Migration Guide: SQLite to PostgreSQL

This guide walks you through migrating your Invoice Management System from SQLite to PostgreSQL.

## Overview

The application has been updated to support PostgreSQL, which provides:
- ✅ Better concurrent write handling
- ✅ Production-ready reliability
- ✅ Better performance at scale
- ✅ Built-in backup and replication
- ✅ Full ACID compliance

---

## Prerequisites

Before starting the migration:

1. **Backup your current SQLite database**
   ```bash
   npm run backup-db
   ```

2. **Set up PostgreSQL database**
   
   Choose one of these options:

   ### Option A: Supabase (Recommended - Free Tier Available)
   
   1. Go to https://supabase.com
   2. Create a new project
   3. Copy the connection string from Settings → Database
   4. Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres`

   ### Option B: Google Cloud SQL
   
   1. Go to https://console.cloud.google.com/sql
   2. Create a PostgreSQL instance
   3. Create a database named `invoice_db`
   4. Get connection string
   
   ### Option C: Local PostgreSQL
   
   ```bash
   # Install PostgreSQL
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   
   # Create database and user
   sudo -u postgres psql
   CREATE DATABASE invoice_db;
   CREATE USER invoice_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE invoice_db TO invoice_user;
   \q
   ```
   
   Connection string: `postgresql://invoice_user:your_secure_password@localhost:5432/invoice_db`

---

## Migration Steps

### Step 1: Update Environment Variables

Update your `.env` file:

```bash
# OLD (SQLite)
# DATABASE_URL="file:./prisma/dev.db"

# NEW (PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/database"

# Example for Supabase:
# DATABASE_URL="postgresql://postgres.abcdefg:your_password@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
```

### Step 2: Export Data from SQLite

```bash
# Export all data to SQL dump
sqlite3 prisma/dev.db .dump > sqlite-export.sql

# OR use the backup script
npm run backup-db
```

### Step 3: Run Prisma Migration

The schema has been updated to use PostgreSQL. Now run the migration:

```bash
# Generate Prisma Client for PostgreSQL
npx prisma generate

# Run migrations to create tables in PostgreSQL
npx prisma migrate deploy

# Alternative: Create migration interactively
npx prisma migrate dev --name init_postgresql
```

### Step 4: Import Data

You have two options for importing data:

#### Option A: Using Prisma Studio (Easier for small datasets)

1. Export from SQLite:
   ```bash
   # Install Prisma Studio if not already installed
   npx prisma studio
   # Manually export data as needed
   ```

2. Use seed script or import manually

#### Option B: Manual SQL Import (Better for large datasets)

1. Convert SQLite dump to PostgreSQL format:
   ```bash
   # Install sqlite3-to-postgres converter
   npm install -g sqlite3-to-postgres
   
   # Convert
   sqlite3-to-postgres --sqlite-file=prisma/dev.db --pg-uri="postgresql://user:pass@host:5432/db"
   ```

2. Or use pgloader:
   ```bash
   sudo apt install pgloader
   
   # Create config file: migration.load
   cat > migration.load << 'EOF'
   LOAD DATABASE
     FROM sqlite://prisma/dev.db
     INTO postgresql://user:password@host:5432/database
   
   WITH include drop, create tables, create indexes, reset sequences
   
   SET work_mem to '16MB', maintenance_work_mem to '512 MB';
   EOF
   
   # Run migration
   pgloader migration.load
   ```

### Step 5: Verify Data Migration

```bash
# Check row counts match
npx prisma studio

# Run a test query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Invoice\";"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Driver\";"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Company\";"
```

### Step 6: Update Application Configuration

The application is already configured for PostgreSQL. Just restart:

```bash
# Development
npm run dev

# Production (if using PM2)
pm2 restart invoice
```

### Step 7: Test the Application

1. **Login** - Verify authentication works
2. **View Dashboard** - Check invoices load correctly
3. **Create Invoice** - Test creating a new invoice
4. **Generate PDF** - Verify PDF generation works
5. **Export Report** - Test Excel export functionality

### Step 8: Set Up Automated Backups

Configure daily PostgreSQL backups:

```bash
# The backup script now supports PostgreSQL automatically
# Set up cron job
crontab -e

# Add this line (runs daily at 2 AM):
0 2 * * * cd /path/to/invoice-app && npm run backup-db >> /var/log/invoice-backup.log 2>&1
```

Optional: Configure Google Cloud Storage for backup archival:

```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Create bucket
gsutil mb gs://invoice-backups-UNIQUE-NAME

# Set environment variable in .env
echo "GCS_BACKUP_BUCKET=invoice-backups-UNIQUE-NAME" >> .env

# Test backup with cloud upload
npm run backup-db
```

---

## New Features After Migration

### 1. Database Indexes

The schema now includes optimized indexes for better query performance:
- `Invoice`: Indexed on company_id, driver_id, status, created_at, and combinations
- `InvoiceLoad`: Indexed on invoice_id, vendor, load_date
- `InvoiceDeduction`: Indexed on invoice_id, deduction_type
- `Driver`: Indexed on company_id, status

### 2. Error Monitoring

Sentry has been integrated for production error tracking:

```bash
# Add to .env file
NEXT_PUBLIC_SENTRY_DSN="https://your-dsn@sentry.io/project-id"
```

Sign up at https://sentry.io and get your DSN from project settings.

### 3. PDF Cleanup

Automated PDF cleanup to prevent disk space issues:

```bash
# Preview cleanup (dry run)
npm run cleanup-pdfs -- --dry-run

# Clean PDFs older than 90 days
npm run cleanup-pdfs

# Custom retention period (180 days)
npm run cleanup-pdfs -- --days 180

# Also remove orphaned PDFs
npm run cleanup-pdfs -- --orphaned
```

Set up monthly cleanup:
```bash
crontab -e
# Add: Run cleanup on 1st of each month at 3 AM
0 3 1 * * cd /path/to/invoice-app && npm run cleanup-pdfs >> /var/log/pdf-cleanup.log 2>&1
```

---

## Rollback Plan

If you need to rollback to SQLite:

### Step 1: Restore SQLite Database

```bash
# Use your backup
cp ~/backups/invoice-db/invoice-db-YYYY-MM-DD-*.db.gz ./
gunzip invoice-db-YYYY-MM-DD-*.db.gz
mv invoice-db-YYYY-MM-DD-*.db prisma/dev.db
```

### Step 2: Update Schema

```bash
# Edit prisma/schema.prisma
# Change:
#   provider = "postgresql"
# To:
#   provider = "sqlite"

# Reinstall SQLite dependencies
npm install better-sqlite3 @prisma/adapter-better-sqlite3 @types/better-sqlite3 --save
```

### Step 3: Update .env

```bash
# Change back to SQLite
DATABASE_URL="file:./prisma/dev.db"
```

### Step 4: Restart Application

```bash
npx prisma generate
npm run dev
# or
pm2 restart invoice
```

---

## Performance Tuning (PostgreSQL)

### Connection Pooling

For production, consider using connection pooling:

```bash
# Supabase provides built-in pooling
# Use the "pooler" connection string

# For other providers, use PgBouncer
sudo apt install pgbouncer

# Configure in /etc/pgbouncer/pgbouncer.ini
[databases]
invoice_db = host=localhost port=5432 dbname=invoice_db

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
```

Update DATABASE_URL to use PgBouncer:
```
DATABASE_URL="postgresql://user:password@localhost:6432/invoice_db?pgbouncer=true"
```

### Database Maintenance

Schedule regular maintenance tasks:

```bash
# Create maintenance script
cat > /usr/local/bin/invoice-db-maintenance.sh << 'EOF'
#!/bin/bash
psql $DATABASE_URL << SQL
  VACUUM ANALYZE "Invoice";
  VACUUM ANALYZE "InvoiceLoad";
  VACUUM ANALYZE "InvoiceDeduction";
  REINDEX DATABASE invoice_db;
SQL
EOF

chmod +x /usr/local/bin/invoice-db-maintenance.sh

# Add to crontab (weekly on Sunday at 4 AM)
0 4 * * 0 /usr/local/bin/invoice-db-maintenance.sh
```

---

## Troubleshooting

### Issue: "relation does not exist" errors

**Solution**: Run migrations
```bash
npx prisma migrate deploy
```

### Issue: Connection timeout

**Solution**: Check firewall and database access rules
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# For Supabase/Cloud SQL, ensure IP is whitelisted
```

### Issue: Slow queries after migration

**Solution**: Analyze and optimize
```bash
# Check query performance
psql $DATABASE_URL
EXPLAIN ANALYZE SELECT * FROM "Invoice" WHERE company_id = 1;

# Update statistics
ANALYZE "Invoice";
```

### Issue: Out of connections

**Solution**: Adjust connection limits
```bash
# Check current connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Increase max connections (in PostgreSQL config)
ALTER SYSTEM SET max_connections = 200;
SELECT pg_reload_conf();
```

---

## Post-Migration Checklist

- [ ] Database migrated successfully
- [ ] All data verified (row counts match)
- [ ] Application tested thoroughly
- [ ] Automated backups configured
- [ ] Sentry error monitoring set up
- [ ] PDF cleanup scheduled
- [ ] Performance monitoring in place
- [ ] Team notified of new infrastructure
- [ ] Old SQLite backup archived securely
- [ ] Documentation updated

---

## Support

If you encounter issues during migration:

1. **Check logs**: 
   ```bash
   pm2 logs invoice
   ```

2. **Verify environment variables**:
   ```bash
   cat .env | grep DATABASE_URL
   ```

3. **Test database connection**:
   ```bash
   psql $DATABASE_URL -c "SELECT version();"
   ```

4. **Rollback if needed** (see Rollback Plan above)

---

## Benefits Summary

After completing this migration, you'll have:

✅ **Better Performance**
- Optimized indexes for faster queries
- Connection pooling support
- Better concurrent access handling

✅ **Production Reliability**
- Automated daily backups
- Error monitoring with Sentry
- Better crash recovery

✅ **Scalability**
- Handle more concurrent users
- Larger dataset support
- Cloud-ready infrastructure

✅ **Maintenance**
- Automated PDF cleanup
- Easy backup/restore
- Better monitoring tools

---

**Migration completed successfully?** 🎉

Update your team documentation and remove the old SQLite file after confirming everything works for 7+ days.
