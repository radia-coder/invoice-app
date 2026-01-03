import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { generateInvoiceHTML, InvoiceData } from '@/components/InvoiceTemplate';
import { invoicePdfStyles } from '@/lib/invoice-pdf-styles';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { public_token: token },
    include: {
      company: true,
      driver: true,
      loads: true,
      deductions: true
    }
  });

  if (!invoice || (invoice.public_token_expires_at && invoice.public_token_expires_at < new Date())) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const pdfDir = path.join(process.cwd(), 'storage', 'pdfs');
  const pdfPath = path.join(pdfDir, `${invoice.id}.pdf`);

  try {
    const stats = await fs.stat(pdfPath);
    if (stats.mtimeMs >= invoice.updated_at.getTime()) {
      const cached = await fs.readFile(pdfPath);
      return new NextResponse(cached as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`
        }
      });
    }
  } catch {
    // cache miss
  }

  const invoiceData: InvoiceData = {
    ...invoice,
    company: invoice.company,
    driver: invoice.driver,
    loads: invoice.loads,
    deductions: invoice.deductions
  };

  const componentHtml = generateInvoiceHTML(invoiceData);
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoice.invoice_number}</title>
        <style>${invoicePdfStyles}</style>
        <style>
           @page { margin: 20px; }
           body { -webkit-print-color-adjust: exact; }
        </style>
      </head>
      <body>
        ${componentHtml}
      </body>
    </html>
  `;

  const args = ['--disable-dev-shm-usage', '--disable-gpu'];
  if (process.env.PUPPETEER_NO_SANDBOX === 'true') {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }
  const browser = await puppeteer.launch({
    headless: true,
    args
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  await browser.close();

  await fs.mkdir(pdfDir, { recursive: true });
  await fs.writeFile(pdfPath, pdfBuffer);

  return new NextResponse(pdfBuffer as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`
    }
  });
}
