import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'

const DEFAULT_CREDIT_TYPES = [
  'Advance',
  'Bonus',
  'Reimbursement',
  'Detention',
  'Layover',
  'Other'
]

async function ensureDefaultCreditTypes() {
  const existing = await prisma.creditType.findMany({
    where: { is_default: true, company_id: null },
    select: { name: true }
  })
  const existingNames = new Set(existing.map((type) => type.name.toLowerCase()))
  const missing = DEFAULT_CREDIT_TYPES.filter(
    (name) => !existingNames.has(name.toLowerCase())
  )

  if (!missing.length) return

  await prisma.creditType.createMany({
    data: missing.map((name) => ({
      name,
      company_id: null,
      is_default: true
    }))
  })
}

// GET /api/credit-types?companyId=...
// Returns default types + company-specific types
export async function GET(request: Request) {
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  const parsedCompanyId = companyId ? parseInt(companyId) : null

  if (!isSuperAdmin && parsedCompanyId && parsedCompanyId !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await ensureDefaultCreditTypes()

    // Get default types (company_id is null and is_default is true)
    // Plus company-specific types if companyId is provided
    const companyFilter = parsedCompanyId
      ? [{ company_id: parsedCompanyId }]
      : isSuperAdmin
        ? []
        : user?.company_id
          ? [{ company_id: user.company_id }]
          : []

    const types = await prisma.creditType.findMany({
      where: {
        OR: [
          { is_default: true, company_id: null },
          ...companyFilter
        ]
      },
      orderBy: [
        { is_default: 'desc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(types)
  } catch (error) {
    console.error('Error fetching credit types:', error)
    return NextResponse.json({ error: 'Failed to fetch credit types' }, { status: 500 })
  }
}

// POST /api/credit-types
// Create a new credit type
export async function POST(request: Request) {
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response

  try {
    const body = await request.json()
    const { name, companyId } = body
    const parsedCompanyId = companyId ? parseInt(companyId) : null

    if (!isSuperAdmin && parsedCompanyId && parsedCompanyId !== user?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()

    // Check if type already exists (globally or for this company)
    const existing = await prisma.creditType.findFirst({
      where: {
        name: trimmedName,
        company_id: parsedCompanyId
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Credit type already exists' }, { status: 409 })
    }

    const newType = await prisma.creditType.create({
      data: {
        name: trimmedName,
        company_id: parsedCompanyId,
        is_default: false
      }
    })

    return NextResponse.json(newType, { status: 201 })
  } catch (error) {
    console.error('Error creating credit type:', error)
    return NextResponse.json({ error: 'Failed to create credit type' }, { status: 500 })
  }
}
