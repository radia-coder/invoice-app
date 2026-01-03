import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiAuth } from '@/lib/api-auth';

export const runtime = 'nodejs';

// GET /api/sessions - Get all sessions (super_admin only)
export async function GET(request: Request) {
  try {
    const { user, response, isSuperAdmin } = await requireApiAuth();
    if (response) return response;

    // Only super_admin can view all sessions
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const sessions = await prisma.userSession.findMany({
      where: activeOnly ? { is_active: true } : {},
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            company: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { last_active: 'desc' }
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// DELETE /api/sessions - Revoke a session
export async function DELETE(request: Request) {
  try {
    const { user, response, isSuperAdmin } = await requireApiAuth();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const sessionIdNum = Number.parseInt(sessionId, 10);
    if (Number.isNaN(sessionIdNum)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Find the session
    const session = await prisma.userSession.findUnique({
      where: { id: sessionIdNum },
      include: { user: true }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Only super_admin can revoke any session, others can only revoke their own
    if (!isSuperAdmin && session.user_id !== user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Deactivate the session
    await prisma.userSession.update({
      where: { id: sessionIdNum },
      data: { is_active: false }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke session error:', error);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}
