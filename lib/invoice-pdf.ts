import puppeteer, { type Browser } from 'puppeteer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { generateInvoiceHTML, type InvoiceData } from '@/components/InvoiceTemplate';
import { invoicePdfStyles } from '@/lib/invoice-pdf-styles';

const PDF_DIR = path.join(process.cwd(), 'storage', 'pdfs');
const LOGO_CACHE_DIR = path.join(process.cwd(), 'storage', 'logo-cache');

type InvoicePdfInput = InvoiceData & {
  id: number;
  updated_at: Date;
};

const getBrowser = async (): Promise<Browser> => {
  const globalWithBrowser = globalThis as typeof globalThis & {
    __invoicePdfBrowserPromise?: Promise<Browser>;
  };

  if (!globalWithBrowser.__invoicePdfBrowserPromise) {
    const args = ['--disable-dev-shm-usage', '--disable-gpu'];
    if (process.env.PUPPETEER_NO_SANDBOX === 'true') {
      args.push('--no-sandbox', '--disable-setuid-sandbox');
    }

    globalWithBrowser.__invoicePdfBrowserPromise = puppeteer.launch({
      headless: true,
      args,
    });

    globalWithBrowser.__invoicePdfBrowserPromise.catch(() => {
      delete globalWithBrowser.__invoicePdfBrowserPromise;
    });
  }

  return globalWithBrowser.__invoicePdfBrowserPromise;
};

const buildInvoiceHtml = (invoiceData: InvoiceData) => {
  const componentHtml = generateInvoiceHTML(invoiceData);
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoiceData.invoice_number}</title>
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
};

const getLogoDataUrl = async (logoUrl: string | null | undefined) => {
  if (!logoUrl) return null;
  const trimmed = logoUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return null;

  const hash = crypto.createHash('sha1').update(trimmed).digest('hex');
  const cachePath = path.join(LOGO_CACHE_DIR, `${hash}.txt`);

  try {
    const cached = await fs.readFile(cachePath, 'utf8');
    if (cached.startsWith('data:')) {
      return cached;
    }
  } catch {
    // cache miss
  }

  try {
    const response = await fetch(trimmed, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;

    await fs.mkdir(LOGO_CACHE_DIR, { recursive: true });
    await fs.writeFile(cachePath, dataUrl, 'utf8');
    return dataUrl;
  } catch {
    return null;
  }
};

export async function getInvoicePdfBuffer(
  invoice: InvoicePdfInput
): Promise<Buffer> {
  const pdfPath = path.join(PDF_DIR, `${invoice.id}.pdf`);

  try {
    const stats = await fs.stat(pdfPath);
    if (stats.mtimeMs >= invoice.updated_at.getTime()) {
      return await fs.readFile(pdfPath);
    }
  } catch {
    // Cache miss, continue to generate.
  }

  const logoDataUrl = await getLogoDataUrl(invoice.company?.logo_url);
  const invoiceWithLogo: InvoiceData = logoDataUrl
    ? {
        ...invoice,
        company: {
          ...invoice.company,
          logo_url: logoDataUrl,
        },
      }
    : invoice;

  const html = buildInvoiceHtml(invoiceWithLogo);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    await fs.mkdir(PDF_DIR, { recursive: true });
    await fs.writeFile(pdfPath, pdfBuffer);

    return pdfBuffer;
  } finally {
    await page.close();
  }
}
