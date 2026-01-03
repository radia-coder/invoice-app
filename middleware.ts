import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'invoice_session';

const PUBLIC_PATHS = ['/login', '/'];
const PUBLIC_PREFIXES = ['/_next', '/favicon.ico', '/public'];
const PUBLIC_FILE = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|json|map|woff2?|ttf|eot)$/i;

const decodeBase64Url = (input: string) => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
  return atob(base64 + pad);
};

const verifySessionTokenEdge = async (token: string) => {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error('AUTH_SECRET not configured');
    return null;
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = Uint8Array.from(decodeBase64Url(signature), (c) => c.charCodeAt(0));
  const dataBytes = encoder.encode(body);
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
  if (!valid) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(body));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionTokenEdge(token) : null;

  if (!payload) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)']
};
