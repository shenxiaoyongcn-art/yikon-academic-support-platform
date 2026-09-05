import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { BmpConnector, type BmpModule } from '@/lib/integrations/bmp';
import { getMaintenanceConfigByDbModule, type WorkItemModule } from '@/lib/platform/module-maintenance';
import { AccessDeniedError, requireActor } from '@/lib/security/access';
import { getBmpSessionIdentity, getBmpSessionToken } from '@/lib/security/bmp-session';

const allowedModules = new Set<BmpModule>(['tender', 'research', 'aftersales', 'events', 'salesAnalytics', 'pgdReview', 'pgdCenters', 'training']);
const workItemModules: Partial<Record<BmpModule, WorkItemModule>> = {
  tender: 'tender',
  aftersales: 'aftersales',
  events: 'events',
  salesAnalytics: 'analytics',
  pgdReview: 'pgd_review',
  training: 'training',
};
type Props = { params: Promise<{ module: string }> };
type CanonicalBmpItem = {
  externalId: string;
  title: string;
  customerId?: string | null;
  customerName?: string | null;
  region?: string | null;
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  status: string;
  stage: string;
  ownerExternalId?: string | null;
  ownerName?: string | null;
  dueAt?: string | number | null;
  sourceUpdatedAt: string | number;
  sourceVersion: string;
  fields?: Record<string, string | number | boolean | null>;
};

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const actor = await requireActor();
    const { module } = await params;
    if (!allowedModules.has(module as BmpModule)) return NextResponse.json({ error: '不支持该 BMP 模块。' }, { status: 404 });
    const bmpModule = module as BmpModule;
    const dbModule = workItemModules[bmpModule];
    if (!dbModule) return NextResponse.json({ error: '该 BMP 数据使用独立业务表，不能写入通用台账。' }, { status: 400 });
    const config = getMaintenanceConfigByDbModule(dbModule);
    if (!config) return NextResponse.json({ error: '模块字段配置缺失。' }, { status: 500 });
    if (config.bmpSyncStatus !== 'verified') {
      return NextResponse.json({ error: '该模块 BMP 接口、字段映射和权限尚未通过 IT 验收。' }, { status: 501 });
    }
    const [userToken, bmpIdentity] = await Promise.all([getBmpSessionToken(), getBmpSessionIdentity()]);
    if (!userToken || !bmpIdentity) {
      return NextResponse.json({ error: '请先使用 BMP 邮箱账号完成身份验证，再读取已验收接口。' }, { status: 403 });
    }
    if (bmpIdentity.email.toLowerCase() !== actor.email.toLowerCase()) return NextResponse.json({ error: '平台身份与BMP身份尚未完成同一员工映射，不能发起同步。' }, { status: 403 });

    const body = await request.json().catch(() => ({})) as { cursor?: string; updatedAfter?: string };
    const startedAt = Date.now();
    const page = await new BmpConnector(userToken).list<CanonicalBmpItem>(bmpModule, body.cursor, body.updatedAfter);

    const statements = [
      env.DB.prepare(`INSERT INTO users (id, email, display_name, role, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, role = excluded.role, enabled = 1, updated_at = excluded.updated_at`)
        .bind(actor.id, actor.email, actor.displayName || actor.email, actor.role, startedAt, startedAt),
    ];

    for (const item of page.items) {
      const normalized = canonicalItem(item);
      const externalId = `${bmpModule}:${normalized.externalId}`.slice(0, 160);
      const dueAt = timestamp(normalized.dueAt, true);
      const sourceUpdatedAt = timestamp(normalized.sourceUpdatedAt, false)!;
      const payload: Record<string, unknown> = {
        _source: 'bmp',
        _sourceVerified: true,
        _verificationMethod: 'accepted-module-contract',
        _sourceVersion: normalized.sourceVersion,
        _sourceUpdatedAt: sourceUpdatedAt,
        ownerExternalId: normalized.ownerExternalId || '',
        ownerName: normalized.ownerName || '',
        bmpModule,
      };
      for (const field of config.fields) {
        const value = normalized.fields?.[field.key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') payload[field.key] = value;
      }
      const now = Date.now();
      statements.push(
        env.DB.prepare(`INSERT INTO work_items (id, external_id, module, title, customer_id, customer_name, region, priority, status, stage, owner_id, due_at, source_updated_at, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?) ON CONFLICT(module, external_id) DO UPDATE SET title = excluded.title, customer_id = excluded.customer_id, customer_name = excluded.customer_name, region = excluded.region, priority = excluded.priority, status = excluded.status, stage = excluded.stage, due_at = excluded.due_at, source_updated_at = excluded.source_updated_at, payload_json = excluded.payload_json, updated_at = excluded.updated_at WHERE work_items.source_updated_at IS NULL OR excluded.source_updated_at >= work_items.source_updated_at`)
          .bind(
            crypto.randomUUID(),
            externalId,
            dbModule,
            normalized.title.slice(0, 200),
            normalized.customerId || null,
            normalized.customerName || null,
            normalized.region || null,
            normalized.priority || 'P2',
            normalized.status.slice(0, 80),
            normalized.stage.slice(0, 80),
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

function canonicalItem(item: CanonicalBmpItem) {
  if (!item || typeof item !== 'object') throw new Error('BMP item is not an object.');
  for (const [key, value] of Object.entries({ externalId: item.externalId, title: item.title, status: item.status, stage: item.stage, sourceVersion: item.sourceVersion })) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`BMP canonical field ${key} is missing.`);
  }
  if (item.externalId.length > 120 || item.title.length > 200 || item.status.length > 80 || item.stage.length > 80 || item.sourceVersion.length > 120) throw new Error('BMP canonical field is too long.');
  timestamp(item.sourceUpdatedAt, false);
  return item;
}

function timestamp(value: string | number | null | undefined, optional: boolean) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  const parsed = typeof value === 'number' ? (value < 10_000_000_000 ? value * 1000 : value) : Date.parse(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('BMP canonical timestamp is invalid.');
  return parsed;
}

async function runBatches(statements: Array<ReturnType<typeof env.DB.prepare>>) {
  for (let index = 0; index < statements.length; index += 50) {
    await env.DB.batch(statements.slice(index, index + 50));
  }
}
