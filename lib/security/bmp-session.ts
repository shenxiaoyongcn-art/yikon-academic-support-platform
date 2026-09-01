import { cookies } from 'next/headers';

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
  const encoded = (await cookies()).get(BMP_IDENTITY_COOKIE)?.value;
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as Partial<BmpSessionIdentity>;
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

export function encodeBmpIdentity(identity: BmpSessionIdentity) {
  const bytes = new TextEncoder().encode(JSON.stringify(identity));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

