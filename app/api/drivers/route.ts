import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { driverCreateSchema, formatZodErrors } from '@/lib/validation'

export async function GET(request: Request) {
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response

  const { searchParams } = new URL(request.url)
  const companyIdParam = searchParams.get('companyId')

  const filterCompanyId = companyIdParam ? parseInt(companyIdParam) : null
  if (!isSuperAdmin && filterCompanyId && filterCompanyId !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const where = filterCompanyId
    ? { company_id: filterCompanyId }
    : isSuperAdmin
      ? {}
      : { company_id: user?.company_id ?? -1 }

  const drivers = await prisma.driver.findMany({
    where,
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(drivers)
}

export async function POST(request: Request) {
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response

  const body = await request.json()
  const rawCompanyId = body?.company_id
  const parsedCompanyId = rawCompanyId === null || rawCompanyId === undefined ? rawCompanyId : Number(rawCompanyId)
  const parsed = driverCreateSchema.safeParse({
    name: body?.name,
    company_id: parsedCompanyId,
    email: body?.email ?? null,
    whatsapp_number: body?.whatsapp_number ?? null
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fields: formatZodErrors(parsed.error) },
      { status: 400 }
    )
  }

  const targetCompanyId = parsed.data.company_id
  if (!isSuperAdmin && targetCompanyId !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const company = await prisma.company.findUnique({ where: { id: targetCompanyId } })
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const driver = await prisma.driver.create({
    data: {
      name: parsed.data.name,
      company_id: targetCompanyId,
      email: parsed.data.email,
      whatsapp_number: parsed.data.whatsapp_number,
      type: 'Company Driver'
    }
  })

  return NextResponse.json(driver, { status: 201 })
}
