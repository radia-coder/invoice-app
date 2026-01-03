import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { checkRateLimit, getClientIP, isPublicIP } from '@/lib/rate-limit';
import { parseUserAgent } from '@/lib/user-agent';

async function getLocationFromIP(ip: string): Promise<{ city?: string; country?: string }> {
  if (!ip) {
    return {};
  }
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (!isPublicIP(normalized)) {
    return {};
  }
  try {
    const response = await fetch(`http://ip-api.com/json/${normalized}?fields=city,country`, {
      signal: AbortSignal.timeout(3000)
    });
    if (response.ok) {
      const data = await response.json();
      return { city: data.city, country: data.country };
    }
  } catch {
    // Silently fail - location is optional
  }
  return {};
}

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

    // Parse user agent for device info
    const userAgent = request.headers.get('user-agent');
    const deviceInfo = parseUserAgent(userAgent);

    // Get location from IP (non-blocking, best effort)
    const location = await getLocationFromIP(clientIP);

    // Save session to database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await prisma.userSession.create({
      data: {
        user_id: user.id,
        session_token: token,
        ip_address: clientIP,
        user_agent: userAgent,
        device_type: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        city: location.city,
        country: location.country,
        expires_at: expiresAt
      }
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
