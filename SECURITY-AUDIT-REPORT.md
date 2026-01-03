# Security Audit Report

**Application**: Invoice Management System
**URL**: https://invoice.khitma.com
**Audit Date**: January 3, 2026
**Auditor**: Claude (Senior Full-Stack Engineer & Security Auditor)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 8 |
| MEDIUM | 10 |
| LOW | 5 |

**Overall Assessment**: The application has functional authentication and authorization but contains several **critical security vulnerabilities** that must be fixed before considering it production-ready for business use.

---

## Stack Confirmation

| Component | Version/Type |
|-----------|--------------|
| Framework | Next.js 16.1.1 |
| Runtime | Node.js 20.x |
| Database | SQLite (via Prisma) |
| ORM | Prisma 6.19.1 |
| Auth | Custom cookie-based sessions (HMAC-SHA256) |
| Password Hashing | PBKDF2-SHA256 (120k iterations) |
| PDF Generation | Puppeteer |
| File Storage | Local disk (`storage/pdfs/`) |
| Email | Nodemailer (Gmail SMTP) |

---

# A) PRIORITY LIST

## CRITICAL (Fix Immediately)

### 1. Weak/Known AUTH_SECRET in Production
**Location**: `/.env:8`, `/lib/session.ts:14`, `/middleware.ts:20`
**Risk**: Complete authentication bypass. Anyone can forge valid session tokens.

**Current Code** (`middleware.ts:20`):
```typescript
const secret = process.env.AUTH_SECRET || 'dev-only-secret';
```

**Current `.env`**:
```
AUTH_SECRET="dev-only-secret"
```

**Impact**: An attacker can create valid session tokens for any user (including super_admin) using the known secret.

**Fix**:
1. Generate a strong secret:
```bash
openssl rand -base64 32
```

2. Update on server:
```bash
# SSH into your server
cd ~/invoice-app
nano .env
# Change AUTH_SECRET to the generated value:
# AUTH_SECRET="your-64-character-random-string-here"
```

3. Remove fallback in code (`lib/session.ts:13-15`):
```typescript
const getSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET environment variable is required');
  return secret;
};
```

4. Update middleware (`middleware.ts:20`):
```typescript
const secret = process.env.AUTH_SECRET;
if (!secret) {
  console.error('AUTH_SECRET not configured');
  return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
}
```

---

### 2. No Rate Limiting on Authentication
**Location**: `/app/api/auth/login/route.ts`
**Risk**: Brute force attacks can crack user passwords.

**How to Reproduce**:
```bash
# An attacker can try thousands of passwords per minute
for i in {1..10000}; do
  curl -X POST https://invoice.khitma.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"attempt'$i'"}'
done
```

**Fix**: Add rate limiting using `@upstash/ratelimit` or implement in-memory rate limiting:

```typescript
// lib/rate-limit.ts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count++;
  return true;
}
```

Update login route (`/app/api/auth/login/route.ts`):
```typescript
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again in 15 minutes.' },
      { status: 429 }
    );
  }
  // ... rest of login logic
}
```

---

### 3. Excessive Session Duration (10 Years)
**Location**: `/lib/session.ts:4`
**Risk**: Stolen tokens remain valid indefinitely. No way to invalidate sessions.

**Current Code**:
```typescript
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365 * 10; // 10 YEARS!
```

**Fix**: Reduce to 7-30 days and implement session refresh:
```typescript
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
```

Also update cookie maxAge in `/app/api/auth/login/route.ts:35`:
```typescript
maxAge: 60 * 60 * 24 * 7 // 7 days instead of 10 years
```

---

### 4. Default Admin Credentials Active
**Location**: `/.env:10-11`, `/prisma/seed.ts:166-167`
**Risk**: Anyone who reads documentation or knows common defaults can access super_admin.

**Current `.env`**:
```
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin12345
```

**Fix**:
1. Change the admin password immediately on the server:
```bash
cd ~/invoice-app
# Create a new password hash
node -e "const {hashPassword} = require('./lib/password'); console.log(hashPassword('YOUR_STRONG_PASSWORD_HERE'))"
```

2. Update directly in database:
```bash
sqlite3 prisma/dev.db
UPDATE User SET password_hash = 'NEW_HASH_FROM_ABOVE' WHERE email = 'admin@example.com';
UPDATE User SET email = 'your-real-email@domain.com' WHERE email = 'admin@example.com';
.quit
```

3. Update `.env` on server with strong values.

---

### 5. SMTP Credentials Exposed in Repository History
**Location**: `/.env:3-7`
**Risk**: Email account compromise if repo is ever exposed.

**Current `.env`**:
```
SMTP_PASS=tbylnrqyelraehit
```

**Fix**:
1. Revoke the current Gmail App Password immediately
2. Generate a new App Password in Google Account settings
3. Update on server only (never commit to git)
4. Ensure `.env` is in `.gitignore` (it is, but verify on server)

---

## HIGH (Fix Within 1 Week)

### 6. No CSRF Protection
**Location**: All POST/PUT/DELETE routes
**Risk**: Cross-site request forgery attacks.

**Fix**: Add CSRF token validation. For Next.js, use the `sameSite: 'strict'` cookie option:

Update `/app/api/auth/login/route.ts:31`:
```typescript
response.cookies.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  sameSite: 'strict', // Changed from 'lax'
  secure: true, // Always true in production
  path: '/',
  maxAge: 60 * 60 * 24 * 7
});
```

---

### 7. Missing Security Headers
**Location**: `/next.config.ts`
**Risk**: XSS, clickjacking, MIME sniffing attacks.

**Fix**: Add security headers in `next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

### 8. Puppeteer Running with --no-sandbox
**Location**: `/app/api/invoices/[id]/pdf/route.tsx:93-94`, `/app/public/invoices/[token]/pdf/route.ts:75-77`
**Risk**: If malicious content reaches the HTML renderer, it could escape the browser sandbox.

**Current Code**:
```typescript
browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
```

**Fix**: Configure proper sandboxing on the server:
```bash
# On your server, install sandbox dependencies
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

Then update Puppeteer config (can keep flags for now but monitor):
```typescript
browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox', // Required for some server environments
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage', // Prevents crashes in low-memory environments
    '--disable-gpu'
  ]
})
```

---

### 9. Public Share Links Never Expire
**Location**: `/app/api/invoices/[id]/share/route.ts`, `/prisma/schema.prisma:57`
**Risk**: Shared invoices remain accessible forever, even after business relationship ends.

**Fix**: Add expiration to share tokens.

1. Update schema (`prisma/schema.prisma`):
```prisma
model Invoice {
  // ... existing fields
  public_token    String?   @unique
  public_token_expires_at DateTime? // ADD THIS
  // ...
}
```

2. Run migration:
```bash
npx prisma migrate dev --name add_share_token_expiry
```

3. Update share route to set expiry (7 days):
```typescript
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
await prisma.invoice.update({
  where: { id: invoiceId },
  data: {
    public_token: token,
    public_token_expires_at: expiresAt
  }
});
```

4. Check expiry in public PDF route:
```typescript
if (!invoice || (invoice.public_token_expires_at && new Date() > invoice.public_token_expires_at)) {
  return NextResponse.json({ error: 'Link expired or not found' }, { status: 404 });
}
```

---

### 10. Console.error Exposes Stack Traces
**Location**: Multiple API routes (9 occurrences)
**Risk**: Information disclosure to attackers.

**Fix**: Create a logging utility:
```typescript
// lib/logger.ts
export function logError(context: string, error: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  } else {
    // In production, log only essential info
    console.error(`[${context}] Error occurred`);
    // Send to monitoring service (Sentry, LogRocket, etc.)
  }
}
```

Replace all `console.error(error)` with `logError('context', error)`.

---

### 11. No Session Invalidation on Logout
**Location**: `/app/api/auth/logout/route.ts`
**Risk**: Old session tokens remain valid after logout.

**Fix**: Implement a token blacklist or use database-stored sessions:
```typescript
// For now, ensure cookie is properly cleared
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0, // Immediate expiration
    expires: new Date(0) // Also set explicit past date
  });
  return response;
}
```

---

### 12. XSS Risk in Invoice Template
**Location**: `/components/InvoiceTemplate.tsx`
**Risk**: User-controlled content (notes, company name, driver name) rendered without sanitization.

**Fix**: Ensure all dynamic content is escaped. In React, JSX auto-escapes, but verify HTML strings:
```typescript
// If using dangerouslySetInnerHTML anywhere, sanitize first
import DOMPurify from 'dompurify';

const sanitizedNotes = DOMPurify.sanitize(invoice.notes || '');
```

---

### 13. Potential Path Traversal in PDF Storage
**Location**: `/app/api/invoices/[id]/pdf/route.tsx:38-39`
**Risk**: If `invoice.id` is manipulated, could access other files.

**Current Code**:
```typescript
const pdfPath = path.join(pdfDir, `${invoice.id}.pdf`);
```

**Analysis**: Currently safe because `invoice.id` comes from database (integer), but add validation:
```typescript
const invoiceId = parseInt(id, 10);
if (isNaN(invoiceId) || invoiceId <= 0) {
  return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
}
```

---

## MEDIUM (Fix Within 1 Month)

### 14. SQLite Not Suitable for Production
**Location**: `/prisma/schema.prisma:9`
**Risk**: Data corruption with concurrent writes, no built-in backup, poor scalability.

**Current**: SQLite file at `prisma/dev.db`

**Recommendation**: Migrate to PostgreSQL for production:
1. Use Supabase (free tier) or Google Cloud SQL
2. Update Prisma schema provider
3. Run migration

---

### 15. No Database Backups Configured
**Location**: Server configuration
**Risk**: Complete data loss if disk fails.

**Fix**: Set up automated backups:
```bash
# Create backup script on server
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y-%m-%d-%H%M)
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR
cp ~/invoice-app/prisma/dev.db $BACKUP_DIR/invoice-db-$DATE.db
# Keep only last 30 days
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
# Optionally upload to Google Cloud Storage
# gsutil cp $BACKUP_DIR/invoice-db-$DATE.db gs://your-bucket/backups/
EOF
chmod +x ~/backup-db.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup-db.sh") | crontab -
```

---

### 16. No Audit Logging
**Location**: All API routes
**Risk**: No trail of who did what, when.

**Fix**: Add audit logging:
```typescript
// lib/audit.ts
import { prisma } from './prisma';

export async function auditLog(
  userId: number | null,
  action: string,
  resource: string,
  resourceId: number | string,
  details?: object
) {
  // Log to console for now, later to database or service
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    userId,
    action,
    resource,
    resourceId,
    details
  }));
}
```

Usage in routes:
```typescript
await auditLog(user.id, 'CREATE', 'invoice', invoice.id, { company_id: invoice.company_id });
```

---

### 17. No Error Monitoring/Alerting
**Risk**: Errors go unnoticed until users complain.

**Fix**: Integrate Sentry (free tier):
```bash
npm install @sentry/nextjs
```

---

### 18. PDF Storage Grows Indefinitely
**Location**: `/storage/pdfs/`
**Risk**: Disk fills up over time.

**Your VM**: 40GB disk, PDFs average ~100KB each = ~400,000 invoices before full.

**Fix**: Implement cleanup policy:
```typescript
// Clean PDFs older than 90 days for invoices that haven't been accessed
// Add to a scheduled job
```

---

### 19. No Input Length Limits
**Location**: `/lib/validation.ts`
**Risk**: Extremely long inputs could cause memory issues.

**Fix**: Add max lengths:
```typescript
export const invoiceInputSchema = z.object({
  // ... existing
  notes: z.string().max(5000).optional().nullable(),
  // ...
});

export const loadSchema = z.object({
  load_ref: z.string().max(100).optional().nullable(),
  from_location: z.string().min(1).max(500),
  to_location: z.string().min(1).max(500),
  // ...
});
```

---

### 20. Email Configuration Uses Gmail
**Location**: `/.env:3-7`
**Risk**: Gmail has sending limits (~500/day), not suitable for business.

**Recommendation**: Use transactional email service:
- SendGrid (free tier: 100/day)
- Mailgun
- Amazon SES

---

### 21. No HTTPS Enforcement in Code
**Location**: `/app/api/auth/login/route.ts:33`
**Risk**: In some configurations, cookies might be sent over HTTP.

**Current Code**:
```typescript
secure: process.env.NODE_ENV === 'production',
```

**Fix**: Always use secure in production:
```typescript
secure: true, // Your server is already HTTPS-only via Nginx
```

---

### 22. Missing Database Indexes
**Location**: `/prisma/schema.prisma`
**Risk**: Slow queries as data grows.

**Fix**: Add indexes for common queries:
```prisma
model Invoice {
  // ... existing
  @@index([company_id, status])
  @@index([company_id, created_at])
  @@index([driver_id, status])
}

model InvoiceLoad {
  // ...
  @@index([invoice_id])
}

model InvoiceDeduction {
  // ...
  @@index([invoice_id])
}
```

---

### 23. No Request Size Limits
**Location**: API routes
**Risk**: Large payloads could cause memory exhaustion.

**Fix**: Add in middleware or Next.js config:
```typescript
// next.config.ts
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
```

---

## LOW (Fix When Convenient)

### 24. Inconsistent Error Messages
**Location**: Various API routes
**Risk**: Makes debugging harder, slight information leakage.

---

### 25. No Health Check Endpoint
**Risk**: Can't easily monitor if app is alive.

**Fix**: Create `/app/api/health/route.ts`:
```typescript
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

---

### 26. Missing Retry Logic for PDF Generation
**Location**: PDF routes
**Risk**: Transient Puppeteer failures cause hard errors.

---

### 27. No Graceful Shutdown Handling
**Risk**: In-progress requests could be lost during deploys.

---

### 28. Environment Variable Validation Missing
**Risk**: App starts with missing config, fails later.

**Fix**: Add startup validation:
```typescript
// lib/env.ts
const requiredEnvVars = ['AUTH_SECRET', 'DATABASE_URL'];

export function validateEnv() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

---

# B) STORAGE ANALYSIS

## Can You Store PDFs for 3 Years on 40GB VM?

### Calculation:

| Factor | Value |
|--------|-------|
| Available disk | ~40 GB |
| System/OS usage | ~5 GB |
| App + node_modules | ~1 GB |
| Database growth (3 years) | ~500 MB |
| **Available for PDFs** | **~33 GB** |
| Average PDF size | ~100-150 KB |
| **Max PDFs at 100KB** | **~330,000** |
| **Max PDFs at 150KB** | **~220,000** |

### Answer: **YES, but with conditions**

**If you create:**
- 100 invoices/month = 3,600 in 3 years = **~500 MB** ✅ Easily fits
- 500 invoices/month = 18,000 in 3 years = **~2.5 GB** ✅ Fits well
- 2,000 invoices/month = 72,000 in 3 years = **~10 GB** ✅ Still fits

### Recommendations for Long-term Storage:

1. **Monitor disk usage**:
```bash
# Add to crontab - alert if disk > 80%
df -h | grep -E '^/dev' | awk '{if(int($5)>80) print "DISK WARNING: "$5" used"}'
```

2. **Implement PDF caching policy**:
   - Keep recent PDFs (last 90 days) on disk
   - Move older PDFs to Google Cloud Storage (~$0.02/GB/month)
   - Re-generate on demand if needed

3. **Consider Google Cloud Storage for PDFs**:
```bash
# Install gsutil and configure
gcloud auth login
gsutil mb gs://invoice-khitma-pdfs

# Modified PDF storage to use GCS for archival
```

---

# C) PRODUCTION READINESS CHECKLIST

## Must Fix Before Production Use

| Item | Status | Priority |
|------|--------|----------|
| Change AUTH_SECRET to strong random value | ❌ | CRITICAL |
| Add rate limiting to login | ❌ | CRITICAL |
| Change admin password | ❌ | CRITICAL |
| Reduce session duration to 7 days | ❌ | CRITICAL |
| Rotate SMTP credentials | ❌ | CRITICAL |
| Add security headers | ❌ | HIGH |
| Add share link expiration | ❌ | HIGH |
| Set up database backups | ❌ | MEDIUM |
| Add disk monitoring | ❌ | MEDIUM |
| Implement audit logging | ❌ | MEDIUM |

## Already Good

| Item | Status |
|------|--------|
| HTTPS enabled | ✅ |
| HTTP-only cookies | ✅ |
| Password hashing (PBKDF2 120k) | ✅ |
| Timing-safe comparison | ✅ |
| Input validation (Zod) | ✅ |
| Company-level data isolation | ✅ |
| Role-based access control | ✅ |
| Foreign key constraints | ✅ |
| Cascade deletes configured | ✅ |

---

# D) TOP 10 IMPROVEMENTS (Priority Order)

1. **Change AUTH_SECRET** - 5 minutes, fixes critical vulnerability
2. **Add rate limiting to login** - 30 minutes, prevents brute force
3. **Change admin credentials** - 5 minutes, removes known default
4. **Reduce session TTL to 7 days** - 5 minutes, limits token theft impact
5. **Add security headers** - 15 minutes, prevents XSS/clickjacking
6. **Set up automated backups** - 30 minutes, protects against data loss
7. **Add share link expiration** - 1 hour, improves data privacy
8. **Implement rate limiting on all APIs** - 2 hours, prevents abuse
9. **Add error monitoring (Sentry)** - 1 hour, catches issues early
10. **Migrate to PostgreSQL** - 2-4 hours, improves reliability

---

# E) NEXT STEPS PLAN

## Immediate (Do Today)

```bash
# 1. SSH into server
ssh your-server

# 2. Generate new AUTH_SECRET
NEW_SECRET=$(openssl rand -base64 32)
echo "New secret: $NEW_SECRET"

# 3. Update .env
cd ~/invoice-app
nano .env
# Change: AUTH_SECRET="your-new-secret-here"
# Change: ADMIN_EMAIL=your-real-email@domain.com
# Change: ADMIN_PASSWORD=a-very-strong-password

# 4. Update admin in database
sqlite3 prisma/dev.db
UPDATE User SET email = 'your-real-email@domain.com' WHERE role = 'super_admin';
.quit

# 5. Restart app
pm2 restart invoice
```

## This Week

1. Update session TTL in code (`lib/session.ts`)
2. Add rate limiting (`lib/rate-limit.ts`)
3. Add security headers (`next.config.ts`)
4. Set up backup script
5. Push changes to GitHub and redeploy

## This Month

1. Add share link expiration
2. Implement audit logging
3. Set up error monitoring
4. Add health check endpoint
5. Consider PostgreSQL migration

---

# F) SUMMARY

Your invoice application has a **solid foundation** with proper authentication patterns, input validation, and role-based access control. However, there are **5 critical issues** that must be fixed immediately:

1. Weak AUTH_SECRET
2. No login rate limiting
3. 10-year session duration
4. Default admin credentials
5. Exposed SMTP credentials

**Time to fix critical issues**: ~1 hour

**Storage verdict**: 40GB is sufficient for 3 years of PDF storage for a small-to-medium business. Implement monitoring and consider cloud storage for archival.

After fixing the critical issues, your app will be suitable for production use with ongoing monitoring and the recommended improvements.
