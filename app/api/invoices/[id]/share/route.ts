import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';

export const runtime = 'nodejs';

const generateToken = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response, isSuperAdmin } = await requireApiAuth();
    if (response) return response;

    const { id } = await params;
    const invoiceId = Number.parseInt(id, 10);
    if (Number.isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice id.' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!isSuperAdmin && invoice.company_id !== user?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    let token = invoice.public_token;
    const expired = invoice.public_token_expires_at && invoice.public_token_expires_at < now;
    if (!token || expired) {
      token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { public_token: token, public_token_expires_at: expiresAt }
      });
    }

    const configuredBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, '');
    const baseUrl = configuredBaseUrl || new URL(request.url).origin;
    return NextResponse.json({
      token,
      url: `${baseUrl}/public/invoices/${token}/pdf`
    });
  } catch (error) {
    console.error('Share link error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create PDF link.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, isSuperAdmin } = await requireApiAuth();
  if (response) return response;

  const { id } = await params;
  const invoiceId = parseInt(id);

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (!isSuperAdmin && invoice.company_id !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { public_token: null, public_token_expires_at: null }
  });

  return NextResponse.json({ success: true });
}
