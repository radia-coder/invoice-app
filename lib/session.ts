import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'invoice_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

export interface SessionPayload {
  uid: number;
  role: string;
  company_id: number | null;
  exp: number;
}

const getSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required');
  }
  return secret;
};

const sign = (data: string) => {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
};

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>) {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = sign(body);
  if (signature.length !== expected.length) return null;
  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
