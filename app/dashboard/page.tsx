import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { FileText, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import InvoiceActions from '@/components/InvoiceActions';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import {
  buildAutoDeductionEntries,
  buildYtdInsuranceIndex,
  calculateAutoDeductions,
  getAutoDeductionConfigFromCompany,
  getYtdInsurance,
  mergeDeductionsWithAuto
} from '@/lib/auto-deductions';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationEllipsis } from '@/components/ui/pagination';
import CommandPalette from '@/components/CommandPalette';
import DashboardSortControl from '@/components/DashboardSortControl';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    companyId?: string;
    driverId?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Math.max(1, Number(params.page || 1));
  const q = params.q?.trim() || '';
  const status = params.status || '';
  const companyId = params.companyId ? Number(params.companyId) : null;
  const driverId = params.driverId ? Number(params.driverId) : null;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
  const dateTo = params.dateTo ? new Date(params.dateTo) : null;
  const sortOptions = new Set(['added', 'created', 'opened', 'name', 'invoice']);
  const sort = sortOptions.has(params.sort || '') ? params.sort! : 'invoice';

  const where: any = {};
  if (!isSuperAdmin(user)) {
    where.company_id = user?.company_id ?? -1;
  }
  if (companyId) {
    if (isSuperAdmin(user)) {
      where.company_id = companyId;
    } else if (companyId !== user?.company_id) {
      where.company_id = -1;
    }
  }
  if (driverId) {
    where.driver_id = driverId;
  }
  if (status) {
    where.status = status;
  }
  if (dateFrom || dateTo) {
    where.invoice_date = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {})
    };
  }
  if (q) {
    where.OR = [
      { invoice_number: { contains: q } },
      { company: { name: { contains: q } } },
      { driver: { name: { contains: q } } }
    ];
  }

  const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = (() => {
    switch (sort) {
      case 'created':
        return [{ invoice_date: 'desc' as const }, { created_at: 'desc' as const }];
      case 'opened':
        return [{ last_opened_at: 'desc' as const }, { created_at: 'desc' as const }];
      case 'name':
        return [{ driver: { name: 'asc' as const } }, { created_at: 'desc' as const }];
      case 'invoice':
        return [{ week_end: 'desc' as const }, { created_at: 'desc' as const }];
      case 'added':
      default:
        return [{ created_at: 'desc' as const }];
    }
  })();

  const [invoices, totalCount, companies, drivers] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        company: true,
        driver: true,
        loads: true,
        deductions: true,
        credits: true
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
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

  const driverIds = Array.from(new Set(invoices.map((invoice) => invoice.driver_id)));
  const yearBounds = invoices.reduce(
    (acc, invoice) => {
      const year = invoice.week_end.getFullYear();
      acc.min = Math.min(acc.min, year);
      acc.max = Math.max(acc.max, year);
      return acc;
    },
    { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
  );

  const ytdInvoices = driverIds.length
    ? await prisma.invoice.findMany({
        where: {
          driver_id: { in: driverIds },
          week_end: {
            gte: new Date(yearBounds.min, 0, 1),
            lte: new Date(yearBounds.max, 11, 31, 23, 59, 59, 999)
          }
        },
        include: { deductions: true, credits: true }
      })
    : [];

  const ytdInsuranceIndex = buildYtdInsuranceIndex(ytdInvoices);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Invoices</h1>
        <Link
          href="/create"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-[#7a67e7] hover:bg-[#6b59d6] transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
        <form className="space-y-6" method="GET">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <p className="text-sm text-zinc-400">Filter and sort invoices</p>
            <DashboardSortControl defaultSort={sort as 'added' | 'created' | 'opened' | 'invoice' | 'name'} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-4">
            <div className="relative">
              <select 
                name="companyId" 
                defaultValue={companyId || ''} 
                className="appearance-none rounded-xl border border-zinc-700 bg-zinc-800 text-white shadow-sm px-4 py-3 pr-12 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent w-full"
              >
                <option value="">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-6 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </div>

            <div className="relative">
              <select 
                name="driverId" 
                defaultValue={driverId || ''} 
                className="appearance-none rounded-xl border border-zinc-700 bg-zinc-800 text-white shadow-sm px-4 py-3 pr-12 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent w-full"
              >
                <option value="">All Drivers</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-6 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </div>

            <input
              type="date"
              name="dateFrom"
              defaultValue={params.dateFrom || ''}
              className="rounded-xl border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm px-4 py-3 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
            />

            <input
              type="date"
              name="dateTo"
              defaultValue={params.dateTo || ''}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 shadow-sm px-4 py-3 focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
            />

            <div className="flex items-center gap-4 lg:justify-end flex-nowrap">
              <CommandPalette />
              <button
                type="submit"
                className="rounded-xl bg-[#7a67e7] px-6 py-3 text-sm font-medium text-white hover:bg-[#6b59d6] transition-colors whitespace-nowrap"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 overflow-hidden rounded-xl">
        <ul role="list" className="divide-y divide-zinc-800">
          {invoices.length === 0 ? (
            <li className="px-4 py-12 text-center text-zinc-500">
              No invoices found. Create one to get started.
            </li>
          ) : (
            invoices.map((invoice) => {
              const autoConfig = getAutoDeductionConfigFromCompany(invoice.company);
              const ytdInsurance = getYtdInsurance(ytdInsuranceIndex, invoice.driver_id, invoice.week_end);
              const autoAmounts = calculateAutoDeductions(ytdInsurance, autoConfig);
              const autoEntries = buildAutoDeductionEntries(autoAmounts, autoConfig);
              const mergedDeductions = mergeDeductionsWithAuto(invoice.deductions, autoEntries);

              const totals = calculateInvoiceTotals({
                loads: invoice.loads,
                deductions: mergedDeductions,
                credits: invoice.credits,
                percent: invoice.percent,
                tax_percent: invoice.tax_percent || 0,
                driver_type: invoice.driver.type,
                manual_net_pay: invoice.manual_net_pay
              });

              const formatMoney = (amount: number) => {
                try {
                  return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(amount);
                } catch {
                  return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(amount);
                }
              };

              return (
                <li key={invoice.id}>
                  <div className="block hover:bg-zinc-800/50 transition duration-150 ease-in-out">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm font-medium text-blue-400 truncate">
                          <FileText className="h-5 w-5 mr-2 text-zinc-500" />
                          <Link href={`/invoices/${invoice.id}`} className="hover:underline hover:text-blue-300">
                            {invoice.invoice_number}
                          </Link>
                        </div>
                        <div className="ml-2 flex-shrink-0 flex items-center gap-2">
                          <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {formatMoney(totals.net)}
                          </span>
                          <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            invoice.status === 'paid'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : invoice.status === 'sent'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                          }`}>
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-zinc-400">
                            {invoice.company.name}
                          </p>
                          <p className="mt-2 flex items-center text-sm text-zinc-400 sm:mt-0 sm:ml-6">
                            Driver: <span className="font-medium text-zinc-200 ml-1">{invoice.driver.name}</span>
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-zinc-500 sm:mt-0">
                          <p>
                            Issued: <time dateTime={invoice.invoice_date.toISOString()} className="text-zinc-400">{format(invoice.invoice_date, 'MMM dd, yyyy')}</time>
                          </p>
                          {invoice.due_date ? (
                            <p className="ml-4">Due: <span className="text-zinc-400">{format(invoice.due_date, 'MMM dd, yyyy')}</span></p>
                          ) : null}
                          <div className="ml-4">
                            <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-6">
          <PaginationContent>
            {/* Previous Button */}
            <PaginationItem>
              <Button
                variant="ghost"
                size="sm"
                asChild
                disabled={page === 1}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                <Link
                  href={{ pathname: '/dashboard', query: { ...params, page: Math.max(1, page - 1).toString() } }}
                  className={page === 1 ? 'pointer-events-none' : ''}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Link>
              </Button>
            </PaginationItem>

            {/* Page Numbers */}
            {(() => {
              const pages: (number | 'ellipsis')[] = [];

              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (page > 3) pages.push('ellipsis');

                const start = Math.max(2, page - 1);
                const end = Math.min(totalPages - 1, page + 1);

                for (let i = start; i <= end; i++) pages.push(i);

                if (page < totalPages - 2) pages.push('ellipsis');
                pages.push(totalPages);
              }

              return pages.map((p, idx) => (
                <PaginationItem key={idx}>
                  {p === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <Button
                      variant={p === page ? 'outline' : 'ghost'}
                      mode="icon"
                      size="sm"
                      asChild
                      className={
                        p === page
                          ? 'border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }
                    >
                      <Link href={{ pathname: '/dashboard', query: { ...params, page: p.toString() } }}>
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
                disabled={page >= totalPages}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                <Link
                  href={{ pathname: '/dashboard', query: { ...params, page: Math.min(totalPages, page + 1).toString() } }}
                  className={page >= totalPages ? 'pointer-events-none' : ''}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Page indicator for single page or below pagination */}
      <p className="text-center text-sm text-zinc-500 mt-4">
        Page {page} of {totalPages}
      </p>
    </div>
  );
}
