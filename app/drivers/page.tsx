import { prisma } from '@/lib/prisma';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import DriverContacts from '@/components/DriverContacts';

export default async function DriversPage() {
  const user = await getSessionUser();
  const drivers = await prisma.driver.findMany({
    where: isSuperAdmin(user) ? {} : { company_id: user?.company_id ?? -1 },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Driver Contacts</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage driver contact information for invoice delivery</p>
        </div>
      </div>
      <DriverContacts drivers={drivers} />
    </div>
  );
}
