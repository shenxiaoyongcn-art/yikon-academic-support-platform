import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { BmpConnector, type BmpModule } from '@/lib/integrations/bmp';
import { getMaintenanceConfigByDbModule, type WorkItemModule } from '@/lib/platform/module-maintenance';
import { AccessDeniedError, requireActor } from '@/lib/security/access';
import { getBmpSessionToken } from '@/lib/security/bmp-session';

const allowedModules = new Set<BmpModule>(['tender', 'research', 'aftersales', 'events', 'salesAnalytics', 'pgdReview', 'pgdCenters', 'training']);
const workItemModules: Partial<Record<BmpModule, WorkItemModule>> = {
  tender: 'tender',
  research: 'research',
  aftersales: 'aftersales',
  events: 'events',
  salesAnalytics: 'analytics',
  pgdReview: 'pgd_review',
  training: 'training',
};
type Props = { params: Promise<{ module: string }> };

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const actor = await requireActor();
    const userToken = await getBmpSessionToken();
    if (!userToken && actor.role !== 'admin') {
      return NextResponse.json({ error: '请先使用 BMP 邮箱账号登录，再拉取 BMP 数据。' }, { status: 403 });
    }
    const { module } = await params;
    if (!allowedModules.has(module as BmpModule)) return NextResponse.json({ error: '不支持该 BMP 模块。' }, { status: 404 });
    const bmpModule = module as BmpModule;
    const dbModule = workItemModules[bmpModule];
    if (!dbModule) return NextResponse.json({ error: '该 BMP 数据使用独立业务表，不能写入通用台账。' }, { status: 400 });

    const body = await request.json().catch(() => ({})) as { cursor?: string; updatedAfter?: string };
    const startedAt = Date.now();
    const page = await new BmpConnector(userToken || undefined).list<Record<string, unknown>>(bmpModule, body.cursor, body.updatedAfter);
    const config = getMaintenanceConfigByDbModule(dbModule);
    if (!config) return NextResponse.json({ error: '模块字段配置缺失。' }, { status: 500 });

    const statements = [
      env.DB.prepare(`INSERT INTO users (id, email, display_name, role, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, role = excluded.role, enabled = 1, updated_at = excluded.updated_at`)
        .bind(actor.id, actor.email, actor.displayName || actor.email, actor.role, startedAt, startedAt),
    ];

    for (const item of page.items) {
      const externalId = await bmpExternalId(bmpModule, item);
      const title = pickText(item, titleKeys[bmpModule] || titleKeys.default) || `${config.recordName}-${externalId.slice(-8)}`;
      const customerName = pickText(item, ['customerName', 'hospitalName', 'institutionName', 'centerName', 'accountName']);
      const region = pickText(item, ['region', 'province', 'area', 'territory']);
      const priorityValue = pickText(item, ['priority', 'severity']);
      const priority = ['P0', 'P1', 'P2', 'P3'].includes(priorityValue) ? priorityValue : 'P2';
      const status = pickText(item, ['status', 'state', 'workflowStatus']) || config.defaultStatus;
      const stage = pickText(item, ['stage', 'currentStage', 'reviewStage', 'milestone']) || config.stages[0];
      const dueAt = pickDate(item, ['dueAt', 'dueDate', 'deadline', 'plannedAt', 'eventDate', 'plannedReviewAt']);
      const sourceUpdatedAt = pickDate(item, ['updatedAt', 'sourceUpdatedAt', 'modifiedAt', 'lastModifiedAt']) || startedAt;
      const ownerName = pickText(item, ['ownerName', 'owner', 'assigneeName', 'managerName']) || actor.displayName || actor.email;
      const payload: Record<string, unknown> = { _source: 'bmp', ownerName, bmpModule };
      for (const field of config.fields) {
        const value = item[field.key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') payload[field.key] = value;
      }
      const now = Date.now();
      statements.push(
        env.DB.prepare(`INSERT INTO work_items (id, external_id, module, title, customer_id, customer_name, region, priority, status, stage, owner_id, due_at, source_updated_at, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(module, external_id) DO UPDATE SET title = excluded.title, customer_id = excluded.customer_id, customer_name = excluded.customer_name, region = excluded.region, priority = excluded.priority, status = excluded.status, stage = excluded.stage, owner_id = excluded.owner_id, due_at = excluded.due_at, source_updated_at = excluded.source_updated_at, payload_json = excluded.payload_json, updated_at = excluded.updated_at`)
          .bind(
            crypto.randomUUID(),
            externalId,
            dbModule,
            title.slice(0, 200),
            pickText(item, ['customerId', 'hospitalId', 'institutionId']) || null,
            customerName || null,
            region || null,
            priority,
            status.slice(0, 80),
            stage.slice(0, 80),
            actor.id,
            dueAt,
            sourceUpdatedAt,
            JSON.stringify(payload),
            now,
            now,
          ),
      );
    }

    const finishedAt = Date.now();
    statements.push(
      env.DB.prepare(`INSERT INTO sync_runs (id, provider, module, status, cursor, records_read, records_written, started_at, finished_at) VALUES (?, 'bmp', ?, 'succeeded', ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), bmpModule, page.nextCursor, page.items.length, page.items.length, startedAt, finishedAt),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, result, metadata_json, created_at) VALUES (?, ?, 'bmp.sync', 'integration', ?, 'success', ?, ?)`)
        .bind(crypto.randomUUID(), actor.id, bmpModule, JSON.stringify({ received: page.items.length, written: page.items.length, nextCursor: page.nextCursor }), finishedAt),
    );
    await runBatches(statements);

    return NextResponse.json({
      module: bmpModule,
      received: page.items.length,
      persisted: page.items.length,
      nextCursor: page.nextCursor,
      sourceUpdatedAt: page.sourceUpdatedAt || null,
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error && error.message.includes('not configured')
      ? 'BMP 接口尚未配置，请由 IT 填写接口地址和服务令牌。'
      : 'BMP 数据拉取失败，请检查接口连通性和字段映射。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

const titleKeys: Record<string, string[]> = {
  tender: ['tenderName', 'projectName', 'title', 'name'],
  research: ['projectName', 'researchName', 'title', 'name'],
  aftersales: ['issueTitle', 'ticketTitle', 'title', 'subject'],
  events: ['eventName', 'meetingName', 'lectureName', 'title'],
  salesAnalytics: ['analysisName', 'reportName', 'productName', 'title'],
  pgdReview: ['projectName', 'hospitalName', 'institutionName', 'title'],
  training: ['requestName', 'trainingName', 'courseName', 'title'],
  default: ['title', 'name'],
};

function pickText(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function pickDate(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value < 10_000_000_000 ? value * 1000 : value;
    if (typeof value === 'string' && value.trim()) {
      const timestamp = Date.parse(value);
      if (Number.isFinite(timestamp)) return timestamp;
    }
  }
  return null;
}

async function bmpExternalId(module: BmpModule, item: Record<string, unknown>) {
  const sourceId = pickText(item, ['externalId', 'id', 'code', 'projectId', 'ticketId', 'eventId', 'hospitalId']);
  if (sourceId) return `${module}:${sourceId}`.slice(0, 160);
  const serialized = JSON.stringify(item, Object.keys(item).sort());
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  const hash = Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${module}:hash:${hash}`;
}

async function runBatches(statements: Array<ReturnType<typeof env.DB.prepare>>) {
  for (let index = 0; index < statements.length; index += 50) {
    await env.DB.batch(statements.slice(index, index + 50));
  }
}
