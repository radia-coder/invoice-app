import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { driverCompanySchema, driverContactSchema, formatZodErrors } from '@/lib/validation';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, isSuperAdmin } = await requireApiAuth();
  if (response) return response;

  const { id } = await params;
  const driverId = parseInt(id);
  const body = await request.json();

  const parsed = driverContactSchema.safeParse({
    email: body.email || null,
    whatsapp_number: body.whatsapp_number || null,
    whatsapp_link: body.whatsapp_link || null
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fields: formatZodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  if (!isSuperAdmin && driver.company_id !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.driver.update({
    where: { id: driverId },
    data: parsed.data
  });

  return NextResponse.json(updated);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, isSuperAdmin } = await requireApiAuth();
  if (response) return response;

  const { id } = await params;
  const driverId = parseInt(id);
  const body = await request.json();
  const rawCompanyId = body?.company_id;
  const companyId = rawCompanyId === null || rawCompanyId === undefined ? rawCompanyId : Number(rawCompanyId);

  const parsed = driverCompanySchema.safeParse({
    company_id: companyId
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fields: formatZodErrors(parsed.error) },
      { status: 400 }
    );
  }

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  const targetCompanyId = parsed.data.company_id;
  if (!isSuperAdmin) {
    const userCompanyId = user?.company_id ?? null;
    if (!userCompanyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (targetCompanyId !== null && targetCompanyId !== userCompanyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (targetCompanyId === null && driver.company_id !== userCompanyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (targetCompanyId !== null) {
    const company = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
  }

  const updated = await prisma.driver.update({
    where: { id: driverId },
    data: { company_id: targetCompanyId }
  });

  return NextResponse.json(updated);
}
