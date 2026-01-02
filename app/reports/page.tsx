import { prisma } from '@/lib/prisma';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ companyId?: string; driverId?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const companyId = params.companyId ? Number(params.companyId) : null;
  const driverId = params.driverId ? Number(params.driverId) : null;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
  const dateTo = params.dateTo ? new Date(params.dateTo) : null;

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
    where.invoice_date = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {})
    };
  }

  const [invoices, companies, drivers] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { company: true, driver: true, loads: true, deductions: true }
    }),
    prisma.company.findMany({
      where: isSuperAdmin(user) ? {} : { id: user?.company_id ?? -1 },
      orderBy: { name: 'asc' }
    }),
    prisma.driver.findMany({
      where: isSuperAdmin(user) ? {} : { company_id: user?.company_id ?? -1 },
      orderBy: { name: 'asc' }
    })
  ]);

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
      percent: invoice.percent,
      tax_percent: invoice.tax_percent || 0,
      driver_type: invoice.driver.type
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

      <form className="bg-zinc-900 border border-zinc-800 rounded-xl p-4" method="GET">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full lg:w-[260px]">
            <select 
              name="companyId" 
              defaultValue={companyId || ''} 
              className="h-12 w-full appearance-none rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border px-3 pr-12"
            >
              <option value="">All Companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <div className="relative w-full lg:w-[260px]">
            <select 
              name="driverId" 
              defaultValue={driverId || ''} 
              className="h-12 w-full appearance-none rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border px-3 pr-12"
            >
              <option value="">All Drivers</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.name}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <input
            type="date"
            name="dateFrom"
            defaultValue={params.dateFrom || ''}
            className="h-12 w-full lg:w-[200px] rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border px-3"
          />
          <input
            type="date"
            name="dateTo"
            defaultValue={params.dateTo || ''}
            className="h-12 w-full lg:w-[200px] rounded-lg border-zinc-700 bg-zinc-800 text-white shadow-sm border px-3"
          />
          <button
            type="submit"
            className="h-12 w-full lg:w-auto rounded-lg bg-[#7a67e7] px-5 text-sm font-medium text-white hover:bg-[#6b59d6] transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </form>

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
    </div>
  );
}
