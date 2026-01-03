import { prisma } from '@/lib/prisma';
import InvoiceForm from '@/components/InvoiceForm';
import { notFound } from 'next/navigation';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  
  const [invoice, companies] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        company: true,
        driver: true,
        loads: true,
        deductions: true
      }
    }),
    prisma.company.findMany({
      where: isSuperAdmin(user) ? {} : { id: user?.company_id ?? -1 },
      orderBy: { name: 'asc' }
    })
  ]);

  if (!invoice) notFound();
  if (!isSuperAdmin(user) && invoice.company_id !== user?.company_id) {
    notFound();
  }

  return (
    <div className="space-y-6">
       <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">
            Edit Invoice {invoice.invoice_number}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">Update invoice details and save changes</p>
        </div>
      </div>
      <InvoiceForm companies={companies} initialData={{
        ...invoice,
        status: invoice.status as 'draft' | 'sent' | 'paid'
      }} />
    </div>
  );
}
