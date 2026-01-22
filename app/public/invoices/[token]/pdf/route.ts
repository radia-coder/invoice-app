import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { buildInvoicePdfFilename, getInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { type InvoiceData } from '@/components/InvoiceTemplate';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
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
      deductions: true,
      credits: true
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
    deductions: invoice.deductions,
    credits: invoice.credits
  };

  const weekEndDate = new Date(invoice.week_end);
  const currentYear = weekEndDate.getFullYear();
  const currentMonth = weekEndDate.getMonth();
  const currentDay = weekEndDate.getDate();
  const yearStart = currentMonth === 11 && currentDay >= 21
    ? new Date(currentYear, 11, 21)
    : new Date(currentYear - 1, 11, 21);
  const ytdInvoices = await prisma.invoice.findMany({
    where: {
      driver_id: invoice.driver_id,
      week_end: {
        gte: yearStart,
        lte: invoice.week_end
      }
    },
    include: {
      loads: true,
      deductions: true,
      credits: true,
      driver: true
    },
    orderBy: { week_end: 'asc' }
  });

  const ytdInsurance = ytdInvoices.reduce(
    (sum, ytdInvoice) => sum + sumInsuranceDeductions(ytdInvoice.deductions),
    0
  );
  const latestUpdatedAt = ytdInvoices.reduce((latest, ytdInvoice) => {
    return ytdInvoice.updated_at > latest ? ytdInvoice.updated_at : latest;
  }, invoice.updated_at);

  let ytdGrossIncome = 0;
  let ytdNetPay = 0;
  let ytdCredit = 0;
  let ytdAdditions = 0;
  let ytdFixedDed = 0;
  let ytdCreditPayback = 0;
  ytdInvoices.forEach((ytdInvoice) => {
    const totals = calculateInvoiceTotals({
      loads: ytdInvoice.loads,
      deductions: ytdInvoice.deductions,
      credits: ytdInvoice.credits || [],
      percent: ytdInvoice.percent,
      tax_percent: ytdInvoice.tax_percent || 0,
      driver_type: ytdInvoice.driver.type,
      manual_net_pay: ytdInvoice.manual_net_pay
    });
    ytdGrossIncome += totals.gross;
    ytdNetPay += totals.net;
    ytdAdditions += totals.additions;
    ytdFixedDed += totals.fixedDed;
    ytdCredit += (ytdInvoice.credits || []).reduce((sum, credit) => {
      const amount = credit.amount || 0;
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
    ytdCreditPayback += ytdInvoice.credit_payback || 0;
  });

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
      updated_at: latestUpdatedAt,
      ytdGrossIncome,
      ytdNetPay,
      ytdCredit,
      ytdAdditions,
      ytdFixedDed,
      ytdCreditPayback
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
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      token: token
    });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      error: 'Failed to generate PDF',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}
