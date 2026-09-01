import { getChatGPTUser } from '@/app/chatgpt-auth';

export async function getActor() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const admins = new Set((process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  return {
    id: user.userId,
    email: user.email,
    displayName: user.displayName,
    role: admins.has(user.email.toLowerCase()) ? 'admin' as const : 'member' as const,
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
