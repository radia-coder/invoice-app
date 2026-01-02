import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { companyUpdateSchema, formatZodErrors } from '@/lib/validation';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, isSuperAdmin } = await requireApiAuth();
  if (response) return response;

  const { id } = await params;
  const companyId = parseInt(id);

  if (!isSuperAdmin && companyId !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  return NextResponse.json(company);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, isSuperAdmin } = await requireApiAuth();
  if (response) return response;

  const { id } = await params;
  const companyId = parseInt(id);

  if (!isSuperAdmin && companyId !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const payload = {
    name: body.name,
    address: body.address || null,
    email: body.email || null,
    phone: body.phone || null,
    logo_url: body.logo_url || null,
    brand_color: body.brand_color || null,
    invoice_template: body.invoice_template || 'classic',
    default_percent: Number(body.default_percent),
    default_tax_percent: Number(body.default_tax_percent),
    default_currency: 'USD',
    invoice_prefix: body.invoice_prefix,
    footer_note: body.footer_note || null
  };

  const parsed = companyUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fields: formatZodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const company = await prisma.company.update({
    where: { id: companyId },
    data: parsed.data
  });

  await prisma.invoice.updateMany({
    where: { company_id: companyId },
    data: { updated_at: new Date() }
  });

  try {
    const invoiceIds = await prisma.invoice.findMany({
      where: { company_id: companyId },
      select: { id: true }
    });
    const pdfDir = path.join(process.cwd(), 'storage', 'pdfs');
    await Promise.all(
      invoiceIds.map(({ id: invoiceId }) =>
        fs.rm(path.join(pdfDir, `${invoiceId}.pdf`), { force: true })
      )
    );
  } catch (error) {
    console.error('Failed to clear PDF cache for company', error);
  }

  return NextResponse.json(company);
}
