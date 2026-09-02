import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { AccessDeniedError, requireActor } from '@/lib/security/access';

type ExpertInput = {
  externalId?: unknown;
  name?: unknown;
  organization?: unknown;
  department?: unknown;
  professionalTitle?: unknown;
  province?: unknown;
  city?: unknown;
  specialties?: unknown;
  reviewStages?: unknown;
  sessionCount?: unknown;
  lastReviewDate?: unknown;
  reviewHistory?: unknown;
};

export async function GET(request: NextRequest) {
  try {
    await requireActor();
    const query = clean(request.nextUrl.searchParams.get('q'), 80);
    const province = clean(request.nextUrl.searchParams.get('province'), 40);
    const specialty = clean(request.nextUrl.searchParams.get('specialty'), 80);
    const clauses: string[] = [];
    const values: Array<string | number> = [];
    if (query) {
      clauses.push("(name LIKE ? ESCAPE '\\' OR organization LIKE ? ESCAPE '\\' OR specialties LIKE ? ESCAPE '\\' OR review_history_json LIKE ? ESCAPE '\\')");
      const pattern = `%${escapeLike(query)}%`;
      values.push(pattern, pattern, pattern, pattern);
    }
    if (province) { clauses.push('province = ?'); values.push(province); }
    if (specialty) { clauses.push("specialties LIKE ? ESCAPE '\\'"); values.push(`%${escapeLike(specialty)}%`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await env.DB.prepare(`SELECT id, external_id AS externalId, name, organization, department, professional_title AS professionalTitle, province, city, specialties, review_stages AS reviewStages, session_count AS sessionCount, last_review_at AS lastReviewAt, review_history_json AS reviewHistoryJson, source, updated_at AS updatedAt FROM pgd_review_experts ${where} ORDER BY session_count DESC, last_review_at DESC, name LIMIT 500`)
      .bind(...values)
      .all();
    const items = result.results.map((row) => ({
      ...row,
      reviewHistory: parseHistory(row.reviewHistoryJson),
      reviewHistoryJson: undefined,
    }));
    return NextResponse.json({ count: items.length, items });
  } catch (error) {
    const status = error instanceof AccessDeniedError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? '请先登录后查询专家库。' : '专家库读取失败。' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActor();
    const body = await request.json() as { records?: ExpertInput[]; source?: unknown };
    const records = Array.isArray(body.records) ? body.records : [];
    if (!records.length) return NextResponse.json({ error: '没有可导入的专家记录。' }, { status: 400 });
    if (records.length > 500) return NextResponse.json({ error: '单次最多导入 500 位专家，请拆分文件。' }, { status: 400 });
    const now = Date.now();
    const statements = [
      env.DB.prepare(`INSERT INTO users (id, email, display_name, role, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, role = excluded.role, enabled = 1, updated_at = excluded.updated_at`)
        .bind(actor.id, actor.email, actor.displayName || actor.email, actor.role, now, now),
    ];

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const name = clean(record.name, 80);
      if (!name) return NextResponse.json({ error: `第 ${index + 1} 条记录缺少专家姓名。` }, { status: 400 });
      const organization = clean(record.organization, 160);
      const professionalTitle = clean(record.professionalTitle, 80);
      const externalId = clean(record.externalId, 180) || `expert:${name}:${organization}:${professionalTitle}`.slice(0, 180);
      const history = normalizeHistory(record.reviewHistory);
      const sessionCount = normalizeCount(record.sessionCount, history.length);
      const lastReviewAt = parseDate(record.lastReviewDate);
      statements.push(
        env.DB.prepare(`INSERT INTO pgd_review_experts (id, external_id, name, organization, department, professional_title, province, city, specialties, review_stages, session_count, last_review_at, review_history_json, imported_by_id, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(external_id) DO UPDATE SET name = excluded.name, organization = excluded.organization, department = excluded.department, professional_title = excluded.professional_title, province = excluded.province, city = excluded.city, specialties = excluded.specialties, review_stages = excluded.review_stages, session_count = excluded.session_count, last_review_at = excluded.last_review_at, review_history_json = excluded.review_history_json, imported_by_id = excluded.imported_by_id, source = excluded.source, updated_at = excluded.updated_at`)
          .bind(
            crypto.randomUUID(), externalId, name, organization || null, clean(record.department, 80) || null,
            professionalTitle || null, clean(record.province, 40) || null, clean(record.city, 40) || null,
            clean(record.specialties, 500), clean(record.reviewStages, 500), sessionCount, lastReviewAt,
            JSON.stringify(history), actor.id, body.source === 'manual' ? 'manual' : 'excel', now, now,
          ),
      );
    }
    statements.push(
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, result, metadata_json, created_at) VALUES (?, ?, 'pgd_experts.import', 'pgd_review_experts', NULL, 'success', ?, ?)`)
        .bind(crypto.randomUUID(), actor.id, JSON.stringify({ count: records.length, source: body.source === 'manual' ? 'manual' : 'excel' }), now),
    );
    await runBatches(statements);
    return NextResponse.json({ saved: records.length }, { status: 201 });
  } catch (error) {
    const status = error instanceof AccessDeniedError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? '请先登录后导入专家库。' : '专家库导入失败。' }, { status });
  }
}

function clean(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
}

function escapeLike(value: string) { return value.replaceAll('%', '\\%').replaceAll('_', '\\_'); }

function parseDate(value: unknown) {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeCount(value: unknown, fallback: number) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : fallback;
}

function normalizeHistory(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => clean(item, 500)).filter(Boolean).slice(0, 100);
  return clean(value, 10_000).split(/[；;\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 100);
}

function parseHistory(value: unknown) {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch { return []; }
}

async function runBatches(statements: Array<ReturnType<typeof env.DB.prepare>>) {
  for (let index = 0; index < statements.length; index += 50) await env.DB.batch(statements.slice(index, index + 50));
}
