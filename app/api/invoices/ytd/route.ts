import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiAuth } from '@/lib/api-auth';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

export const runtime = 'nodejs';

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

  const currentYear = weekEnd.getFullYear();
  const currentMonth = weekEnd.getMonth();
  const currentDay = weekEnd.getDate();
  const yearStart = currentMonth === 11 && currentDay >= 21
    ? new Date(currentYear, 11, 21)
    : new Date(currentYear - 1, 11, 21);

  const where: Record<string, unknown> = {
    driver_id: driverId,
    week_end: {
      gte: yearStart,
      lte: weekEnd
    }
  };

  if (Number.isFinite(excludeInvoiceId) && excludeInvoiceId > 0) {
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
  });

  return NextResponse.json({ ytdGrossIncome, ytdNetPay });
}
