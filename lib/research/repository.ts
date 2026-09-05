import { env } from 'cloudflare:workers';
import { available, localDay, normalizeCase, WorkflowError, type Actor, type Budget, type Case, type Command, type CustomerContact, type History, type StakeholderInput } from './model';
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
  const c = normalizeCase(JSON.parse(row.data_json) as Case);
  if (!visible(c, actor)) throw new WorkflowError('无权访问该项目。', 403);
  return c;
}
export async function getBudget(id: string): Promise<Budget | undefined> {
  if (!id) return undefined;
  const row = await env.DB.prepare("SELECT id, customer_id AS customerId, hospital, period, region, total_cents AS totalCents, used_cents AS usedCents, locked_cents AS lockedCents, revision, evidence, source_system AS sourceSystem, external_object_id AS externalObjectId, source_updated_at AS sourceUpdatedAt, synced_at AS syncedAt, verification_status AS verificationStatus FROM research_budget_packages WHERE id = ? AND source_system = 'bmp' AND verification_status = 'verified' AND external_object_id IS NOT NULL AND source_updated_at IS NOT NULL AND synced_at IS NOT NULL").bind(id).first<Budget>();
  return row || undefined;
}
export async function allCases(actor: Actor) {
  // The module is intentionally isolated from the legacy work_items list.
  const result = await env.DB.prepare('SELECT data_json FROM research_cases_v2 ORDER BY updated_at DESC').all<{ data_json: string }>();
  return result.results.map(row => normalizeCase(JSON.parse(row.data_json) as Case)).filter(c => visible(c, actor));
}
export async function history(c: Case, actor: Actor) {
  const rows = await env.DB.prepare('SELECT id, revision, action, actor, from_stage, to_stage, note, snapshot_json, created_at FROM research_history_v2 WHERE case_id = ? ORDER BY revision DESC').bind(c.id).all<{ id: string; revision: number; action: string; actor: string; from_stage: Case['stage']; to_stage: Case['stage']; note: string; snapshot_json: string; created_at: number }>();
  return rows.results.map(row => {
    const snapshot = normalizeCase(JSON.parse(row.snapshot_json) as Case);
    return { id: row.id, revision: row.revision, action: row.action, actor: row.actor, from: row.from_stage, to: row.to_stage, note: canReadStep(c, actor, row.from_stage) ? row.note : '专业意见按权限显示', at: row.created_at, baseline: snapshot.baseline, snapshot: redact(snapshot, actor) } satisfies History & { snapshot: Case };
  });
}
async function validateCustomer(c: Case, actor: Actor) {
  if (c.route === 'B' && !c.data.customerId) return;
  const customer = await env.DB.prepare("SELECT name, region FROM research_customers WHERE id = ? AND source IN ('bmp_sync', 'it_import') AND verification_status = 'verified' AND external_object_id IS NOT NULL AND source_version IS NOT NULL AND source_updated_at IS NOT NULL AND synced_at IS NOT NULL").bind(c.data.customerId || '').first<{ name: string; region: string }>();
  if (!customer || customer.name !== c.data.hospital || customer.region !== c.region) throw new WorkflowError('医院编号、名称与大区须匹配已同步的BMP/CRM主数据，不能自由文本新建重复医院。');
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
  let effectiveCommand = command, contacts: CustomerContact[] | undefined;
  if (['draft', 'returned', 'reserve'].includes(c.stage) && ['save', 'advance', 'resubmit'].includes(command.action) || command.action === 'change') {
    const inputs: StakeholderInput[] = command.stakeholders ?? c.stakeholders.map(({ contactId, role, importance, importanceBasis, responsibility }) => ({ contactId, role, importance, importanceBasis, responsibility }));
    contacts = (await Promise.all([...new Set(inputs.map(item => item.contactId).filter(Boolean))].map(getContact))).filter((item): item is CustomerContact => item !== undefined).filter(item => actor.regions.includes('*') || actor.regions.includes(item.region));
    effectiveCommand = { ...command, stakeholders: inputs };
  }
  const next = transition(c, effectiveCommand, { actor, now: Date.now(), policy: researchPolicy(), budget, contacts, projectNo: c.stage === 'commitment' && command.action === 'advance' && !c.projectNo ? await nextNumber('YKSR') : undefined });
  if (command.action === 'advance' || command.action === 'resubmit') await validateCustomer(next, actor);
  if (command.centers) for (const center of next.centers) {
    const row = await env.DB.prepare("SELECT name FROM research_customers WHERE id = ? AND source IN ('bmp_sync', 'it_import') AND verification_status = 'verified' AND external_object_id IS NOT NULL AND source_version IS NOT NULL AND source_updated_at IS NOT NULL AND synced_at IS NOT NULL").bind(center.customerId).first<{ name: string }>();
    if (!row || row.name !== center.name) throw new WorkflowError('中心必须匹配BMP/CRM医院主数据。');
  }
  const statements = transitionStatements(c, next, effectiveCommand, actor).map(s => env.DB.prepare(s.sql).bind(...s.values));
  try { await env.DB.batch(statements); }
  catch { throw new WorkflowError('记录或预算余额已变化，全部操作已回滚。请刷新后核对并重试。', 409); }
  return next;
}

type ContactRow = Omit<CustomerContact, 'expertise'> & { expertiseJson: string };
const contactSelect = `SELECT c.id, c.customer_id AS customerId, h.name AS hospital, h.region, c.bmp_contact_id AS bmpContactId, c.name, c.department, c.job_title AS jobTitle, c.professional_title AS professionalTitle, c.research_background AS researchBackground, c.expertise_json AS expertiseJson, c.work_email AS workEmail, c.work_phone AS workPhone, c.status, c.source, c.evidence, c.verified_at AS verifiedAt, c.source_version AS sourceVersion, c.source_updated_at AS sourceUpdatedAt, c.synced_at AS syncedAt, c.verification_status AS verificationStatus, c.revision, c.updated_by AS updatedBy, c.updated_at AS updatedAt FROM research_customer_contacts c JOIN research_customers h ON h.id = c.customer_id`;
function contactFromRow(row: ContactRow): CustomerContact {
  let expertise: string[] = [];
  try { const parsed = JSON.parse(row.expertiseJson); if (Array.isArray(parsed)) expertise = parsed.filter((item): item is string => typeof item === 'string').slice(0, 20); } catch { /* Old/imported malformed expertise is shown as empty and must be corrected by a steward. */ }
  const contact = { ...row, expertise } as CustomerContact & { expertiseJson?: string };
  delete contact.expertiseJson;
  return contact;
}
async function getContact(id: string) {
  if (!id) return undefined;
  const row = await env.DB.prepare(`${contactSelect} WHERE c.id = ? AND c.source IN ('bmp_sync', 'it_import') AND c.bmp_contact_id IS NOT NULL AND c.verification_status = 'verified' AND c.source_version IS NOT NULL AND c.source_updated_at IS NOT NULL AND c.synced_at IS NOT NULL AND h.verification_status = 'verified' AND h.external_object_id IS NOT NULL`).bind(id).first<ContactRow>();
  return row ? contactFromRow(row) : undefined;
}
function canSeeWorkChannels(actor: Actor) { return actor.roles.some(role => ['contact_steward', 'pmo', 'regional'].includes(role)); }
export async function allContacts(actor: Actor) {
  const rows = await env.DB.prepare(`${contactSelect} WHERE c.source IN ('bmp_sync', 'it_import') AND c.bmp_contact_id IS NOT NULL AND c.verification_status = 'verified' AND c.source_version IS NOT NULL AND c.source_updated_at IS NOT NULL AND c.synced_at IS NOT NULL AND h.verification_status = 'verified' AND h.external_object_id IS NOT NULL ORDER BY h.name, c.department, c.name`).all<ContactRow>();
  return rows.results.map(contactFromRow).filter(contact => actor.regions.includes('*') || actor.regions.includes(contact.region)).map(contact => canSeeWorkChannels(actor) ? contact : { ...contact, workEmail: '', workPhone: '' });
}

export { available };
