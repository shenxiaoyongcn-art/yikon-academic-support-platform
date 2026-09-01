import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { getMaintenanceConfig } from '@/lib/platform/module-maintenance';
import { AccessDeniedError, requireActor } from '@/lib/security/access';

type Props = { params: Promise<{ module: string }> };

type WorkItemInput = {
  externalId?: unknown;
  title?: unknown;
  customerName?: unknown;
  region?: unknown;
  priority?: unknown;
  stage?: unknown;
  status?: unknown;
  dueDate?: unknown;
  ownerName?: unknown;
  [key: string]: unknown;
};

type StoredPayload = Record<string, unknown> & {
  _source?: string;
  ownerName?: string;
};

const priorities = new Set(['P0', 'P1', 'P2', 'P3']);

export async function GET(request: NextRequest, { params }: Props) {
  try {
    await requireActor();
    const { module } = await params;
    const config = getMaintenanceConfig(module);
    if (!config) return NextResponse.json({ error: '不支持该业务模块。' }, { status: 404 });

    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || 100);
    const limit = Number.isFinite(requestedLimit) ? Math.min(500, Math.max(1, Math.round(requestedLimit))) : 100;
    const result = await env.DB.prepare(`SELECT id, external_id AS externalId, title, customer_name AS customerName, region, priority, status, stage, due_at AS dueAt, payload_json AS payloadJson, created_at AS createdAt, updated_at AS updatedAt FROM work_items WHERE module = ? ORDER BY updated_at DESC LIMIT ?`)
      .bind(config.dbModule, limit)
      .all();

    const items = result.results.map((row) => {
      const payload = parsePayload(row.payloadJson);
      return {
        id: row.id,
        externalId: row.externalId,
        title: row.title,
        customerName: row.customerName,
        region: row.region,
        priority: row.priority,
        status: row.status,
        stage: row.stage,
        dueAt: row.dueAt,
        source: payload._source || (row.externalId ? 'bmp' : 'manual'),
        ownerName: payload.ownerName || '',
        fields: Object.fromEntries(config.fields.map((field) => [field.key, payload[field.key] ?? ''])),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    return NextResponse.json({ module: config.slug, count: items.length, items });
  } catch (error) {
    const status = error instanceof AccessDeniedError ? error.status : 500;
    const message = error instanceof AccessDeniedError ? error.message : '读取模块记录失败。';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const actor = await requireActor();
    const { module } = await params;
    const config = getMaintenanceConfig(module);
    if (!config) return NextResponse.json({ error: '不支持该业务模块。' }, { status: 404 });

    const body = await request.json() as { source?: unknown; record?: WorkItemInput; records?: WorkItemInput[] };
    const source = body.source === 'excel' ? 'excel' : 'manual';
    const incoming = Array.isArray(body.records) ? body.records : body.record ? [body.record] : [];
    if (!incoming.length) return NextResponse.json({ error: '没有可保存的记录。' }, { status: 400 });
    if (incoming.length > 500) return NextResponse.json({ error: '单次最多导入 500 条记录，请拆分后重试。' }, { status: 400 });

    const now = Date.now();
    const actorName = actor.displayName?.trim() || actor.email;
    const statements = [
      env.DB.prepare(`INSERT INTO users (id, email, display_name, role, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, role = excluded.role, enabled = 1, updated_at = excluded.updated_at`)
        .bind(actor.id, actor.email, actorName, actor.role, now, now),
    ];
    const savedIds: string[] = [];

    for (let index = 0; index < incoming.length; index += 1) {
      const input = incoming[index];
      const title = cleanText(input.title, 200);
      if (!title) return NextResponse.json({ error: `第 ${index + 1} 条记录缺少“${config.titleLabel}”。` }, { status: 400 });

      const id = crypto.randomUUID();
      const externalId = cleanText(input.externalId, 160) || `${source}:${config.dbModule}:${id}`;
      const priority = priorities.has(String(input.priority || '')) ? String(input.priority) : 'P2';
      const stage = cleanText(input.stage, 80) || config.stages[0];
      const status = cleanText(input.status, 80) || config.defaultStatus;
      const dueAt = parseDate(input.dueDate);
      const ownerName = cleanText(input.ownerName, 80) || actorName;
      const payload: StoredPayload = { _source: source, ownerName, createdBy: actorName };
      for (const field of config.fields) {
        const value = cleanText(input[field.key], field.type === 'textarea' ? 2000 : 300);
        if (field.required && !value) return NextResponse.json({ error: `第 ${index + 1} 条记录缺少“${field.label}”。` }, { status: 400 });
        if (value) payload[field.key] = value;
      }

      statements.push(
        env.DB.prepare(`INSERT INTO work_items (id, external_id, module, title, customer_name, region, priority, status, stage, owner_id, due_at, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(module, external_id) DO UPDATE SET title = excluded.title, customer_name = excluded.customer_name, region = excluded.region, priority = excluded.priority, status = excluded.status, stage = excluded.stage, owner_id = excluded.owner_id, due_at = excluded.due_at, payload_json = excluded.payload_json, updated_at = excluded.updated_at`)
          .bind(
            id,
            externalId,
            config.dbModule,
            title,
            cleanText(input.customerName, 200) || null,
            cleanText(input.region, 80) || null,
            priority,
            status,
            stage,
            actor.id,
            dueAt,
            JSON.stringify(payload),
            now,
            now,
          ),
      );
      savedIds.push(id);
    }

    const auditId = crypto.randomUUID();
    statements.push(
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, result, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(auditId, actor.id, source === 'excel' ? 'work_items.import' : 'work_item.create', config.dbModule, savedIds[0] || null, 'success', JSON.stringify({ count: incoming.length, source }), now),
    );
    await runBatches(statements);

    return NextResponse.json({ module: config.slug, saved: incoming.length, source, ids: savedIds }, { status: 201 });
  } catch (error) {
    const status = error instanceof AccessDeniedError ? error.status : 500;
    const message = error instanceof AccessDeniedError ? error.message : '保存模块记录失败。';
    return NextResponse.json({ error: message }, { status });
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
}

function parseDate(value: unknown) {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parsePayload(value: unknown): StoredPayload {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as StoredPayload : {};
  } catch {
    return {};
  }
}

async function runBatches(statements: Array<ReturnType<typeof env.DB.prepare>>) {
  for (let index = 0; index < statements.length; index += 50) {
    await env.DB.batch(statements.slice(index, index + 50));
  }
}
