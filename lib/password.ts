import crypto from 'crypto';

const ITERATIONS = 120000;
const KEY_LEN = 32;
const DIGEST = 'sha256';

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algo, iterStr, salt, hash] = stored.split('$');
  if (algo !== 'pbkdf2') return false;
  const iterations = Number(iterStr);
  if (!salt || !hash || !iterations) return false;
  const testHash = crypto.pbkdf2Sync(password, salt, iterations, KEY_LEN, DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
}
