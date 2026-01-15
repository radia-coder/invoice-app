import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { buildInvoicePdfFilename, getInvoicePdfBuffer } from '@/lib/invoice-pdf'
import { requireApiAuth } from '@/lib/api-auth'
import { type InvoiceData } from '@/components/InvoiceTemplate'

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response
  
  // 1. Fetch Data
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

  const invoiceData: InvoiceData = {
    ...invoice,
    // Ensure nested objects are compatible
    company: invoice.company,
    driver: invoice.driver,
    loads: invoice.loads,
    deductions: invoice.deductions
  }

  const yearStart = new Date(invoice.week_end.getFullYear(), 0, 1)
  const ytdInvoices = await prisma.invoice.findMany({
    where: {
      driver_id: invoice.driver_id,
      week_end: {
        gte: yearStart,
        lte: invoice.week_end
      }
    },
    select: { updated_at: true }
  })

  const latestUpdatedAt = ytdInvoices.reduce((latest, ytdInvoice) => {
    return ytdInvoice.updated_at > latest ? ytdInvoice.updated_at : latest
  }, invoice.updated_at)

  const etag = `W/"invoice-${invoice.id}-${latestUpdatedAt.getTime()}"`
  const lastModified = latestUpdatedAt.toUTCString()
  const ifNoneMatch = request.headers.get('if-none-match')
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'Cache-Control': 'private, max-age=3600, must-revalidate',
        'ETag': etag,
        'Last-Modified': lastModified
      }
    })
  }

  const filename = buildInvoicePdfFilename(
    invoice.driver?.name,
    invoice.due_date || invoice.invoice_date,
    invoice.invoice_number
  )

  try {
    const pdfBuffer = await getInvoicePdfBuffer({
      ...invoiceData,
      deductions: invoice.deductions,
      id: invoice.id,
      updated_at: latestUpdatedAt
    })

    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600, must-revalidate',
        'ETag': etag,
        'Last-Modified': lastModified
      }
    })
  } catch (error) {
    console.error('PDF Generation Error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
