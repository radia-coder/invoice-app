# Deploy Next.js App to Google Cloud VM + Hostinger Domain

This guide explains how to deploy a Next.js application to a Google Cloud VM and connect it with a Hostinger domain.

---

## Overview

- **Hosting**: Google Cloud VM (Virtual Machine)
- **Domain**: Hostinger (subdomain: invoice.khitma.com)
- **SSL**: Let's Encrypt (free HTTPS)
- **Process Manager**: PM2
- **Web Server**: Nginx (reverse proxy)

---

## PART 1: Create Google Cloud VM

### Step 1: Create Google Cloud Account

1. Go to https://cloud.google.com
2. Click "Get started for free"
3. Sign in with your Google account
4. Add your credit card (Google gives $300 free credits for 90 days)

### Step 2: Create a New VM

1. Go to https://console.cloud.google.com
2. Search for "VM instances" in the search bar
3. Click "Enable" if asked to enable Compute Engine API
4. Click "Create Instance"

### Step 3: Configure Your VM

| Setting | Value |
|---------|-------|
| Name | `invoice-app` |
| Region | Choose one close to your users |
| Zone | Any zone is fine |
| Machine type | `e2-small` (2 vCPU, 2GB RAM) |
| Boot disk | Ubuntu 22.04 LTS, 20 GB |
| Firewall | Check "Allow HTTP traffic" |
| | Check "Allow HTTPS traffic" |

5. Click "Create"
6. Wait 1-2 minutes for the VM to start
7. Note down the **External IP** address

---

## PART 2: Connect to Your VM

1. In the VM instances page, find your VM
2. Click the "SSH" button on the right side
3. A black terminal window will open in your browser

---

## PART 3: Install Everything on Server

Run these commands one by one in the SSH terminal:

### Update the Server

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Install Nginx

```bash
sudo apt install -y nginx
```

### Install PM2

```bash
sudo npm install -g pm2
```

### Install Git

```bash
sudo apt install -y git
```

### Install Chromium (for Puppeteer PDF generation)

```bash
sudo apt install -y chromium-browser
```

### Verify Installations

```bash
node --version && npm --version && git --version
```

---

## PART 4: Upload Your Project

### Option A: If code is NOT on GitHub yet

On your local computer:

```bash
cd /path/to/your/project
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Create Personal Access Token (for private repos)

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" > "Generate new token (classic)"
3. Note: `server-access`
4. Expiration: 90 days or No expiration
5. Check the `repo` scope
6. Click "Generate token"
7. Copy the token (you can only see it once!)

### Clone on Server

On the SSH terminal:

```bash
cd ~
git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git invoice-app
cd invoice-app
```

---

## PART 5: Set Up the App

### Install Dependencies

```bash
npm install
```

### Create Environment File

```bash
echo 'DATABASE_URL="file:./dev.db"' > .env
```

### Set Up Database

```bash
npx prisma generate
npx prisma db push
```

### Build the App

```bash
npm run build
```

### Start with PM2

```bash
pm2 start npm --name "invoice" -- start
pm2 status
```

### Make PM2 Start on Reboot

```bash
pm2 startup
```

Copy and run the command it shows, then:

```bash
pm2 save
```

---

## PART 6: Configure Nginx

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/invoice
```

Paste this (replace with your domain):

```nginx
server {
    listen 80 default_server;
    server_name invoice.khitma.com YOUR_VM_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save: Ctrl + X, then Y, then Enter

### Enable the Configuration

```bash
sudo ln -sf /etc/nginx/sites-available/invoice /etc/nginx/sites-enabled/invoice
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## PART 7: Connect Hostinger Domain

### If using a subdomain (recommended if you have existing website):

1. Log in to Hostinger
2. Go to Domains > Your domain > DNS / Nameservers
3. Add an A record:
   - Type: A
   - Name: `invoice` (or your subdomain name)
   - Points to: YOUR_VM_IP
   - TTL: 3600
4. Click "Add Record"
5. Wait 5-30 minutes for DNS propagation

### Check DNS

```bash
ping invoice.khitma.com -c 3
```

Or visit https://dnschecker.org

---

## PART 8: Set Up HTTPS (SSL)

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Get SSL Certificate

```bash
sudo certbot --nginx -d invoice.khitma.com
```

Answer the prompts:
1. Enter your email
2. Agree to terms (Y)
3. Share email (N)

### Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

---

## Useful Commands

| Task | Command |
|------|---------|
| Check app status | `pm2 status` |
| View app logs | `pm2 logs invoice` |
| Restart app | `pm2 restart invoice` |
| Stop app | `pm2 stop invoice` |
| Restart Nginx | `sudo systemctl restart nginx` |
| Check Nginx config | `sudo nginx -t` |
| View Nginx logs | `sudo tail -f /var/log/nginx/error.log` |

---

## Updating Your App

When you push changes to GitHub:

```bash
cd ~/invoice-app
git pull
npm install
npm run build
pm2 restart invoice
```

---

## Backup Recommendations

### Database Backup

Your SQLite database is at: `~/invoice-app/prisma/dev.db`

Create a backup script:

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d-%H%M)
cp ~/invoice-app/prisma/dev.db ~/backups/db-$DATE.db
find ~/backups -name "*.db" -mtime +7 -delete
```

### PDF Backup

Your PDFs are stored at: `~/invoice-app/storage/pdfs/`

---

## Troubleshooting

### App not showing?

```bash
pm2 logs invoice
curl http://localhost:3000
```

### Nginx error?

```bash
sudo nginx -t
sudo systemctl status nginx
```

### SSL certificate issues?

```bash
sudo certbot renew --dry-run
```

---

## Your Deployment Details

| Item | Value |
|------|-------|
| VM IP | 35.192.161.58 |
| Domain | https://invoice.khitma.com |
| App Directory | ~/invoice-app |
| Database | ~/invoice-app/prisma/dev.db |
| PDF Storage | ~/invoice-app/storage/pdfs/ |

---

## Data Storage

All data is stored on your Google Cloud VM:

| Data | Location |
|------|----------|
| Invoice data | `prisma/dev.db` (SQLite) |
| PDF files | `storage/pdfs/` |

**Important**: Set up regular backups! If the VM is deleted, all data is lost.
