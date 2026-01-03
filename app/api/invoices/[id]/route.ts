import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { formatZodErrors, invoiceInputSchema } from '@/lib/validation'
import fs from 'fs/promises'
import path from 'path'

interface LoadInput {
  load_ref?: string | null;
  from_location: string;
  to_location: string;
  load_date: string;
  amount: string | number;
}

interface DeductionInput {
  deduction_type: string;
  amount: string | number;
  note?: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
    include: {
      company: true,
      driver: true,
      loads: true,
      deductions: true
    }
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (!isSuperAdmin && invoice.company_id !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(invoice)
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params
    const invoiceId = parseInt(id)
    try {
      const { user, response, isSuperAdmin } = await requireApiAuth()
      if (response) return response

      const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } })
      if (!existing) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      if (!isSuperAdmin && existing.company_id !== user?.company_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

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

      const driver = await prisma.driver.findUnique({ where: { id: driver_id } })
      if (!driver || driver.company_id !== company_id) {
        return NextResponse.json({ error: 'Driver not found for this company' }, { status: 400 })
      }

      const sentAt = status === 'sent'
        ? existing.sent_at || new Date()
        : status === 'paid'
          ? existing.sent_at || new Date()
          : null
      const paidAt = status === 'paid'
        ? existing.paid_at || new Date()
        : null

      const result = await prisma.$transaction(async (tx) => {
        const updatedInvoice = await tx.invoice.update({
            where: { id: invoiceId },
            data: {
                company_id,
                driver_id,
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
                currency
            }
        })

        await tx.invoiceLoad.deleteMany({ where: { invoice_id: invoiceId } })
        await tx.invoiceDeduction.deleteMany({ where: { invoice_id: invoiceId } })

        if (loads && loads.length > 0) {
            await tx.invoiceLoad.createMany({
                data: loads.map((l: LoadInput) => ({
                    invoice_id: invoiceId,
                    load_ref: l.load_ref ?? undefined,
                    from_location: l.from_location,
                    to_location: l.to_location,
                    load_date: new Date(l.load_date),
                    amount: parseFloat(l.amount.toString())
                }))
            })
        }

        if (deductions && deductions.length > 0) {
            await tx.invoiceDeduction.createMany({
                data: deductions.map((d: DeductionInput) => ({
                    invoice_id: invoiceId,
                    deduction_type: d.deduction_type,
                    amount: parseFloat(d.amount.toString()),
                    note: d.note ?? undefined
                }))
            })
        }

        return updatedInvoice
      })
  
      return NextResponse.json(result)
    } catch (error) {
      console.error(error)
      return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
    }
  }

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params
    const { user, response, isSuperAdmin } = await requireApiAuth()
    if (response) return response

    const existing = await prisma.invoice.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    if (!isSuperAdmin && existing.company_id !== user?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.invoice.delete({
        where: { id: parseInt(id) }
    })

    const pdfPath = path.join(process.cwd(), 'storage', 'pdfs', `${id}.pdf`)
    await fs.rm(pdfPath, { force: true })

    return NextResponse.json({ success: true })
}
