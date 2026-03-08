import { session } from 'electron';
import { PORT, ADMIN_EMAIL, ADMIN_PASSWORD } from './config';

export async function performAutoLogin(): Promise<boolean> {
  console.log('[Auth] Performing auto-login...');
  try {
    const response = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    if (!response.ok) {
      console.error('[Auth] Login failed with status:', response.status);
      return false;
    }

    const setCookieHeader = response.headers.get('set-cookie');
    if (!setCookieHeader) {
      console.error('[Auth] No set-cookie header in login response');
      return false;
    }

    // Parse and inject all cookies
    const cookies = setCookieHeader.split(',').map((c) => c.trim());
    for (const cookieStr of cookies) {
      const parts = cookieStr.split(';').map((p) => p.trim());
      const [nameValue, ...attributes] = parts;
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx === -1) continue;

      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();

      const attrMap: Record<string, string | boolean> = {};
      for (const attr of attributes) {
        const [k, v] = attr.split('=').map((s) => s.trim());
        attrMap[k.toLowerCase()] = v ?? true;
      }

      // Map server's SameSite attribute to Electron's enum values
      const ss = String(attrMap['samesite'] ?? '').toLowerCase();
      const sameSite: 'strict' | 'lax' | 'no_restriction' | 'unspecified' =
        ss === 'strict' ? 'strict'
        : ss === 'none' ? 'no_restriction'
        : ss === 'lax' ? 'lax'
        : 'lax'; // default to lax for localhost

      await session.defaultSession.cookies.set({
        url: `http://localhost:${PORT}`,
        name,
        value,
        httpOnly: 'httponly' in attrMap,
        // no_restriction (SameSite=None) requires secure=true even on localhost
        secure: sameSite === 'no_restriction',
        sameSite,
        expirationDate: attrMap['max-age']
          ? Math.floor(Date.now() / 1000) + Number(attrMap['max-age'])
          : undefined,
      });
    }

    console.log('[Auth] Auto-login successful, cookies injected.');
    return true;
  } catch (err: any) {
    console.error('[Auth] Auto-login error:', err?.message ?? err);
    return false;
  }
}
