import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'

export async function GET() {
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response

  const where = isSuperAdmin
    ? {}
    : { id: user?.company_id ?? -1 }

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(companies)
}
