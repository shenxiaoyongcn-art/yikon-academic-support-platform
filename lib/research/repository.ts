import { env } from 'cloudflare:workers';
import { available, cents, localDay, WorkflowError, type Actor, type Budget, type Case, type Command, type History } from './model';
import { batchEligible, canReadStep, newCase, redact, transition, visible } from './workflow';
import { researchPolicy } from './access';
import { transitionStatements } from './persistence';

export async function nextNumber(prefix: 'REQ' | 'YKSR') {
  const month = localDay(Date.now()).slice(0, 7).replace('-', '');
  const row = await env.DB.prepare('INSERT INTO research_counters (key, value) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET value = value + 1 RETURNING value').bind(`${prefix}-${month}`).first<{ value: number }>();
  return `${prefix}-${month}-${String(row!.value).padStart(5, '0')}`;
}
export async function getCase(id: string, actor: Actor) {
  const row = await env.DB.prepare('SELECT data_json FROM research_cases_v2 WHERE id = ?').bind(id).first<{ data_json: string }>();
  if (!row) throw new WorkflowError('项目不存在。', 404);
  const c = JSON.parse(row.data_json) as Case;
  if (!visible(c, actor)) throw new WorkflowError('无权访问该项目。', 403);
  return c;
}
export async function getBudget(id: string): Promise<Budget | undefined> {
  if (!id) return undefined;
  const row = await env.DB.prepare('SELECT id, customer_id AS customerId, hospital, period, region, total_cents AS totalCents, used_cents AS usedCents, locked_cents AS lockedCents, revision, evidence FROM research_budget_packages WHERE id = ?').bind(id).first<Budget>();
  return row || undefined;
}
export async function allCases(actor: Actor) {
  // The module is intentionally isolated from the legacy work_items list.
  const result = await env.DB.prepare('SELECT data_json FROM research_cases_v2 ORDER BY updated_at DESC').all<{ data_json: string }>();
  return result.results.map(row => JSON.parse(row.data_json) as Case).filter(c => visible(c, actor));
}
export async function history(c: Case, actor: Actor) {
  const rows = await env.DB.prepare('SELECT id, revision, action, actor, from_stage, to_stage, note, snapshot_json, created_at FROM research_history_v2 WHERE case_id = ? ORDER BY revision DESC').bind(c.id).all<{ id: string; revision: number; action: string; actor: string; from_stage: Case['stage']; to_stage: Case['stage']; note: string; snapshot_json: string; created_at: number }>();
  return rows.results.map(row => {
    const snapshot = JSON.parse(row.snapshot_json) as Case;
    return { id: row.id, revision: row.revision, action: row.action, actor: row.actor, from: row.from_stage, to: row.to_stage, note: canReadStep(c, actor, row.from_stage) ? row.note : '专业意见按权限显示', at: row.created_at, baseline: snapshot.baseline, snapshot: redact(snapshot, actor) } satisfies History & { snapshot: Case };
  });
}
async function validateCustomer(c: Case, actor: Actor) {
  if (c.route === 'B' && !c.data.customerId) return;
  const customer = await env.DB.prepare('SELECT name, region FROM research_customers WHERE id = ?').bind(c.data.customerId || '').first<{ name: string; region: string }>();
  if (!customer || customer.name !== c.data.hospital || customer.region !== c.region) throw new WorkflowError('医院编号、名称与大区须匹配已导入的CRM主数据，不能自由文本新建重复医院。');
  if (!(actor.regions.includes('*') || actor.regions.includes(customer.region))) throw new WorkflowError('当前账号没有该医院所属区域的业务权限。', 403);
}
export async function createCase(actor: Actor, input: { data?: Case['data']; route?: Case['route']; clientId?: string }) {
  if (!actor.roles.some(r => ['applicant', 'pmo', 'product', 'technical', 'sponsor'].includes(r))) throw new WorkflowError('账号没有需求发起权限。', 403);
  if (input.route && !['A', 'B', 'C'].includes(input.route)) throw new WorkflowError('项目性质无效。');
  if (input.clientId && !/^[a-f0-9-]{36}$/.test(input.clientId)) throw new WorkflowError('请求唯一标识无效。');
  if (input.clientId) {
    const prior = await env.DB.prepare('SELECT id FROM research_cases_v2 WHERE id = ?').bind(input.clientId).first<{ id: string }>();
    if (prior) { const old = await getCase(prior.id, actor); if (old.creatorEmail !== actor.email) throw new WorkflowError('请求标识冲突。', 409); return old; }
  }
  const now = Date.now(), c = newCase(input.clientId || crypto.randomUUID(), await nextNumber('REQ'), actor, now, input.data, input.route);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO research_cases_v2 (id, request_no, project_no, route, stage, revision, creator_email, team, region, data_json, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(c.id, c.requestNo, c.route, c.stage, c.revision, c.creatorEmail, c.team, c.region, JSON.stringify(c), now, now),
    env.DB.prepare('INSERT INTO research_history_v2 (id, case_id, revision, action, actor, from_stage, to_stage, note, snapshot_json, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), c.id, 'create', actor.email, 'draft', 'draft', '创建需求草稿', JSON.stringify(c), now),
  ]);
  return c;
}
export async function execute(c: Case, command: Command, actor: Actor) {
  const budget = await getBudget(command.data?.budgetId || c.data.budgetId || '');
  if (command.batchId && !batchEligible(c, budget)) throw new WorkflowError('该需求不符合预算内月度A类批量预审条件，已排除。');
  const next = transition(c, command, { actor, now: Date.now(), policy: researchPolicy(), budget, projectNo: c.stage === 'commitment' && command.action === 'advance' && !c.projectNo ? await nextNumber('YKSR') : undefined });
  if (command.action === 'advance' || command.action === 'resubmit') await validateCustomer(next, actor);
  if (command.centers) for (const center of next.centers) {
    const row = await env.DB.prepare('SELECT name FROM research_customers WHERE id = ?').bind(center.customerId).first<{ name: string }>();
    if (!row || row.name !== center.name) throw new WorkflowError('中心必须匹配CRM医院主数据。');
  }
  const statements = transitionStatements(c, next, command, actor).map(s => env.DB.prepare(s.sql).bind(...s.values));
  try { await env.DB.batch(statements); }
  catch { throw new WorkflowError('记录或预算余额已变化，全部操作已回滚。请刷新后核对并重试。', 409); }
  return next;
}

export async function maintainBudget(actor: Actor, input: Record<string, unknown>) {
  if (!actor.roles.includes('budget')) throw new WorkflowError('只有商务预算管理员可维护预算包。', 403);
  const id = String(input.id || '').trim(), customerId = String(input.customerId || '').trim(), period = String(input.period || '').trim(), evidence = String(input.evidence || '').trim();
  if (!id || id.length > 100 || !customerId || !/^[0-9]{4}(-Q[1-4])?$/.test(period) || !evidence) throw new WorkflowError('预算包须填写唯一编号、CRM医院编号、年度 / 季度及批准依据。');
  const customer = await env.DB.prepare('SELECT name, region FROM research_customers WHERE id = ?').bind(customerId).first<{ name: string; region: string }>();
  if (!customer || !(actor.regions.includes('*') || actor.regions.includes(customer.region))) throw new WorkflowError('医院主数据不存在或无该区域权限。', 403);
  const total = cents(String(input.total || '')), now = Date.now(), old = await getBudget(id);
  if (old && (old.customerId !== customerId || old.period !== period)) throw new WorkflowError('已有预算包不能更换医院或期间。');
  if (old && total < old.usedCents + old.lockedCents) throw new WorkflowError('预算总额不能低于已用与已锁定之和。');
  const audit = env.DB.prepare('INSERT INTO research_budget_audit (id, budget_id, actor, total_delta, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), id, actor.email, total - (old?.totalCents || 0), evidence.slice(0, 2000), now);
  if (old) {
    if (Number(input.revision) !== old.revision) throw new WorkflowError('预算包已更新，请刷新。', 409);
    const guard = env.DB.prepare('INSERT INTO research_budget_audit (id, budget_id, actor, total_delta, evidence, created_at) VALUES (?, ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM research_budget_packages WHERE id = ? AND revision = ?) THEN ? ELSE NULL END, ?)').bind(crypto.randomUUID(), id, actor.email, total - old.totalCents, id, old.revision, evidence.slice(0, 2000), now);
    await env.DB.batch([guard, env.DB.prepare('UPDATE research_budget_packages SET total_cents = ?, evidence = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(total, evidence.slice(0, 2000), now, id, old.revision)]);
  } else await env.DB.batch([env.DB.prepare('INSERT INTO research_budget_packages (id, customer_id, hospital, period, region, total_cents, evidence, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, customerId, customer.name, period, customer.region, total, evidence.slice(0, 2000), now), audit]);
  return { saved: true, availableCents: total - (old?.usedCents || 0) - (old?.lockedCents || 0) };
}

export { available };
