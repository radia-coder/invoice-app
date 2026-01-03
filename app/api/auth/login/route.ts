import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // Rate limiting: 5 attempts per 15 minutes per IP
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`login:${clientIP}`, 5, 15 * 60 * 1000);

    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) }
        }
      );
    }

    const body = await request.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });

    if (!user || !verifyPassword(String(password), user.password_hash)) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const token = createSessionToken({
      uid: user.id,
      role: user.role,
      company_id: user.company_id
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
}
