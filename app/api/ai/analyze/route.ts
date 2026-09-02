import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { analyzeModule } from '@/lib/ai/work-item-analysis';
import { enhanceWithConfiguredModel } from '@/lib/ai/model-enhancer';
import type { AnalysisContext, MedicalLabAggregate, ProductAggregate, ResearchAggregate, WorkItemRow } from '@/lib/ai/types';
import { getMaintenanceConfig } from '@/lib/platform/module-maintenance';
import { getPlatformModule } from '@/lib/platform/catalog';
import { AccessDeniedError, requireActor } from '@/lib/security/access';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActor();
    const body = await request.json() as { module?: unknown; focus?: unknown };
    const slug = clean(body.module, 40);
    const focus = clean(body.focus, 160);
    const platformModule = getPlatformModule(slug);
    const config = getMaintenanceConfig(slug);
    if (!platformModule || !config) return NextResponse.json({ error: '该模块暂不支持在线AI分析。' }, { status: 400 });

    const workResult = await env.DB.prepare(`SELECT id, title, customer_name AS customerName, region, priority, status, stage, due_at AS dueAt, payload_json AS payloadJson, updated_at AS updatedAt FROM work_items WHERE module = ? ORDER BY updated_at DESC LIMIT 500`)
      .bind(config.dbModule)
      .all();
    const context: AnalysisContext = {
      workItems: workResult.results.map(toWorkItem),
      products: [],
      medicalLab: [],
      research: [],
    };

    if (slug === 'analytics') {
      const [products, medicalLab] = await Promise.all([
        env.DB.prepare(`SELECT product_name AS productName, COUNT(DISTINCT hospital_id) AS hospitalCount, SUM(sales_quantity) AS salesQuantity, SUM(COALESCE(target_quantity, 0)) AS targetQuantity FROM sales_facts GROUP BY product_code, product_name ORDER BY targetQuantity DESC LIMIT 100`).all(),
        env.DB.prepare(`SELECT hospital_name AS hospitalName, period, sample_count AS sampleCount, amplification_success_bp AS amplificationSuccessBp, positive_bp AS positiveBp, negative_bp AS negativeBp, mosaic_bp AS mosaicBp FROM medical_lab_metrics ORDER BY period DESC, hospital_name LIMIT 200`).all(),
      ]);
      context.products = products.results.map(toProduct);
      context.medicalLab = medicalLab.results.map(toMedicalLab);
    }

    if (slug === 'research') {
      const research = await env.DB.prepare(`SELECT hospital_name AS hospitalName, COUNT(*) AS projectCount, SUM(labor_hours) AS laborHours, SUM(sample_cost_cents + external_cost_cents + other_cost_cents) AS totalCostCents, SUM(COALESCE(attributable_revenue_cents, 0)) AS attributableRevenueCents, SUM(paper_count) AS paperCount, SUM(patent_count) AS patentCount FROM research_economics GROUP BY hospital_id, hospital_name ORDER BY totalCostCents DESC LIMIT 100`).all();
      context.research = research.results.map(toResearch);
    }

    const rulesResult = analyzeModule(platformModule, context, focus);
    const result = await enhanceWithConfiguredModel(rulesResult);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO users (id, email, display_name, role, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, role = excluded.role, enabled = 1, updated_at = excluded.updated_at`)
        .bind(actor.id, actor.email, actor.displayName || actor.email, actor.role, now, now),
      env.DB.prepare(`INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, result, metadata_json, created_at) VALUES (?, ?, 'ai.analysis.generate', ?, NULL, 'success', ?, ?)`)
        .bind(crypto.randomUUID(), actor.id, config.dbModule, JSON.stringify({ modelState: result.modelState, workItems: context.workItems.length, findings: result.findings.length }), now),
    ]);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AccessDeniedError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? '请先登录后使用AI辅助分析。' : 'AI辅助分析暂时不可用。' }, { status });
  }
}

function clean(value: unknown, maxLength: number) { return value === null || value === undefined ? '' : String(value).trim().slice(0, maxLength); }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function nullableNumber(value: unknown) { if (value === null || value === undefined) return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function string(value: unknown) { return value === null || value === undefined ? '' : String(value); }

function toWorkItem(row: Record<string, unknown>): WorkItemRow {
  return { id: string(row.id), title: string(row.title), customerName: row.customerName ? string(row.customerName) : null, region: row.region ? string(row.region) : null, priority: string(row.priority), status: string(row.status), stage: string(row.stage), dueAt: nullableNumber(row.dueAt), payloadJson: string(row.payloadJson), updatedAt: number(row.updatedAt) };
}

function toProduct(row: Record<string, unknown>): ProductAggregate {
  return { productName: string(row.productName), hospitalCount: number(row.hospitalCount), salesQuantity: number(row.salesQuantity), targetQuantity: number(row.targetQuantity) };
}

function toMedicalLab(row: Record<string, unknown>): MedicalLabAggregate {
  return { hospitalName: string(row.hospitalName), period: string(row.period), sampleCount: number(row.sampleCount), amplificationSuccessBp: nullableNumber(row.amplificationSuccessBp), positiveBp: nullableNumber(row.positiveBp), negativeBp: nullableNumber(row.negativeBp), mosaicBp: nullableNumber(row.mosaicBp) };
}

function toResearch(row: Record<string, unknown>): ResearchAggregate {
  return { hospitalName: string(row.hospitalName), projectCount: number(row.projectCount), laborHours: number(row.laborHours), totalCostCents: number(row.totalCostCents), attributableRevenueCents: number(row.attributableRevenueCents), paperCount: number(row.paperCount), patentCount: number(row.patentCount) };
}
