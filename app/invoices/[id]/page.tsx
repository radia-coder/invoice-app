import { prisma } from '@/lib/prisma';
import { InvoiceTemplate } from '@/components/InvoiceTemplate';
import Link from 'next/link';
import { Download, Edit, ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import InvoiceLifecycleActions from '@/components/InvoiceLifecycleActions';
import InvoiceWhatsappShare from '@/components/InvoiceWhatsappShare';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
    include: {
      company: true,
      driver: true,
      loads: true,
      deductions: true
    }
  });

  if (!invoice) notFound();
  if (!isSuperAdmin(user) && invoice.company_id !== user?.company_id) {
    notFound();
  }

  // Cast to InvoiceData for template
  const invoiceData = {
    ...invoice,
    loads: invoice.loads.map(l => ({ ...l, amount: l.amount })),
    deductions: invoice.deductions.map(d => ({ ...d, amount: d.amount })),
    percent: invoice.percent,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Invoice {invoice.invoice_number}</h1>
        </div>
        <div className="flex space-x-3">
            <Link 
                href={`/invoices/${id}/edit`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
                <Edit className="w-4 h-4 mr-2" /> Edit
            </Link>
            <a 
                href={`/api/invoices/${id}/pdf`} 
                target="_blank"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
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

      <div className="bg-white shadow-lg border rounded-lg overflow-hidden">
        <InvoiceTemplate data={invoiceData} />
      </div>
    </div>
  );
}
