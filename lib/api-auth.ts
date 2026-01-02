import { NextResponse } from 'next/server';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';

export async function requireApiAuth() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, response: null, isSuperAdmin: isSuperAdmin(user) };
}
