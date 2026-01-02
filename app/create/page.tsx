import { prisma } from '@/lib/prisma';
import InvoiceForm from '@/components/InvoiceForm';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';

export default async function CreateInvoicePage() {
  const user = await getSessionUser();
  const where = isSuperAdmin(user)
    ? {}
    : { id: user?.company_id ?? -1 };

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:truncate">
            New Invoice
          </h2>
          <p className="mt-1 text-sm text-zinc-400">Create a new driver settlement invoice</p>
        </div>
      </div>
      <InvoiceForm companies={companies} />
    </div>
  );
}
