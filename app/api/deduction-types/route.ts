import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'

const DEFAULT_DEDUCTION_TYPES = [
  'Factoring',
  'Dispatch',
  'Fuel',
  'Maintenance',
  'Tolls/Violations',
  'Insurance',
  'Trailer',
  'Payback',
  'ELD',
  'Camera',
  'Advanced',
  'Other'
]

async function ensureDefaultDeductionTypes() {
  const existing = await prisma.deductionType.findMany({
    where: { is_default: true, company_id: null },
    select: { name: true }
  })
  const existingNames = new Set(existing.map((type) => type.name.toLowerCase()))
  const missing = DEFAULT_DEDUCTION_TYPES.filter(
    (name) => !existingNames.has(name.toLowerCase())
  )

  if (!missing.length) return

  await prisma.deductionType.createMany({
    data: missing.map((name) => ({
      name,
      company_id: null,
      is_default: true
    }))
  })
}

// GET /api/deduction-types?companyId=...
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
    await ensureDefaultDeductionTypes()

    // Get default types (company_id is null and is_default is true)
    // Plus company-specific types if companyId is provided
    const companyFilter = parsedCompanyId
      ? [{ company_id: parsedCompanyId }]
      : isSuperAdmin
        ? []
        : user?.company_id
          ? [{ company_id: user.company_id }]
          : []

    const types = await prisma.deductionType.findMany({
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
    console.error('Error fetching deduction types:', error)
    return NextResponse.json({ error: 'Failed to fetch deduction types' }, { status: 500 })
  }
}

// POST /api/deduction-types
// Create a new deduction type
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
    const existing = await prisma.deductionType.findFirst({
      where: {
        name: trimmedName,
        company_id: parsedCompanyId
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Deduction type already exists' }, { status: 409 })
    }

    const newType = await prisma.deductionType.create({
      data: {
        name: trimmedName,
        company_id: parsedCompanyId,
        is_default: false
      }
    })

    return NextResponse.json(newType, { status: 201 })
  } catch (error) {
    console.error('Error creating deduction type:', error)
    return NextResponse.json({ error: 'Failed to create deduction type' }, { status: 500 })
  }
}
