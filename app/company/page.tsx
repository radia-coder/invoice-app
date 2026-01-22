import { prisma } from '@/lib/prisma';
import type { Company } from '@prisma/client';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CompanyForm from '@/components/CompanyForm';
import CompanyDriversManager from '@/components/CompanyDriversManager';

export default async function CompanyPage({
  searchParams
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const formatCompanyName = (name: string) =>
    name.replace(
      /\s*(TRANSPORTATION SERVICE LLC|LOGISTICS LLC|TRUCKING LLP|TRANSPORTATION LLC|LLC|LLP)\s*$/i,
      ''
    ).trim();

  const user = await getSessionUser();
  const params = await searchParams;
  const requestedCompanyId = params?.companyId ? Number(params.companyId) : null;

  let companyId = user?.company_id ?? null;
  let companies: Company[] = [];

  if (isSuperAdmin(user)) {
    companies = await prisma.company.findMany({ orderBy: { name: 'asc' } });
    companyId = requestedCompanyId || companies[0]?.id || null;
  }

  if (!companyId) {
    notFound();
  }

  const [company, assignedDrivers, availableDrivers] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.driver.findMany({
      where: { company_id: companyId },
      orderBy: { name: 'asc' }
    }),
    prisma.driver.findMany({
      where: { OR: [{ company_id: null }, { company_id: { not: companyId } }] },
      include: { company: { select: { name: true } } },
      orderBy: { name: 'asc' }
    })
  ]);
  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Company Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage your company profile and invoice settings</p>
        </div>
        {isSuperAdmin(user) && companies.length > 1 ? (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {companies.map((c) => (
              <Link
                key={c.id}
                href={`/company?companyId=${c.id}`}
                className={c.id === companyId
                  ? 'px-3 py-1.5 rounded-lg bg-[#7a67e7] text-white font-medium'
                  : 'px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors'}
              >
                {formatCompanyName(c.name)}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <CompanyForm company={{
        ...company,
        invoice_template: company.invoice_template as 'classic' | 'modern' | 'mh',
        auto_deduction_base: (company.auto_deduction_base || 'YTD_INSURANCE') as 'YTD_INSURANCE'
      }} />
      <CompanyDriversManager
        companies={companies.length ? companies : [company]}
        selectedCompanyId={company.id}
        assignedDrivers={assignedDrivers.map((driver) => ({
          id: driver.id,
          name: driver.name,
          truck_number: driver.truck_number,
          email: driver.email,
          whatsapp_number: driver.whatsapp_number
        }))}
        availableDrivers={availableDrivers.map((driver) => ({
          id: driver.id,
          name: driver.name,
          email: driver.email,
          whatsapp_number: driver.whatsapp_number,
          company_name: driver.company?.name ?? null
        }))}
        canSelectCompany={isSuperAdmin(user)}
      />
    </div>
  );
}
