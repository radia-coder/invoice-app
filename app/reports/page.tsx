import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationEllipsis } from '@/components/ui/pagination';
import WeeklySummaryCard, { type WeeklySummaryData } from '@/components/WeeklySummaryCard';
import DownloadReportButton from '@/components/DownloadReportButton';

const WEEKLY_SUMMARY_PAGE_SIZE = 10;

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ companyId?: string; driverId?: string; dateFrom?: string; dateTo?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const companyId = params.companyId ? Number(params.companyId) : null;
  const driverId = params.driverId ? Number(params.driverId) : null;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
  const dateTo = params.dateTo ? new Date(params.dateTo) : null;
  const weeklySummaryPage = Math.max(1, Number(params.page || 1));

  const where: any = {};
  if (!isSuperAdmin(user)) {
    where.company_id = user?.company_id ?? -1;
  }
  if (companyId) {
    where.company_id = isSuperAdmin(user) ? companyId : user?.company_id ?? -1;
  }
  if (driverId) {
    where.driver_id = driverId;
  }
  if (dateFrom || dateTo) {
    where.week_end = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {})
    };
  }

  const [invoices, weeklySummaryInvoices, weeklySummaryCount, companies, drivers] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { company: true, driver: true, loads: true, deductions: true, credits: true }
    }),
    prisma.invoice.findMany({
      where,
      include: { company: true, driver: true, loads: true, deductions: true, credits: true },
      orderBy: [{ week_end: 'desc' }, { created_at: 'desc' }],
      skip: (weeklySummaryPage - 1) * WEEKLY_SUMMARY_PAGE_SIZE,
      take: WEEKLY_SUMMARY_PAGE_SIZE
    }),
    prisma.invoice.count({ where }),
    prisma.company.findMany({
      where: isSuperAdmin(user) ? {} : { id: user?.company_id ?? -1 },
      orderBy: { name: 'asc' }
    }),
    prisma.driver.findMany({
      where: isSuperAdmin(user) ? {} : { company_id: user?.company_id ?? -1 },
      orderBy: { name: 'asc' }
    })
  ]);

  const weeklySummaryTotalPages = Math.max(1, Math.ceil(weeklySummaryCount / WEEKLY_SUMMARY_PAGE_SIZE));

  // Transform invoices to WeeklySummaryData format
  const weeklySummaries: WeeklySummaryData[] = weeklySummaryInvoices.map((invoice) => {
    const invoiceTotals = calculateInvoiceTotals({
      loads: invoice.loads,
      deductions: invoice.deductions,
      credits: invoice.credits,
      percent: invoice.percent,
      tax_percent: invoice.tax_percent || 0,
      driver_type: invoice.driver.type,
      manual_net_pay: invoice.manual_net_pay
    });

    const isOwnerOperator = invoice.driver.type !== 'Company Driver';
    const subtotalAfterPercent = isOwnerOperator
      ? invoiceTotals.gross - invoiceTotals.percentAmount
      : invoiceTotals.percentAmount;

    const totalCredits = (invoice.credits || []).reduce((sum, c) => sum + c.amount, 0);

    return {
      id: invoice.id,
      weekStart: invoice.week_start,
      weekEnd: invoice.week_end,
      companyName: invoice.company.name,
      driverName: invoice.driver.name,
      driverType: invoice.driver.type,
      loadsCount: invoice.loads.length,
      grossTotal: invoiceTotals.gross,
      percentValue: invoice.percent,
      percentAmount: invoiceTotals.percentAmount,
      subtotalAfterPercent,
      fixedDeductions: invoice.deductions.map((d) => ({
        name: d.deduction_type + (d.note ? ` (${d.note})` : ''),
        amount: d.amount
      })),
      totalFixedDeductions: invoiceTotals.fixedDed,
      credits: (invoice.credits || []).map((c) => ({
        name: c.credit_type + (c.note ? ` (${c.note})` : ''),
        amount: c.amount
      })),
      totalCredits,
      taxPercent: invoice.tax_percent || 0,
      taxAmount: invoiceTotals.taxAmount,
      netPay: invoiceTotals.net,
      status: invoice.status
    };
  });

  const totals = {
    gross: 0,
    fixed: 0,
    tax: 0,
    net: 0,
    count: invoices.length
  };

  const byCompany = new Map<number, { name: string; gross: number; net: number; count: number }>();
  const byDriver = new Map<number, { name: string; gross: number; net: number; count: number }>();

  invoices.forEach((invoice) => {
    const invoiceTotals = calculateInvoiceTotals({
      loads: invoice.loads,
      deductions: invoice.deductions,
      credits: invoice.credits,
      percent: invoice.percent,
      tax_percent: invoice.tax_percent || 0,
      driver_type: invoice.driver.type,
      manual_net_pay: invoice.manual_net_pay
    });

    totals.gross += invoiceTotals.gross;
    totals.fixed += invoiceTotals.fixedDed;
    totals.tax += invoiceTotals.taxAmount;
    totals.net += invoiceTotals.net;

    const compEntry = byCompany.get(invoice.company_id) || { name: invoice.company.name, gross: 0, net: 0, count: 0 };
    compEntry.gross += invoiceTotals.gross;
    compEntry.net += invoiceTotals.net;
    compEntry.count += 1;
    byCompany.set(invoice.company_id, compEntry);

    const drvEntry = byDriver.get(invoice.driver_id) || { name: invoice.driver.name, gross: 0, net: 0, count: 0 };
    drvEntry.gross += invoiceTotals.gross;
    drvEntry.net += invoiceTotals.net;
    drvEntry.count += 1;
    byDriver.set(invoice.driver_id, drvEntry);
  });

  const formatMoney = (amount: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    } catch {
      return amount.toFixed(2);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="mt-1 text-sm text-zinc-400">Financial overview and analytics</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max pl-6">
          <form className="contents" method="GET">
            {/* 1. Company dropdown */}
            <div className="relative flex-none">
              <select
                name="companyId"
                defaultValue={companyId || ''}
                className="h-11 w-[150px] appearance-none rounded-xl border border-zinc-700 bg-zinc-800 text-white text-sm pl-3 pr-9"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </div>
            {/* 2. Driver dropdown */}
            <div className="relative flex-none">
              <select
                name="driverId"
                defaultValue={driverId || ''}
                className="h-11 w-[140px] appearance-none rounded-xl border border-zinc-700 bg-zinc-800 text-white text-sm pl-3 pr-9"
              >
                <option value="">All Drivers</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </div>
            {/* 3. Start date */}
            <input
              type="date"
              name="dateFrom"
              defaultValue={params.dateFrom || ''}
              className="h-11 w-[145px] flex-none rounded-xl border border-zinc-700 bg-zinc-800 text-white text-sm px-3"
            />
            {/* 4. End date */}
            <input
              type="date"
              name="dateTo"
              defaultValue={params.dateTo || ''}
              className="h-11 w-[145px] flex-none rounded-xl border border-zinc-700 bg-zinc-800 text-white text-sm px-3"
            />
            {/* 5. Apply button */}
            <button
              type="submit"
              className="h-11 flex-none rounded-xl bg-[#7a67e7] px-5 text-sm font-medium text-white hover:bg-[#6b59d6] transition-colors"
            >
              Apply
            </button>
          </form>
          {/* 6-8. Vendor search + Mode toggle + Download button */}
          <DownloadReportButton
            companyId={companyId}
            driverId={driverId}
            dateFrom={params.dateFrom || null}
            dateTo={params.dateTo || null}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm text-zinc-400">Invoices</p>
          <p className="text-3xl font-bold text-white mt-1">{totals.count}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm text-zinc-400">Gross</p>
          <p className="text-3xl font-bold text-white mt-1">{formatMoney(totals.gross)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm text-zinc-400">Deductions + Tax</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{formatMoney(totals.fixed + totals.tax)}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-5">
          <p className="text-sm text-emerald-400">Net Pay</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{formatMoney(totals.net)}</p>
        </div>
      </div>
      <p className="text-xs text-zinc-500">Totals are displayed in USD and are not normalized across currencies.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">By Company</h2>
          <ul className="space-y-3 text-sm">
            {[...byCompany.values()].map((entry) => (
              <li key={entry.name} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                <span className="text-zinc-300">{entry.name} <span className="text-zinc-500">({entry.count})</span></span>
                <span className="text-emerald-400 font-medium">{formatMoney(entry.net)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">By Driver</h2>
          <ul className="space-y-3 text-sm max-h-80 overflow-y-auto">
            {[...byDriver.values()].map((entry) => (
              <li key={entry.name} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                <span className="text-zinc-300">{entry.name} <span className="text-zinc-500">({entry.count})</span></span>
                <span className="text-emerald-400 font-medium">{formatMoney(entry.net)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Weekly Summary Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Weekly Summary</h2>

        {weeklySummaries.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-500">No summaries found for the selected filters.</p>
          </div>
        ) : (
          <>
            {/* 2-column responsive grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {weeklySummaries.map((summary) => (
                <WeeklySummaryCard key={summary.id} summary={summary} />
              ))}
            </div>

            {/* Pagination */}
            {weeklySummaryTotalPages > 1 && (
              <>
                <Pagination className="mt-6">
                  <PaginationContent>
                    {/* Previous Button */}
                    <PaginationItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        disabled={weeklySummaryPage === 1}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        <Link
                          href={{
                            pathname: '/reports',
                            query: {
                              ...(companyId ? { companyId: companyId.toString() } : {}),
                              ...(driverId ? { driverId: driverId.toString() } : {}),
                              ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
                              ...(params.dateTo ? { dateTo: params.dateTo } : {}),
                              page: Math.max(1, weeklySummaryPage - 1).toString()
                            }
                          }}
                          className={weeklySummaryPage === 1 ? 'pointer-events-none' : ''}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:inline">Previous</span>
                        </Link>
                      </Button>
                    </PaginationItem>

                    {/* Page Numbers */}
                    {(() => {
                      const pages: (number | 'ellipsis')[] = [];

                      if (weeklySummaryTotalPages <= 7) {
                        for (let i = 1; i <= weeklySummaryTotalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (weeklySummaryPage > 3) pages.push('ellipsis');

                        const start = Math.max(2, weeklySummaryPage - 1);
                        const end = Math.min(weeklySummaryTotalPages - 1, weeklySummaryPage + 1);

                        for (let i = start; i <= end; i++) pages.push(i);

                        if (weeklySummaryPage < weeklySummaryTotalPages - 2) pages.push('ellipsis');
                        pages.push(weeklySummaryTotalPages);
                      }

                      return pages.map((p, idx) => (
                        <PaginationItem key={idx}>
                          {p === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <Button
                              variant={p === weeklySummaryPage ? 'outline' : 'ghost'}
                              mode="icon"
                              size="sm"
                              asChild
                              className={
                                p === weeklySummaryPage
                                  ? 'border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700'
                                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                              }
                            >
                              <Link
                                href={{
                                  pathname: '/reports',
                                  query: {
                                    ...(companyId ? { companyId: companyId.toString() } : {}),
                                    ...(driverId ? { driverId: driverId.toString() } : {}),
                                    ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
                                    ...(params.dateTo ? { dateTo: params.dateTo } : {}),
                                    page: p.toString()
                                  }
                                }}
                              >
                                {p}
                              </Link>
                            </Button>
                          )}
                        </PaginationItem>
                      ));
                    })()}

                    {/* Next Button */}
                    <PaginationItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        disabled={weeklySummaryPage >= weeklySummaryTotalPages}
                        className="text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        <Link
                          href={{
                            pathname: '/reports',
                            query: {
                              ...(companyId ? { companyId: companyId.toString() } : {}),
                              ...(driverId ? { driverId: driverId.toString() } : {}),
                              ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
                              ...(params.dateTo ? { dateTo: params.dateTo } : {}),
                              page: Math.min(weeklySummaryTotalPages, weeklySummaryPage + 1).toString()
                            }
                          }}
                          className={weeklySummaryPage >= weeklySummaryTotalPages ? 'pointer-events-none' : ''}
                        >
                          <span className="hidden sm:inline">Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>

                {/* Page indicator */}
                <p className="text-center text-sm text-zinc-500">
                  Page {weeklySummaryPage} of {weeklySummaryTotalPages}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
