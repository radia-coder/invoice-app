import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { buildInvoicePdfFilename, getInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { type InvoiceData } from '@/components/InvoiceTemplate';
import {
  buildAutoDeductionEntries,
  calculateAutoDeductions,
  getAutoDeductionConfigFromCompany,
  mergeDeductionsWithAuto,
  sumInsuranceDeductions
} from '@/lib/auto-deductions';

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

  const invoiceData: InvoiceData = {
    ...invoice,
    company: invoice.company,
    driver: invoice.driver,
    loads: invoice.loads,
    deductions: invoice.deductions
  };

  const yearStart = new Date(invoice.week_end.getFullYear(), 0, 1);
  const ytdInvoices = await prisma.invoice.findMany({
    where: {
      driver_id: invoice.driver_id,
      week_end: {
        gte: yearStart,
        lte: invoice.week_end
      }
    },
    select: { updated_at: true, deductions: true }
  });

  const ytdInsurance = ytdInvoices.reduce(
    (sum, ytdInvoice) => sum + sumInsuranceDeductions(ytdInvoice.deductions),
    0
  );
  const latestUpdatedAt = ytdInvoices.reduce((latest, ytdInvoice) => {
    return ytdInvoice.updated_at > latest ? ytdInvoice.updated_at : latest;
  }, invoice.updated_at);

  const etag = `W/"invoice-${invoice.id}-${latestUpdatedAt.getTime()}"`;
  const lastModified = latestUpdatedAt.toUTCString();
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'ETag': etag,
        'Last-Modified': lastModified
      }
    });
  }

  const autoConfig = getAutoDeductionConfigFromCompany(invoice.company);
  const autoAmounts = calculateAutoDeductions(ytdInsurance, autoConfig);
  const autoEntries = buildAutoDeductionEntries(autoAmounts, autoConfig);
  const mergedDeductions = mergeDeductionsWithAuto(invoice.deductions, autoEntries);
  const filename = buildInvoicePdfFilename(
    invoice.driver?.name,
    invoice.due_date || invoice.invoice_date,
    invoice.invoice_number
  );

  try {
    const pdfBuffer = await getInvoicePdfBuffer({
      ...invoiceData,
      deductions: mergedDeductions,
      id: invoice.id,
      updated_at: latestUpdatedAt
    });

    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'ETag': etag,
        'Last-Modified': lastModified
      }
    });
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
