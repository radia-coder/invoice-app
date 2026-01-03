// Simple in-memory rate limiter
// For production with multiple instances, use Redis-based solution

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const isValidIPv4 = (ip: string) => {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const num = Number(part);
    return num >= 0 && num <= 255;
  });
};

const normalizeIP = (raw: string) => {
  let value = raw.trim();
  if (!value) return '';
  value = value.replace(/^for=/i, '').trim();
  value = value.replace(/^"|"$/g, '');
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end !== -1) {
      value = value.slice(1, end);
    }
  }
  if (value.startsWith('::ffff:')) {
    value = value.slice(7);
  }
  if (value.includes(':') && value.includes('.') && isValidIPv4(value.split(':')[0])) {
    value = value.split(':')[0];
  }
  return value;
};

const isPrivateIP = (ip: string) => {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('ff')) return true;

  if (isValidIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 0) return true;
  }

  return false;
};

export const isPublicIP = (ip: string) => {
  if (!ip) return false;
  const lower = ip.toLowerCase();
  if (lower === 'unknown' || lower === 'localhost') return false;
  return !isPrivateIP(ip);
};

const extractForwardedFor = (value: string) => {
  const entries = value.split(',');
  const results: string[] = [];
  for (const entry of entries) {
    const params = entry.split(';');
    for (const param of params) {
      const [key, val] = param.trim().split('=');
      if (key && key.toLowerCase() === 'for' && val) {
        results.push(val);
      }
    }
  }
  return results;
};

/**
 * Check rate limit for a given identifier
 * @param identifier - Usually IP address or user ID
 * @param maxAttempts - Maximum attempts allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes default
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // No record or expired window - start fresh
  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: maxAttempts - 1, resetAt };
  }

  // Within window - check count
  if (record.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  // Increment count
  record.count++;
  return { allowed: true, remaining: maxAttempts - record.count, resetAt: record.resetAt };
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  const candidates: string[] = [];
  const pushIfValue = (value: string | null | undefined) => {
    if (!value) return;
    candidates.push(value);
  };

  pushIfValue(request.headers.get('cf-connecting-ip'));
  pushIfValue(request.headers.get('true-client-ip'));
  pushIfValue(request.headers.get('x-real-ip'));

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    candidates.push(...forwarded.split(','));
  }

  const forwardedHeader = request.headers.get('forwarded');
  if (forwardedHeader) {
    candidates.push(...extractForwardedFor(forwardedHeader));
  }

  pushIfValue(request.headers.get('x-client-ip'));
  pushIfValue(request.headers.get('fastly-client-ip'));
  pushIfValue(request.headers.get('x-cluster-client-ip'));
  pushIfValue(request.headers.get('x-appengine-user-ip'));

  const normalized = candidates
    .map(normalizeIP)
    .filter((ip) => ip && ip.toLowerCase() !== 'unknown');

  const publicIP = normalized.find((ip) => isPublicIP(ip));
  if (publicIP) return publicIP;
  return normalized[0] || 'unknown';
}
