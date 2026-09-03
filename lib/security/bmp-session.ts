import { cookies } from 'next/headers';
import { env } from 'cloudflare:workers';

export const BMP_SESSION_COOKIE = 'yikon_bmp_session';
export const BMP_IDENTITY_COOKIE = 'yikon_bmp_identity';

export type BmpSessionIdentity = {
  userId: string;
  name: string;
  email: string;
};

export async function getBmpSessionToken() {
  return (await cookies()).get(BMP_SESSION_COOKIE)?.value || '';
}

export async function getBmpSessionIdentity(): Promise<BmpSessionIdentity | null> {
  const token = await getBmpSessionToken();
  if (!token) return null;
  try {
    const row = await env.DB.prepare('SELECT identity_json FROM platform_sessions WHERE token_hash = ? AND expires_at > ?').bind(await bmpTokenHash(token), Date.now()).first<{ identity_json: string }>();
    if (!row) return null;
    const parsed = JSON.parse(row.identity_json) as Partial<BmpSessionIdentity>;
    if (!parsed.email || !parsed.name) return null;
    return {
      userId: parsed.userId || `bmp:${parsed.email.toLowerCase()}`,
      name: parsed.name,
      email: parsed.email.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function bmpTokenHash(token: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export function encodeBmpIdentity(identity: BmpSessionIdentity) {
  const bytes = new TextEncoder().encode(JSON.stringify(identity));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

