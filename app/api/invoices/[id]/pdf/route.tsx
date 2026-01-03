import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getInvoicePdfBuffer } from '@/lib/invoice-pdf'
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

  const etag = `W/"invoice-${invoice.id}-${invoice.updated_at.getTime()}"`
  const lastModified = invoice.updated_at.toUTCString()
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

  const invoiceData: InvoiceData = {
    ...invoice,
    // Ensure nested objects are compatible
    company: invoice.company,
    driver: invoice.driver,
    loads: invoice.loads,
    deductions: invoice.deductions
  }
  try {
    const pdfBuffer = await getInvoicePdfBuffer({
      ...invoiceData,
      id: invoice.id,
      updated_at: invoice.updated_at
    })

    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
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
