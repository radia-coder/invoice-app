# Multi-Company Invoice Generator

A Next.js web application for generating driver settlement invoices for trucking companies.

## Features

- **Company & Driver Management**: Pre-seeded with 5 companies and specific drivers.
- **Invoice Creation**: Add loads, calculate percentage deductions, and add fixed deductions (fuel, toll, etc.).
- **PDF Generation**: Professional PDF export using server-side rendering (Puppeteer).
- **History**: View and re-download past invoices.
- **Editing**: Edit existing invoices.
- **Auth & Company Scoping**: Basic session auth with company-level access control.
- **Invoice Lifecycle**: Draft/Sent/Paid with due dates and tax percentage.
- **Reports**: Filtered summaries by company, driver, and date range.
- **CSV Import/Export**: Load and deduction CSV tools.
- **Email Sending**: Send invoice PDFs via SMTP.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite (via Prisma ORM)
- **Styling**: Tailwind CSS
- **PDF**: Puppeteer + React Render
- **Language**: TypeScript

## Setup Instructions

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Database Setup**
   Initialize the SQLite database and apply migrations:

   ```bash
   # Apply all pending migrations and generate Prisma Client
   npx prisma migrate dev

   # Or seed the database if needed:
   npx prisma db seed

   # To view/manage database in Prisma Studio:
   npx prisma studio
   ```

3. **Environment Variables**
   Create a `.env` with at least:

   ```bash
   AUTH_SECRET=dev-only-secret
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=admin12345
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your-user
   SMTP_PASS=your-pass
   SMTP_FROM=invoices@example.com
   ```

4. **Run Development Server**

   ```bash
   npm run dev
   ```

5. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000).

## Usage

1. Click "New Invoice" on the dashboard.
2. Select a Company (Drivers list updates automatically).
3. Select a Driver.
4. Add Loads (Date, Ref, From, To, Amount).
5. Verify Percentage Deduction (default is 12%, editable).
6. Add Fixed Deductions (Fuel, etc.).
7. Click "Preview" to see the invoice.
8. Click "Save Invoice".
9. On the Dashboard or Invoice Page, click "Download PDF".

## Testing

```bash
npm run test
```

## Project Structure

- `app/`: Next.js App Router pages and API routes.
- `components/`: React components (InvoiceForm, InvoiceTemplate).
- `lib/`: Utilities (Prisma client).
- `prisma/`: Database schema and seed script.

cc1b0634749badcc97e77ce779381ca86ab029e1758f2dd25c1334e0e3fdad23

AUTH_SECRET="cc1b0634749badcc97e77ce779381ca86ab029e1758f2dd25c1334e0e3fdad23"
ADMIN_EMAIL=maahir.engineer@gmail.com
ADMIN_PASSWORD=Maahir@12345

UPDATE User SET email = 'maahir.engineer@gmail.com', password_hash = 'pbkdf2$120000$2f3e7f943aa1efb6592af11a5187851e$fa1f58088c3182f5f25a35e481333961af4f2de4e39751532c1f86f0be6a1a56' WHERE role = 'super_admin';
.quit

