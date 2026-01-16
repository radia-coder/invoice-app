import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { buildInvoicePdfFilename, getInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { type InvoiceData } from '@/components/InvoiceTemplate';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import {
  buildAutoDeductionEntries,
  calculateAutoDeductions,
  getAutoDeductionConfigFromCompany,
  mergeDeductionsWithAuto,
  sumInsuranceDeductions
} from '@/lib/auto-deductions';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

const getPdfBuffer = async (invoice: any) => {
  const yearStart = new Date(invoice.week_end.getFullYear(), 0, 1);
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
    }
  });
  const ytdInsurance = ytdInvoices.reduce(
    (sum, ytdInvoice) => sum + sumInsuranceDeductions(ytdInvoice.deductions),
    0
  );
  const latestUpdatedAt = ytdInvoices.reduce((latest, ytdInvoice) => {
    return ytdInvoice.updated_at > latest ? ytdInvoice.updated_at : latest;
  }, invoice.updated_at);

  const autoConfig = getAutoDeductionConfigFromCompany(invoice.company);
  const autoAmounts = calculateAutoDeductions(ytdInsurance, autoConfig);
  const autoEntries = buildAutoDeductionEntries(autoAmounts, autoConfig);
  const mergedDeductions = mergeDeductionsWithAuto(invoice.deductions, autoEntries);

  let ytdGrossIncome = 0;
  let ytdNetPay = 0;
  let ytdCredit = 0;
  ytdInvoices.forEach((ytdInvoice) => {
    const totals = calculateInvoiceTotals({
      loads: ytdInvoice.loads,
      deductions: ytdInvoice.deductions,
      credits: ytdInvoice.credits || [],
      percent: ytdInvoice.percent,
      tax_percent: ytdInvoice.tax_percent || 0,
      driver_type: ytdInvoice.driver.type,
      manual_net_pay: ytdInvoice.manual_net_pay
    });
    ytdGrossIncome += totals.gross;
    ytdNetPay += totals.net;
    ytdCredit += (ytdInvoice.credits || []).reduce((sum, credit) => {
      const amount = credit.amount || 0;
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);
  });

  const invoiceData: InvoiceData = {
    ...invoice,
    company: invoice.company,
    driver: invoice.driver,
    loads: invoice.loads,
    deductions: mergedDeductions,
    credits: invoice.credits,
    ytdGrossIncome,
    ytdNetPay,
    ytdCredit
  };

  return getInvoicePdfBuffer({
    ...invoiceData,
    id: invoice.id,
    updated_at: latestUpdatedAt
  });
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response, isSuperAdmin } = await requireApiAuth();
    if (response) return response;

    const { id } = await params;
    const invoiceId = parseInt(id);
    const body = await request.json();
    const to = String(body?.to || '').trim();
    const message = String(body?.message || '');

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { company: true, driver: true, loads: true, deductions: true }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    if (!isSuperAdmin && invoice.company_id !== user?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const recipient = to || invoice.driver.email;
    if (!recipient) {
      return NextResponse.json({ error: 'Recipient email is required.' }, { status: 400 });
    }

    if (!process.env.SMTP_HOST) {
      return NextResponse.json({ error: 'SMTP is not configured.' }, { status: 500 });
    }

    const pdfBuffer = await getPdfBuffer(invoice);
    const filename = buildInvoicePdfFilename(
      invoice.driver?.name,
      invoice.due_date || invoice.invoice_date,
      invoice.invoice_number
    );

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'invoices@example.com',
      to: recipient,
      subject: `Invoice ${invoice.invoice_number}`,
      text: message || `Attached is invoice ${invoice.invoice_number}.`,
      attachments: [
        {
          filename,
          content: Buffer.from(pdfBuffer)
        }
      ]
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: invoice.status === 'paid' ? 'paid' : 'sent',
        sent_at: invoice.sent_at || new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send invoice error:', error);
    return NextResponse.json({ error: 'Failed to send invoice.' }, { status: 500 });
  }
}
