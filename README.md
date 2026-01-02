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
   Initialize the SQLite database and seed the initial data:
   ```bash
   npx prisma migrate dev --name init
   # Seed runs automatically after migration, but if needed:
   npx prisma db seed
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
