import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, isSuperAdmin } = await requireApiAuth();
  if (response) return response;

  const { id } = await params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) {
    return NextResponse.json({ error: 'Invalid deduction type.' }, { status: 400 });
  }

  const type = await prisma.deductionType.findUnique({ where: { id: typeId } });
  if (!type) {
    return NextResponse.json({ error: 'Deduction type not found.' }, { status: 404 });
  }

  if (type.is_default) {
    return NextResponse.json({ error: 'Default deduction types cannot be deleted.' }, { status: 400 });
  }

  if (!isSuperAdmin && type.company_id !== user?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.deductionType.delete({ where: { id: typeId } });
  return NextResponse.json({ success: true });
}
