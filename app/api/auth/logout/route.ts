import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Get the current session token to deactivate it
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    // Deactivate session in database if token exists
    if (sessionToken) {
      await prisma.userSession.updateMany({
        where: { session_token: sessionToken },
        data: { is_active: false }
      });
    }
  } catch (error) {
    console.error('Logout session deactivation error:', error);
    // Continue with logout even if DB update fails
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/',
    maxAge: 0,
    expires: new Date(0) // Explicit past date for immediate expiration
  });
  return response;
}
