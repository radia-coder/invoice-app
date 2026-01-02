import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import { generateInvoiceHTML, InvoiceData } from '@/components/InvoiceTemplate'
import { requireApiAuth } from '@/lib/api-auth'
import fs from 'fs/promises'
import path from 'path'

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

  const pdfDir = path.join(process.cwd(), 'storage', 'pdfs')
  const pdfPath = path.join(pdfDir, `${invoice.id}.pdf`)

  try {
    const stats = await fs.stat(pdfPath)
    if (stats.mtimeMs >= invoice.updated_at.getTime()) {
      const cached = await fs.readFile(pdfPath)
      return new NextResponse(cached as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`
        }
      })
    }
  } catch {
    // Cache miss, continue to generate.
  }

  // 2. Render Component to HTML
  // We cast to InvoiceData because the DB types match the shape we expect (mostly)
  // We might need to map dates if they are Date objects (Prisma returns Date objects)
  const invoiceData: InvoiceData = {
    ...invoice,
    // Ensure nested objects are compatible
    company: invoice.company,
    driver: invoice.driver,
    loads: invoice.loads,
    deductions: invoice.deductions
  }

  const componentHtml = generateInvoiceHTML(invoiceData)

  // 3. Wrap in full HTML document with Tailwind
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoice.invoice_number}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
           @page { margin: 20px; }
           body { -webkit-print-color-adjust: exact; }
        </style>
      </head>
      <body>
        ${componentHtml}
      </body>
    </html>
  `

  // 4. Generate PDF
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    })

    await browser.close()

    await fs.mkdir(pdfDir, { recursive: true })
    await fs.writeFile(pdfPath, pdfBuffer)

    // 5. Return Response
    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`
      }
    })

  } catch (error) {
    console.error('PDF Generation Error:', error)
    if (browser) await browser.close()
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
