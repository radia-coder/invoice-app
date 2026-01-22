import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiAuth } from '@/lib/api-auth';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import { getYearStart } from '@/lib/fiscal-year';

export const runtime = 'nodejs';

type YtdBaseInput = {
  driverId: number;
  weekEnd: Date;
  excludeInvoiceId?: number;
};

const fetchYtdBaseTotals = async ({ driverId, weekEnd, excludeInvoiceId }: YtdBaseInput) => {
  const yearStart = getYearStart(weekEnd);
  const where: Record<string, unknown> = {
    driver_id: driverId,
    week_end: {
      gte: yearStart,
      lte: weekEnd
    }
  };

  if (Number.isFinite(excludeInvoiceId) && (excludeInvoiceId as number) > 0) {
    where.id = { not: excludeInvoiceId };
  }

  const ytdInvoices = await prisma.invoice.findMany({
    where,
    include: {
      loads: true,
      deductions: true,
      credits: true,
      driver: true
    },
    orderBy: { week_end: 'asc' }
  });

  let ytdGrossIncome = 0;
  let ytdNetPay = 0;
  let ytdCredit = 0;
  let ytdCreditPayback = 0;

  ytdInvoices.forEach((invoice) => {
    const totals = calculateInvoiceTotals({
      loads: invoice.loads,
      deductions: invoice.deductions,
      credits: invoice.credits || [],
      percent: invoice.percent,
      tax_percent: invoice.tax_percent || 0,
      driver_type: invoice.driver.type,
      manual_net_pay: invoice.manual_net_pay
    });
    ytdGrossIncome += totals.gross;
    ytdNetPay += totals.net;
    ytdCredit += (invoice.credits || []).reduce((sum, credit) => {
      const amount = credit.amount || 0;
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
    ytdCreditPayback += invoice.credit_payback || 0;
  });

  return { ytdGrossIncome, ytdNetPay, ytdCredit, ytdCreditPayback };
};

export async function GET(request: Request) {
  const { user, response, isSuperAdmin } = await requireApiAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const driverId = Number(searchParams.get('driverId'));
  const weekEndRaw = searchParams.get('weekEnd');
  const excludeInvoiceId = Number(searchParams.get('excludeInvoiceId'));

  if (!driverId || !weekEndRaw) {
    return NextResponse.json({ error: 'Missing driverId or weekEnd' }, { status: 400 });
  }

  const weekEnd = new Date(weekEndRaw);
  if (Number.isNaN(weekEnd.getTime())) {
    return NextResponse.json({ error: 'Invalid weekEnd' }, { status: 400 });
  }

  if (!isSuperAdmin) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { company_id: true }
    });
    if (!driver || driver.company_id !== user?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const totals = await fetchYtdBaseTotals({
    driverId,
    weekEnd,
    excludeInvoiceId
  });

  return NextResponse.json(totals);
}

export async function POST(request: Request) {
  const { user, response, isSuperAdmin } = await requireApiAuth();
  if (response) return response;

  const body = await request.json();
  const driverId = Number(body?.driverId);
  const weekEndRaw = body?.weekEnd;
  const excludeInvoiceId = Number(body?.excludeInvoiceId);

  if (!driverId || !weekEndRaw) {
    return NextResponse.json({ error: 'Missing driverId or weekEnd' }, { status: 400 });
  }

  const weekEnd = new Date(weekEndRaw);
  if (Number.isNaN(weekEnd.getTime())) {
    return NextResponse.json({ error: 'Invalid weekEnd' }, { status: 400 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { company_id: true, type: true }
  });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }
  if (!isSuperAdmin && driver.company_id !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const baseTotals = await fetchYtdBaseTotals({
    driverId,
    weekEnd,
    excludeInvoiceId
  });

  const invoicePayload = body?.invoice || {};
  const currentTotals = calculateInvoiceTotals({
    loads: (invoicePayload.loads || []).map((load: { amount: number | string }) => ({
      amount: Number(load.amount) || 0
    })),
    deductions: (invoicePayload.deductions || []).map((deduction: { amount: number | string }) => ({
      amount: Number(deduction.amount) || 0
    })),
    credits: (invoicePayload.credits || []).map((credit: { amount: number | string }) => ({
      amount: Number(credit.amount) || 0
    })),
    percent: Number(invoicePayload.percent) || 0,
    tax_percent: Number(invoicePayload.tax_percent) || 0,
    driver_type: driver.type,
    manual_net_pay: invoicePayload.manual_net_pay ?? null
  });

  const currentCredits = (invoicePayload.credits || []).reduce(
    (sum: number, credit: { amount: number | string }) => {
      const amount = Number(credit.amount) || 0;
      return amount < 0 ? sum + Math.abs(amount) : sum;
    },
    0
  );

  const currentCreditPayback = Number(invoicePayload.credit_payback) || 0;

  return NextResponse.json({
    ytdGrossIncome: baseTotals.ytdGrossIncome + currentTotals.gross,
    ytdNetPay: baseTotals.ytdNetPay + currentTotals.net,
    ytdCredit: baseTotals.ytdCredit + currentCredits,
    ytdCreditPayback: baseTotals.ytdCreditPayback + currentCreditPayback
  });
}
