import { requireActor } from '@/lib/security/access';
import { defaultPolicy, roleNames, WorkflowError, type Actor, type Policy, type Role } from './model';

// Membership and workflow roles are server-owned. Never trust a role sent by the client.
export async function researchActor(): Promise<Actor> {
  const identity = await requireActor();
  let bindings: Record<string, { roles?: Role[]; regions?: string[]; team?: string }>;
  try { bindings = JSON.parse(process.env.RESEARCH_ROLE_BINDINGS || '{}'); } catch { throw new WorkflowError('科研角色配置有误，请联系IT。', 503); }
  const email = identity.email.toLowerCase(), entry = bindings[email];
  if (!entry || !Array.isArray(entry.roles) || !entry.roles.length) throw new WorkflowError('账号尚未分配科研模块权限。可先使用流程设计预览，部门账号由IT映射。', 403);
  return { id: identity.id, email, name: identity.displayName || email, roles: entry.roles.filter((r): r is Role => r in roleNames), regions: Array.isArray(entry.regions) ? entry.regions : [], team: entry.team || '' };
}
export function researchPolicy(): Policy {
  const cap = process.env.RESEARCH_AUTHORIZATION_CENTS;
  return { ...defaultPolicy, authorizationCents: cap && /^\d+$/.test(cap) ? Number(cap) : null };
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new WorkflowError('请求来源无效。', 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new WorkflowError('拒绝跨站写入。', 403);
}
