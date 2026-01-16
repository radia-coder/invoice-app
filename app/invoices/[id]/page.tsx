import { prisma } from '@/lib/prisma';
import { InvoiceTemplate } from '@/components/InvoiceTemplate';
import Link from 'next/link';
import { Download, Edit, ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import InvoiceLifecycleActions from '@/components/InvoiceLifecycleActions';
import InvoiceWhatsappShare from '@/components/InvoiceWhatsappShare';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
    include: {
      company: true,
      driver: true,
      loads: true,
      deductions: true,
      credits: true
    }
  });

  if (!invoice) notFound();
  if (!isSuperAdmin(user) && invoice.company_id !== user?.company_id) {
    notFound();
  }

  // Calculate YTD values - YTD year starts on December 21st
  const weekEndDate = new Date(invoice.week_end);
  const currentYear = weekEndDate.getFullYear();
  const currentMonth = weekEndDate.getMonth(); // 0-11
  const currentDay = weekEndDate.getDate();

  // If we're in December on or after the 21st, year starts Dec 21 of current year
  // Otherwise, year starts Dec 21 of previous year
  const yearStart = (currentMonth === 11 && currentDay >= 21)
    ? new Date(currentYear, 11, 21) // Dec 21 of current year
    : new Date(currentYear - 1, 11, 21); // Dec 21 of previous year

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

  let ytdGrossIncome = 0;
  let ytdNetPay = 0;

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
  });

  // Cast to InvoiceData for template
  const invoiceData = {
    ...invoice,
    loads: invoice.loads.map(l => ({ ...l, amount: l.amount })),
    deductions: invoice.deductions.map(d => ({ ...d, amount: d.amount })),
    credits: invoice.credits,
    percent: invoice.percent,
    manual_net_pay: invoice.manual_net_pay,
    ytdGrossIncome,
    ytdNetPay
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Invoice {invoice.invoice_number}</h1>
              <p className="text-sm text-zinc-400 mt-0.5">View and manage invoice details</p>
            </div>
        </div>
        <div className="flex space-x-3">
            <Link
                href={`/invoices/${id}/edit`}
                className="inline-flex items-center px-4 py-2 border border-zinc-700 text-sm font-medium rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-colors"
            >
                <Edit className="w-4 h-4 mr-2" /> Edit
            </Link>
            <a
                href={`/api/invoices/${id}/pdf`}
                target="_blank"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-[#7a67e7] hover:bg-[#6b59d6] transition-colors"
            >
                <Download className="w-4 h-4 mr-2" /> Download PDF
            </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InvoiceLifecycleActions
          invoiceId={invoice.id}
          status={invoice.status}
          defaultTo={invoice.driver.email}
          invoiceNumber={invoice.invoice_number}
          driverWhatsappNumber={invoice.driver.whatsapp_number}
          driverWhatsappLink={invoice.driver.whatsapp_link}
        />
        <InvoiceWhatsappShare
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          driverWhatsappNumber={invoice.driver.whatsapp_number}
          driverWhatsappLink={invoice.driver.whatsapp_link}
        />
      </div>

      <div className="bg-white shadow-lg border rounded-xl overflow-hidden">
        <InvoiceTemplate data={invoiceData} />
      </div>
    </div>
  );
}
