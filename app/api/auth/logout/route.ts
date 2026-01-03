import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export async function POST() {
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
