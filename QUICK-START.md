# Quick Start Guide

Get your Invoice Management System up and running in minutes.

---

## 🚀 New Installation

### 1. Clone and Install

```bash
cd ~/Downloads/Invoice/invoice\ Final\ V5\ 
npm install
```

### 2. Set Up Database

**Option A: PostgreSQL (Recommended for Production)**

```bash
# Use Supabase (free tier)
# 1. Go to https://supabase.com
# 2. Create project
# 3. Get connection string from Settings → Database

# Or use local PostgreSQL
sudo apt install postgresql
sudo -u postgres createdb invoice_db
sudo -u postgres createuser -P invoice_user
```

**Option B: SQLite (Development Only)**

```bash
# Already configured - just needs migration
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env file
nano .env
```

**Required changes**:
- `DATABASE_URL` - Your database connection string
- `AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `ADMIN_EMAIL` - Your admin email
- `ADMIN_PASSWORD` - Strong password
- `SMTP_*` - Your email settings

### 4. Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed with initial data
npm run seed
```

### 5. Start Application

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Visit: http://localhost:3000

---

## 🔄 Migrating from SQLite

If you're upgrading from SQLite:

```bash
# 1. Backup current database
npm run backup-db

# 2. Follow migration guide
cat MIGRATION-GUIDE.md

# 3. Update DATABASE_URL in .env
nano .env

# 4. Run migrations
npx prisma migrate deploy

# 5. Migrate data (see MIGRATION-GUIDE.md for detailed steps)
```

---

## ⚙️ Production Setup

### 1. Set Up Error Monitoring

```bash
# Sign up at https://sentry.io
# Create a project
# Add DSN to .env:
echo 'NEXT_PUBLIC_SENTRY_DSN="https://your-key@sentry.io/project"' >> .env
```

### 2. Configure Automated Backups

```bash
# Set up daily backups at 2 AM
crontab -e

# Add this line:
0 2 * * * cd /path/to/invoice-app && npm run backup-db >> /var/log/invoice-backup.log 2>&1
```

### 3. Configure PDF Cleanup

```bash
# Set up monthly cleanup
crontab -e

# Add this line (1st of month at 3 AM):
0 3 1 * * cd /path/to/invoice-app && npm run cleanup-pdfs >> /var/log/pdf-cleanup.log 2>&1
```

### 4. Configure Nginx (if applicable)

```bash
# Example Nginx config
server {
    listen 80;
    server_name invoice.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Use PM2 for Process Management

```bash
# Install PM2
npm install -g pm2

# Start app
pm2 start npm --name "invoice" -- start

# Auto-restart on system boot
pm2 startup
pm2 save
```

---

## 📋 Daily Operations

### Backup Database

```bash
npm run backup-db
```

### Restore Database

```bash
npm run restore-db ~/backups/invoice-db/invoice-db-2026-01-04-020000.sql.gz
```

### Clean Up Old PDFs

```bash
# Preview (dry run)
npm run cleanup-pdfs -- --dry-run

# Clean PDFs older than 90 days
npm run cleanup-pdfs

# Custom retention
npm run cleanup-pdfs -- --days 180
```

### Check Application Status

```bash
# If using PM2
pm2 status
pm2 logs invoice

# If running directly
ps aux | grep node
```

### View Logs

```bash
# Application logs (PM2)
pm2 logs invoice

# Backup logs
tail -f /var/log/invoice-backup.log

# PDF cleanup logs
tail -f /var/log/pdf-cleanup.log
```

---

## 🔍 Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"

# Check Prisma status
npx prisma studio
```

### PDF Generation Fails

```bash
# Check Puppeteer dependencies
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2
```

### Email Not Sending

```bash
# Test SMTP connection
telnet smtp.gmail.com 587

# Check logs for errors
pm2 logs invoice | grep -i smtp
```

### Application Won't Start

```bash
# Check environment variables
cat .env | grep -v '^#'

# Regenerate Prisma client
npx prisma generate

# Clear Next.js cache
rm -rf .next
npm run build
```

---

## 📊 Monitoring

### Check Storage Usage

```bash
# Overall disk space
df -h

# PDF storage
du -sh storage/pdfs/

# Database size (PostgreSQL)
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('invoice_db'));"
```

### Check Error Rates

Visit your Sentry dashboard: https://sentry.io

### Check Backup Status

```bash
# List recent backups
ls -lh ~/backups/invoice-db/ | tail -n 10

# Check backup size
du -sh ~/backups/invoice-db/
```

---

## 🆘 Emergency Procedures

### Application Crashed

```bash
# Using PM2
pm2 restart invoice

# Without PM2
cd /path/to/invoice-app
npm run build
npm start
```

### Data Corruption Detected

```bash
# Restore from latest backup
LATEST_BACKUP=$(ls -t ~/backups/invoice-db/*.sql.gz | head -n1)
npm run restore-db $LATEST_BACKUP

# Restart application
pm2 restart invoice
```

### Disk Space Full

```bash
# Emergency PDF cleanup (delete all PDFs older than 30 days)
npm run cleanup-pdfs -- --days 30

# Clean old backups
find ~/backups/invoice-db/ -name "*.gz" -mtime +7 -delete

# Clear system logs
sudo journalctl --vacuum-time=7d
```

---

## 📚 Additional Resources

- **Migration Guide**: `MIGRATION-GUIDE.md` - SQLite to PostgreSQL migration
- **Deployment Guide**: `DEPLOYMENT-IMPROVEMENTS.md` - Production improvements
- **Security Audit**: `SECURITY-AUDIT-REPORT.md` - Security recommendations
- **Feature Roadmap**: `IMPROVEMENTS.md` - Planned features

---

## ✅ Post-Installation Checklist

- [ ] Database configured and migrated
- [ ] Environment variables set
- [ ] Application starts successfully
- [ ] Can login with admin credentials
- [ ] Can create test invoice
- [ ] Can generate PDF
- [ ] Email sending works
- [ ] Automated backups scheduled
- [ ] PDF cleanup scheduled
- [ ] Sentry error monitoring active
- [ ] SSL certificate configured (production)
- [ ] Domain name configured (production)

---

## 🎯 Next Steps

1. **Customize Company Settings** - Update branding, logo, colors
2. **Add Drivers** - Import or create driver records
3. **Configure Deduction Types** - Set up custom deduction types
4. **Create First Invoice** - Test full workflow
5. **Train Users** - Set up additional admin accounts
6. **Monitor Performance** - Check Sentry for any issues

---

**Need Help?**

- Email: maahir.engineer@gmail.com
- Check logs: `pm2 logs invoice`
- Review documentation in project root
