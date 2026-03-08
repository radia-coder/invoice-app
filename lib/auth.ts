import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

export async function getSessionUser() {
  // Electron desktop app: all requests carry x-electron-app header —
  // return the super_admin user without needing a session cookie.
  const headersList = await headers();
  if (headersList.get('x-electron-app') === 'true') {
    return prisma.user.findFirst({
      where: { role: 'super_admin' },
      include: { company: true },
    });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    include: { company: true }
  });

  return user;
}

export function isSuperAdmin(user: { role: string } | null) {
  return user?.role === 'super_admin';
}
