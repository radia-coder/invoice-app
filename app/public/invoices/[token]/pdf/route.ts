import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { type InvoiceData } from '@/components/InvoiceTemplate';

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

  const etag = `W/"invoice-${invoice.id}-${invoice.updated_at.getTime()}"`;
  const lastModified = invoice.updated_at.toUTCString();
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

  const invoiceData: InvoiceData = {
    ...invoice,
    company: invoice.company,
    driver: invoice.driver,
    loads: invoice.loads,
    deductions: invoice.deductions
  };
  try {
    const pdfBuffer = await getInvoicePdfBuffer({
      ...invoiceData,
      id: invoice.id,
      updated_at: invoice.updated_at
    });

    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
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
