import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { FileText, Plus } from 'lucide-react';
import InvoiceActions from '@/components/InvoiceActions';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

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

  const [invoices, totalCount, companies, drivers] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        company: true,
        driver: true,
        loads: true,
        deductions: true
      },
      orderBy: { created_at: 'desc' },
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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <Link
          href="/create"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Link>
      </div>

      <form className="bg-white shadow rounded-md p-4 grid grid-cols-1 md:grid-cols-6 gap-3" method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search invoice, company, driver"
          className="md:col-span-2 rounded-md border-gray-300 shadow-sm border p-2"
        />
        <select name="status" defaultValue={status} className="rounded-md border-gray-300 shadow-sm border p-2">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
        </select>
        <select name="companyId" defaultValue={companyId || ''} className="rounded-md border-gray-300 shadow-sm border p-2">
          <option value="">All Companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
        <select name="driverId" defaultValue={driverId || ''} className="rounded-md border-gray-300 shadow-sm border p-2">
          <option value="">All Drivers</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>{driver.name}</option>
          ))}
        </select>
        <input
          type="date"
          name="dateFrom"
          defaultValue={params.dateFrom || ''}
          className="rounded-md border-gray-300 shadow-sm border p-2"
        />
        <input
          type="date"
          name="dateTo"
          defaultValue={params.dateTo || ''}
          className="rounded-md border-gray-300 shadow-sm border p-2"
        />
        <button
          type="submit"
          className="md:col-span-6 inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-white bg-gray-900 hover:bg-gray-800"
        >
          Apply Filters
        </button>
      </form>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul role="list" className="divide-y divide-gray-200">
          {invoices.length === 0 ? (
            <li className="px-4 py-12 text-center text-gray-500">
              No invoices found. Create one to get started.
            </li>
          ) : (
            invoices.map((invoice) => {
              const totals = calculateInvoiceTotals({
                loads: invoice.loads,
                deductions: invoice.deductions,
                percent: invoice.percent,
                tax_percent: invoice.tax_percent || 0,
                driver_type: invoice.driver.type
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
                  <div className="block hover:bg-gray-50 transition duration-150 ease-in-out">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm font-medium text-blue-600 truncate">
                          <FileText className="h-5 w-5 mr-2 text-gray-400" />
                          <Link href={`/invoices/${invoice.id}`} className="hover:underline">
                            {invoice.invoice_number}
                          </Link>
                        </div>
                        <div className="ml-2 flex-shrink-0 flex items-center gap-2">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {formatMoney(totals.net)}
                          </span>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            invoice.status === 'paid'
                              ? 'bg-blue-100 text-blue-800'
                              : invoice.status === 'sent'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            {invoice.company.name}
                          </p>
                          <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                            Driver: <span className="font-medium text-gray-900 ml-1">{invoice.driver.name}</span>
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <p>
                            Issued: <time dateTime={invoice.invoice_date.toISOString()}>{format(invoice.invoice_date, 'MMM dd, yyyy')}</time>
                          </p>
                          {invoice.due_date ? (
                            <p className="ml-4">Due: {format(invoice.due_date, 'MMM dd, yyyy')}</p>
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Link
            href={{ pathname: '/dashboard', query: { ...params, page: Math.max(1, page - 1).toString() } }}
            className={`px-3 py-1 rounded-md border text-sm ${page === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-gray-50'}`}
          >
            Previous
          </Link>
          <Link
            href={{ pathname: '/dashboard', query: { ...params, page: Math.min(totalPages, page + 1).toString() } }}
            className={`px-3 py-1 rounded-md border text-sm ${page >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-gray-50'}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
