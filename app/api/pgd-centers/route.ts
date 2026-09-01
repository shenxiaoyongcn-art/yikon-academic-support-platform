import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { AccessDeniedError, requireActor, requireAdmin } from '@/lib/security/access';

type CenterPayload = {
  hospitalId?: string;
  hospitalName?: string;
  province?: string;
  stage?: string;
  period?: string;
  totalCycleCount?: number | null;
  pgdCycleCount?: number | null;
  externalId?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    await requireActor();
    const province = request.nextUrl.searchParams.get('province')?.trim();
    const stage = request.nextUrl.searchParams.get('stage')?.trim();
    const clauses: string[] = [];
    const values: string[] = [];
    if (province) { clauses.push('province = ?'); values.push(province); }
    if (stage) { clauses.push('stage = ?'); values.push(stage); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const statement = env.DB.prepare(`SELECT id, hospital_id AS hospitalId, hospital_name AS hospitalName, province, stage, period, total_cycle_count AS totalCycleCount, pgd_cycle_count AS pgdCycleCount, conversion_bp AS conversionBp, updated_at AS updatedAt FROM pgd_center_operations ${where} ORDER BY period DESC, province, hospital_name LIMIT 500`);
    const result = await statement.bind(...values).all();
    return NextResponse.json({ count: result.results.length, items: result.results });
  } catch (error) {
    const status = error instanceof AccessDeniedError ? error.status : 500;
    return NextResponse.json({ error: 'Unable to read PGD center operations.' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = await request.json() as CenterPayload;
    const hospitalId = body.hospitalId?.trim();
    const hospitalName = body.hospitalName?.trim();
    const province = body.province?.trim();
    const stage = body.stage?.trim();
    const period = body.period?.trim();
    if (!hospitalId || !hospitalName || !province || !stage || !period) {
      return NextResponse.json({ error: 'hospitalId, hospitalName, province, stage and period are required.' }, { status: 400 });
    }
    const totalCycles = Number.isFinite(body.totalCycleCount) ? Math.max(0, Math.round(body.totalCycleCount || 0)) : null;
    const pgdCycles = Number.isFinite(body.pgdCycleCount) ? Math.max(0, Math.round(body.pgdCycleCount || 0)) : null;
    const conversionBp = totalCycles && pgdCycles !== null ? Math.round((pgdCycles / totalCycles) * 10_000) : null;
    const now = Date.now();
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO pgd_center_operations (id, external_id, hospital_id, hospital_name, province, stage, period, total_cycle_count, pgd_cycle_count, conversion_bp, data_owner_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(hospital_id, period) DO UPDATE SET external_id = excluded.external_id, hospital_name = excluded.hospital_name, province = excluded.province, stage = excluded.stage, total_cycle_count = excluded.total_cycle_count, pgd_cycle_count = excluded.pgd_cycle_count, conversion_bp = excluded.conversion_bp, data_owner_id = excluded.data_owner_id, updated_at = excluded.updated_at`)
      .bind(id, body.externalId || null, hospitalId, hospitalName, province, stage, period, totalCycles, pgdCycles, conversionBp, actor.id, now)
      .run();
    return NextResponse.json({ hospitalId, period, conversionBp, updatedAt: now }, { status: 201 });
  } catch (error) {
    const status = error instanceof AccessDeniedError ? error.status : 500;
    return NextResponse.json({ error: 'Unable to maintain PGD center operations.' }, { status });
  }
}
