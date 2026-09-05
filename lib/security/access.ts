import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getBmpSessionIdentity } from './bmp-session';

export async function getActor() {
  const user = await getChatGPTUser();
  const bmpIdentity = user ? null : await getBmpSessionIdentity();
  if (!user && !bmpIdentity) return null;
  const admins = new Set((process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  const email = user?.email || bmpIdentity!.email;
  const role = admins.has(email.toLowerCase()) ? 'admin' as const : 'member' as const;
  return {
    id: user?.userId || bmpIdentity!.userId,
    email,
    displayName: user?.displayName || bmpIdentity!.name,
    role,
    dataRegions: role === 'admin' ? ['*'] : dataRegionsFor(email),
  };
}

function dataRegionsFor(email: string): string[] {
  let scopes: Record<string, { regions?: unknown }> = {};
  try { scopes = JSON.parse(process.env.PLATFORM_DATA_SCOPES || '{}') as Record<string, { regions?: unknown }>; } catch { return []; }
  const regions = scopes[email.toLowerCase()]?.regions;
  if (!Array.isArray(regions)) return [];
  return [...new Set(regions.filter((region): region is string => typeof region === 'string').map(region => region.trim()).filter(Boolean))].slice(0, 100);
}

export async function requireActor() {
  const actor = await getActor();
  if (!actor) throw new AccessDeniedError(401, '请先登录BMP账号，或切换到“流程设计预览”查看虚拟流程。');
  return actor;
}

export async function requireAdmin() {
  const actor = await requireActor();
  if (actor.role !== 'admin') throw new AccessDeniedError(403, '当前账号没有管理员权限。');
  return actor;
}

export class AccessDeniedError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
