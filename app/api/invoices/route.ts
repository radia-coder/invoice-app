import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { formatZodErrors, invoiceInputSchema } from '@/lib/validation'
import { getInvoicePdfBuffer } from '@/lib/invoice-pdf'
import {
  buildAutoDeductionEntries,
  calculateAutoDeductions,
  getAutoDeductionConfigFromCompany,
  mergeDeductionsWithAuto,
  sumInsuranceDeductions
} from '@/lib/auto-deductions'

interface LoadInput {
  load_ref?: string | null;
  vendor?: string | null;
  from_location: string;
  to_location: string;
  load_date: string;
  delivery_date?: string | null;
  amount: string | number;
}

interface DeductionInput {
  deduction_type: string;
  amount: string | number;
  note?: string | null;
  deduction_date?: string | null;
}

export async function GET() {
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response

  const where = isSuperAdmin
    ? {}
    : { company_id: user?.company_id ?? -1 }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      company: true,
      driver: true,
    },
    orderBy: { created_at: 'desc' }
  })
  return NextResponse.json(invoices)
}

export async function POST(request: Request) {
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response

  try {
    const body = await request.json()
    const payload = {
      ...body,
      company_id: Number(body.company_id),
      driver_id: Number(body.driver_id),
      percent: Number(body.percent),
      tax_percent: body.tax_percent !== undefined ? Number(body.tax_percent) : 0,
      status: body.status || 'draft',
      currency: 'USD',
      loads: (body.loads || []).map((l: LoadInput) => ({
        ...l,
        amount: Number(l.amount)
      })),
      deductions: (body.deductions || []).map((d: DeductionInput) => ({
        ...d,
        amount: Number(d.amount)
      }))
    }

    const parsed = invoiceInputSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: formatZodErrors(parsed.error) },
        { status: 400 }
      )
    }

    const { 
      company_id, 
      driver_id, 
      week_start, 
      week_end, 
      invoice_date, 
      percent,
      tax_percent,
      status,
      due_date,
      notes, 
      currency,
      loads, 
      deductions 
    } = parsed.data

    if (!isSuperAdmin && company_id !== user?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch company to get prefix
    const company = await prisma.company.findUnique({ where: { id: company_id } })
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 400 })

    const driver = await prisma.driver.findUnique({ where: { id: driver_id } })
    if (!driver || driver.company_id !== company_id) {
      return NextResponse.json({ error: 'Driver not found for this company' }, { status: 400 })
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    let invoice_number: string | null = null
    for (let i = 0; i < 5; i += 1) {
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
      const candidate = `${company.invoice_prefix}${dateStr}-${random}`
      const existing = await prisma.invoice.findUnique({ where: { invoice_number: candidate } })
      if (!existing) {
        invoice_number = candidate
        break
      }
    }
    if (!invoice_number) {
      return NextResponse.json({ error: 'Failed to generate invoice number' }, { status: 500 })
    }

    const sentAt = status === 'sent' || status === 'paid' ? new Date() : null
    const paidAt = status === 'paid' ? new Date() : null

    const invoice = await prisma.invoice.create({
      data: {
        company_id,
        driver_id,
        invoice_number,
        week_start: new Date(week_start),
        week_end: new Date(week_end),
        invoice_date: new Date(invoice_date),
        percent,
        tax_percent,
        status,
        due_date: due_date ? new Date(due_date) : null,
        sent_at: sentAt,
        paid_at: paidAt,
        notes,
        currency,
      loads: {
        create: loads.map((l: LoadInput) => ({
          load_ref: l.load_ref ?? undefined,
          vendor: l.vendor ?? undefined,
          from_location: l.from_location,
          to_location: l.to_location,
          load_date: new Date(l.load_date),
          delivery_date: l.delivery_date ? new Date(l.delivery_date) : null,
          amount: parseFloat(l.amount.toString())
        }))
      },
        deductions: {
          create: deductions.map((d: DeductionInput) => ({
            deduction_type: d.deduction_type,
            amount: parseFloat(d.amount.toString()),
            note: d.note ?? undefined,
            deduction_date: d.deduction_date ? new Date(d.deduction_date) : null
          }))
        }
      },
      include: {
        company: true,
        driver: true,
        loads: true,
        deductions: true
      }
    })

    try {
      const yearStart = new Date(invoice.week_end.getFullYear(), 0, 1)
      const ytdInvoices = await prisma.invoice.findMany({
        where: {
          driver_id: invoice.driver_id,
          week_end: {
            gte: yearStart,
            lte: invoice.week_end
          }
        },
        select: { updated_at: true, deductions: true }
      })
      const ytdInsurance = ytdInvoices.reduce(
        (sum, ytdInvoice) => sum + sumInsuranceDeductions(ytdInvoice.deductions),
        0
      )
      const latestUpdatedAt = ytdInvoices.reduce((latest, ytdInvoice) => {
        return ytdInvoice.updated_at > latest ? ytdInvoice.updated_at : latest
      }, invoice.updated_at)

      const autoConfig = getAutoDeductionConfigFromCompany(invoice.company)
      const autoAmounts = calculateAutoDeductions(ytdInsurance, autoConfig)
      const autoEntries = buildAutoDeductionEntries(autoAmounts, autoConfig)
      const mergedDeductions = mergeDeductionsWithAuto(invoice.deductions, autoEntries)

      await getInvoicePdfBuffer({
        ...invoice,
        id: invoice.id,
        deductions: mergedDeductions,
        updated_at: latestUpdatedAt
      })
    } catch (error) {
      console.error('PDF warmup error:', error)
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
