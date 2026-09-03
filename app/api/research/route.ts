import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { AccessDeniedError } from '@/lib/security/access';
import { assertOrigin, researchActor, researchPolicy } from '@/lib/research/access';
import { allCases, createCase, execute, getBudget, getCase, history, maintainBudget } from '@/lib/research/repository';
import { alerts, batchEligible, canAct, canSeeMoney, redact } from '@/lib/research/workflow';
import { WorkflowError, type Budget, type Case, type Command } from '@/lib/research/model';

const headers = { 'Cache-Control': 'no-store, private' };
function failed(error: unknown) {
  if (error instanceof WorkflowError || error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  return NextResponse.json({ error: '科研模块服务暂不可用，请检查数据库迁移或联系IT。' }, { status: 500, headers });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await researchActor(), id = request.nextUrl.searchParams.get('id');
    if (id) {
      const c = await getCase(id, actor);
      return NextResponse.json({ item: redact(c, actor), history: await history(c, actor), canAct: canAct(c, actor), showMoney: canSeeMoney(c, actor), alerts: alerts(c) }, { headers });
    }
    const records = await allCases(actor);
    const moneyRole = actor.roles.some(r => ['budget', 'finance', 'regional', 'marketing', 'executive'].includes(r));
    const budgets = moneyRole ? (await env.DB.prepare('SELECT id, customer_id AS customerId, hospital, period, region, total_cents AS totalCents, used_cents AS usedCents, locked_cents AS lockedCents, revision, evidence FROM research_budget_packages ORDER BY period DESC, hospital').all<Budget>()).results.filter(b => actor.regions.includes('*') || actor.regions.includes(b.region)) : [];
    const customers = (await env.DB.prepare('SELECT id, name, region FROM research_customers ORDER BY name').all<{ id: string; name: string; region: string }>()).results.filter(c => actor.regions.includes('*') || actor.regions.includes(c.region));
    return NextResponse.json({ actor, items: records.map(c => ({ ...redact(c, actor), canAct: canAct(c, actor), showMoney: canSeeMoney(c, actor), alerts: alerts(c), batchEligible: batchEligible(c, budgets.find(b => b.id === c.data.budgetId)) })), budgets, customers, policy: researchPolicy(), integration: { state: 'pending_contract', message: 'BMP流程定义、主数据和写回接口待IT确认；本模块操作尚未写入BMP。' } }, { headers });
  } catch (error) { return failed(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertOrigin(request);
    const actor = await researchActor();
    const raw = await request.text();
    if (raw.length > 250_000) throw new WorkflowError('请求过大，请分批提交。', 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new WorkflowError('请求格式错误。', 400); }
    if (body.action === 'create') {
      const c = await createCase(actor, body as { data?: Case['data']; route?: Case['route'] });
      return NextResponse.json({ item: redact(c, actor) }, { status: 201, headers });
    }
    if (body.action === 'budget') return NextResponse.json(await maintainBudget(actor, body), { headers });
    if (body.action === 'customers') {
      if (!actor.roles.includes('budget') || !actor.regions.includes('*')) throw new WorkflowError('CRM医院主数据导入需全区域商务预算权限。', 403);
      const incoming = body.records as { id: string; name: string; region: string }[];
      if (!Array.isArray(incoming) || !incoming.length || incoming.length > 100) throw new WorkflowError('每次导入1–100条CRM医院主数据。');
      const statements = incoming.map(row => {
        if (![row.id, row.name, row.region].every(v => typeof v === 'string' && v.trim() && v.length <= 200)) throw new WorkflowError('医院主数据需有CRM编号、名称和大区。');
        return env.DB.prepare('INSERT INTO research_customers (id, name, region, source, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(row.id.trim(), row.name.trim(), row.region.trim(), 'it_import', Date.now());
      });
      // Existing master records are never overwritten by an import.
      const results = await env.DB.batch(statements);
      return NextResponse.json({ created: results.reduce((n, r) => n + r.meta.changes, 0), received: incoming.length }, { headers });
    }
    if (body.action === 'batch') {
      if (!actor.roles.includes('marketing')) throw new WorkflowError('批量预审仅限营销负责人。', 403);
      const ids = body.ids as { id: string; revision: number }[];
      if (!Array.isArray(ids) || !ids.length || ids.length > 30) throw new WorkflowError('一次可选择1–30条需求。');
      const batchId = crypto.randomUUID(), results: { id: string; ok: boolean; message?: string }[] = [];
      for (const ref of ids) {
        try {
          const c = await getCase(ref.id, actor), b = await getBudget(c.data.budgetId || '');
          if (!batchEligible(c, b)) throw new WorkflowError('紧急、超预算、重大或非A类月度需求须单独办理。');
          await execute(c, { action: 'advance', expectedRevision: ref.revision, data: body.data as Case['data'], note: String(body.note || ''), batchId }, actor);
          results.push({ id: ref.id, ok: true });
        } catch (error) { results.push({ id: ref.id, ok: false, message: error instanceof WorkflowError ? error.message : '本条处理失败，未保存。' }); }
      }
      return NextResponse.json({ batchId, results }, { headers });
    }
    if (typeof body.id !== 'string') throw new WorkflowError('缺少项目编号。', 400);
    const c = await getCase(body.id, actor);
    const next = await execute(c, body as unknown as Command, actor);
    return NextResponse.json({ item: redact(next, actor), canAct: canAct(next, actor), showMoney: canSeeMoney(next, actor), alerts: alerts(next) }, { headers });
  } catch (error) { return failed(error); }
}
