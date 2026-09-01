import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getBmpSessionIdentity } from './bmp-session';

export async function getActor() {
  const user = await getChatGPTUser();
  const bmpIdentity = user ? null : await getBmpSessionIdentity();
  if (!user && !bmpIdentity) return null;
  const admins = new Set((process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  const email = user?.email || bmpIdentity!.email;
  return {
    id: user?.userId || bmpIdentity!.userId,
    email,
    displayName: user?.displayName || bmpIdentity!.name,
    role: admins.has(email.toLowerCase()) ? 'admin' as const : 'member' as const,
  };
}

export async function requireActor() {
  const actor = await getActor();
  if (!actor) throw new AccessDeniedError(401, 'Authentication required.');
  return actor;
}

export async function requireAdmin() {
  const actor = await requireActor();
  if (actor.role !== 'admin') throw new AccessDeniedError(403, 'Administrator role required.');
  return actor;
}

export class AccessDeniedError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
