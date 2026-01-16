import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { buildInvoicePdfFilename, getInvoicePdfBuffer } from '@/lib/invoice-pdf'
import { requireApiAuth } from '@/lib/api-auth'
import { type InvoiceData } from '@/components/InvoiceTemplate'
import { calculateInvoiceTotals } from '@/lib/invoice-calculations'

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
      deductions: true,
      credits: true
    }
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (!isSuperAdmin && invoice.company_id !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // YTD year starts on December 21st
  const weekEndDate = new Date(invoice.week_end)
  const currentYear = weekEndDate.getFullYear()
  const currentMonth = weekEndDate.getMonth() // 0-11
  const currentDay = weekEndDate.getDate()

  // If we're in December on or after the 21st, year starts Dec 21 of current year
  // Otherwise, year starts Dec 21 of previous year
  const yearStart = (currentMonth === 11 && currentDay >= 21)
    ? new Date(currentYear, 11, 21) // Dec 21 of current year
    : new Date(currentYear - 1, 11, 21) // Dec 21 of previous year

  const ytdInvoices = await prisma.invoice.findMany({
    where: {
      driver_id: invoice.driver_id,
      week_end: {
        gte: yearStart,
        lte: invoice.week_end
      }
    },
    include: {
      loads: true,
      deductions: true,
      credits: true,
      driver: true
    },
    orderBy: { week_end: 'asc' }
  })

  // Calculate YTD Gross Income and YTD Net Pay
  let ytdGrossIncome = 0
  let ytdNetPay = 0
  let ytdCredit = 0

  ytdInvoices.forEach((ytdInvoice) => {
    const totals = calculateInvoiceTotals({
      loads: ytdInvoice.loads,
      deductions: ytdInvoice.deductions,
      credits: ytdInvoice.credits || [],
      percent: ytdInvoice.percent,
      tax_percent: ytdInvoice.tax_percent || 0,
      driver_type: ytdInvoice.driver.type,
      manual_net_pay: ytdInvoice.manual_net_pay
    })
    ytdGrossIncome += totals.gross
    ytdNetPay += totals.net
    ytdCredit += (ytdInvoice.credits || []).reduce((sum, credit) => {
      const amount = credit.amount || 0
      return amount < 0 ? sum + Math.abs(amount) : sum
    }, 0)
  })

  const invoiceData: InvoiceData = {
    ...invoice,
    // Ensure nested objects are compatible
    company: invoice.company,
    driver: invoice.driver,
    loads: invoice.loads,
    deductions: invoice.deductions,
    credits: invoice.credits,
    ytdGrossIncome,
    ytdNetPay,
    ytdCredit
  }

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
      credits: invoice.credits,
      id: invoice.id,
      updated_at: latestUpdatedAt,
      ytdGrossIncome,
      ytdNetPay,
      ytdCredit
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
