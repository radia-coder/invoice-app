import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';

const VALID_STATUS = ['draft', 'sent', 'paid'] as const;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, isSuperAdmin } = await requireApiAuth();
  if (response) return response;

  const { id } = await params;
  const invoiceId = parseInt(id);
  const body = await request.json();
  const status = body?.status as string;

  if (!VALID_STATUS.includes(status as any)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (!isSuperAdmin && invoice.company_id !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sent_at = status === 'sent'
    ? invoice.sent_at || new Date()
    : status === 'paid'
      ? invoice.sent_at || new Date()
      : null;
  const paid_at = status === 'paid' ? invoice.paid_at || new Date() : null;

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status, sent_at, paid_at }
  });

  return NextResponse.json(updated);
}
