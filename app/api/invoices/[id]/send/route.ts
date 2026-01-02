import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import puppeteer from 'puppeteer';
import { generateInvoiceHTML, InvoiceData } from '@/components/InvoiceTemplate';
import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const getPdfBuffer = async (invoice: any) => {
  const pdfDir = path.join(process.cwd(), 'storage', 'pdfs');
  const pdfPath = path.join(pdfDir, `${invoice.id}.pdf`);
  try {
    const stats = await fs.stat(pdfPath);
    if (stats.mtimeMs >= invoice.updated_at.getTime()) {
      return await fs.readFile(pdfPath);
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
        <script src="https://cdn.tailwindcss.com"></script>
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

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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

  return pdfBuffer;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response, isSuperAdmin } = await requireApiAuth();
    if (response) return response;

    const { id } = await params;
    const invoiceId = parseInt(id);
    const body = await request.json();
    const to = String(body?.to || '').trim();
    const message = String(body?.message || '');

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { company: true, driver: true, loads: true, deductions: true }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    if (!isSuperAdmin && invoice.company_id !== user?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const recipient = to || invoice.driver.email;
    if (!recipient) {
      return NextResponse.json({ error: 'Recipient email is required.' }, { status: 400 });
    }

    if (!process.env.SMTP_HOST) {
      return NextResponse.json({ error: 'SMTP is not configured.' }, { status: 500 });
    }

    const pdfBuffer = await getPdfBuffer(invoice);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'invoices@example.com',
      to: recipient,
      subject: `Invoice ${invoice.invoice_number}`,
      text: message || `Attached is invoice ${invoice.invoice_number}.`,
      attachments: [
        {
          filename: `${invoice.invoice_number}.pdf`,
          content: pdfBuffer
        }
      ]
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: invoice.status === 'paid' ? 'paid' : 'sent',
        sent_at: invoice.sent_at || new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send invoice error:', error);
    return NextResponse.json({ error: 'Failed to send invoice.' }, { status: 500 });
  }
}
