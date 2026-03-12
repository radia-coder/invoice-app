import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { generateInvoiceHTML, type InvoiceData } from '@/components/InvoiceTemplate';
import { invoicePdfStyles } from '@/lib/invoice-pdf-styles';

const STORAGE_BASE = process.env.STORAGE_PATH ?? path.join(process.cwd(), 'storage');
const PDF_DIR = process.env.PDF_STORAGE_PATH ?? path.join(STORAGE_BASE, 'pdfs');
const LOGO_CACHE_DIR = path.join(STORAGE_BASE, 'logo-cache');
const A4_WIDTH_PX = Math.round((210 / 25.4) * 96);
const A4_HEIGHT_PX = Math.round((297 / 25.4) * 96);
const PDF_MARGIN_PX = 20;
const MIN_PDF_SCALE = 0.1;

const formatPdfDate = (value: string | Date | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
};

const sanitizeFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '');

export const buildInvoicePdfFilename = (
  driverName: string | null | undefined,
  dueDate: string | Date | null | undefined,
  fallbackInvoiceNumber: string
) => {
  const safeName = driverName ? sanitizeFilenamePart(driverName) : '';
  const datePart = formatPdfDate(dueDate);
  const baseName = [safeName, datePart].filter(Boolean).join(' ');

  if (!baseName) {
    const fallback = sanitizeFilenamePart(fallbackInvoiceNumber || 'Invoice');
    return `${fallback || 'Invoice'}.pdf`;
  }

  return `${baseName}.pdf`;
};

type InvoicePdfInput = InvoiceData & {
  id: number;
  updated_at: Date;
};

const launchBrowser = async (): Promise<Browser> => {
  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    headless: chromium.headless,
    executablePath,
    args: chromium.args,
  });

  browser.on('disconnected', () => {
    const globalWithBrowser = globalThis as typeof globalThis & {
      __invoicePdfBrowserPromise?: Promise<Browser>;
    };
    delete globalWithBrowser.__invoicePdfBrowserPromise;
  });

  return browser;
};

const resetBrowser = async (reason?: string) => {
  if (reason) {
    console.warn(`[PDF] Resetting browser: ${reason}`);
  }

  const globalWithBrowser = globalThis as typeof globalThis & {
    __invoicePdfBrowserPromise?: Promise<Browser>;
  };

  const existing = globalWithBrowser.__invoicePdfBrowserPromise;
  delete globalWithBrowser.__invoicePdfBrowserPromise;

  if (!existing) return;

  try {
    const browser = await existing;
    if (browser.isConnected()) {
      await browser.close();
    }
  } catch {
    // Ignore failures during cleanup.
  }
};

const getBrowser = async (): Promise<Browser> => {
  const globalWithBrowser = globalThis as typeof globalThis & {
    __invoicePdfBrowserPromise?: Promise<Browser>;
  };

  if (!globalWithBrowser.__invoicePdfBrowserPromise) {
    globalWithBrowser.__invoicePdfBrowserPromise = launchBrowser();
    globalWithBrowser.__invoicePdfBrowserPromise.catch(() => {
      delete globalWithBrowser.__invoicePdfBrowserPromise;
    });
  }

  const browser = await globalWithBrowser.__invoicePdfBrowserPromise;
  if (!browser.isConnected()) {
    await resetBrowser('Browser disconnected before use');
    return getBrowser();
  }

  return browser;
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
           @page {
             margin: 0;
             size: A4;
           }
           body {
             -webkit-print-color-adjust: exact;
             margin: 0;
             overflow: hidden;
           }
           #invoice-container {
             page-break-inside: avoid;
             page-break-after: avoid;
             page-break-before: avoid;
             overflow: hidden;
           }
           #invoice-container * {
             page-break-inside: avoid;
           }
        </style>
      </head>
      <body>
        ${componentHtml}
      </body>
    </html>
  `;
};

const getInvoiceContentHeight = async (page: Page) =>
  page.evaluate(() => {
    const container = document.getElementById('invoice-container');
    const height = container?.getBoundingClientRect().height ?? document.documentElement.scrollHeight;
    return Math.ceil(height);
  });

const computePdfScale = (contentHeight: number) => {
  // Use more conservative margins to maximize content area
  const printableHeight = A4_HEIGHT_PX - PDF_MARGIN_PX * 2;
  if (contentHeight <= printableHeight) return 1;
  // Add 5% buffer to ensure content definitely fits
  const scale = (printableHeight * 0.95) / contentHeight;
  return Math.max(MIN_PDF_SCALE, Math.min(1, Number(scale.toFixed(3))));
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

const isConnectionClosedError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as Error;
  if (maybeError.name === 'ConnectionClosedError') return true;
  return /connection closed/i.test(maybeError.message || '');
};

const generatePdfBuffer = async (html: string) => {
  const browser = await getBrowser();
  let page: Page | null = null;
  try {
    console.log('Creating new page...');
    page = await browser.newPage();

    console.log('Setting viewport and loading content...');
    await page.setViewport({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.emulateMediaType('screen');

    console.log('Calculating dimensions...');
    const contentHeight = await getInvoiceContentHeight(page);
    const scale = computePdfScale(contentHeight);

    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      scale,
      timeout: 30000
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        console.error('Failed to close page:', closeError);
      }
    }
    // Close the browser after each PDF so it doesn't sit in RAM while idle.
    await resetBrowser();
  }
};

export async function getInvoicePdfBuffer(
  invoice: InvoicePdfInput
): Promise<Buffer> {
  const pdfPath = path.join(PDF_DIR, `${invoice.id}.pdf`);

  try {
    const stats = await fs.stat(pdfPath);
    if (stats.mtimeMs >= invoice.updated_at.getTime()) {
      console.log(`Using cached PDF for invoice ${invoice.id}`);
      return await fs.readFile(pdfPath);
    }
  } catch {
    // Cache miss, continue to generate.
  }

  console.log(`Generating PDF for invoice ${invoice.id}...`);

  try {
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
    let buffer: Buffer | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        console.log('Launching browser...');
        buffer = await generatePdfBuffer(html);
        break;
      } catch (error) {
        if (attempt === 0 && isConnectionClosedError(error)) {
          await resetBrowser('Connection closed during PDF generation');
          continue;
        }
        throw error;
      }
    }

    if (!buffer) {
      throw new Error('PDF generation failed: Unknown error');
    }

    try {
      console.log('Saving PDF to cache...');
      await fs.mkdir(PDF_DIR, { recursive: true });
      await fs.writeFile(pdfPath, buffer);
    } catch (cacheError) {
      console.warn('Failed to cache PDF:', cacheError);
    }

    console.log(`PDF generated successfully for invoice ${invoice.id}`);
    return buffer;
  } catch (error) {
    console.error(`PDF generation failed for invoice ${invoice.id}:`, error);
    throw new Error(
      `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
