import type { ModuleSlug, PlatformModule } from '@/lib/platform/catalog';
import type { AiAnalysisResult, AiFinding, AnalysisContext, WorkItemRow } from './types';

const moduleActions: Record<ModuleSlug, string[]> = {
  tender: ['优先补齐高优先级项目的证据缺口，并明确材料有效期和复核人。', '把重复出现的技术参数沉淀为标准应答及证据映射，减少临时找材料。'],
  research: ['对逾期项目逐项确认卡点、责任人和下一里程碑，停止无明确产出的持续投入。', '按医院汇总工时、现金成本、论文专利和可归因收入，作为新增项目立项依据。'],
  aftersales: ['先处理P0/P1及临近SLA工单，再按问题分类识别重复根因。', '同类问题达到阈值后由产品、实验室或IT建立整改项，并跟踪客户确认。'],
  events: ['会前固定产品、医院、决策人和转化目标，会后按7/30/90日连续跟踪。', '会议评价同时看观念、病例入口、首单复购及销量变化，不以场次替代效果。'],
  analytics: ['先核对BMP医院、产品、人员和月份映射，再判断薄弱产品及责任动作。', '实验室指标异常先核验样本分母、批次和流程变化，医学复核后再用于客户汇报。'],
  'pgd-review': ['按申报、筹建、试运行及正式运行阶段检查制度、SOP、记录和答辩材料的一致性。', '把评审问题、专家意见、整改责任人和验证结果统一回填，形成可复用资料库。'],
  training: ['根据测评短板分配PGT-A、PGT-SR、PGT-M及CNV学习路径，并设置复评节点。', '培训结果同时追踪考核通过、病例应用和医院诊疗路径变化。'],
  pedigree: ['家系数据默认在设备本地处理；进入PGT或临床路径前由遗传咨询及实施中心复核。'],
};

export function analyzeModule(module: PlatformModule, context: AnalysisContext, focus: string): AiAnalysisResult {
  const now = Date.now();
  const verifiedWorkItems = context.workItems.filter(isVerifiedForBusinessAnalysis);
  const unverifiedWorkItems = context.workItems.length - verifiedWorkItems.length;
  const findings = analyzeWorkItems(verifiedWorkItems, now);
  if (unverifiedWorkItems) {
    findings.push({
      id: 'unverified-ledger',
      level: 'info',
      title: '有未核验台账，当前只做完整性提示',
      metric: `${unverifiedWorkItems}条`,
      evidence: '演示、来源未知、人工草稿及未确认Excel导入不参与阶段、逾期、优先级或经营效果判断。',
    });
  }
  if (module.slug === 'analytics') findings.push(...analyzeProducts(context), ...analyzeMedicalLab(context));
  if (module.slug === 'research') findings.push(...analyzeResearch(context));
  const hasData = verifiedWorkItems.length + context.products.length + context.medicalLab.length + context.research.length > 0;
  const recommendations = [...moduleActions[module.slug]];
  if (focus) recommendations.unshift(`围绕“${focus}”建立专项清单，结论必须回到医院、产品、人员、时间和责任动作。`);
  const limitedFindings = findings.slice(0, 8);

  return {
    module: module.slug,
    title: `${module.name} · AI辅助研判`,
    generatedAt: new Date(now).toISOString(),
    dataState: hasData ? 'ready' : 'insufficient',
    modelState: 'rules-only',
    modelLabel: '可追溯规则引擎',
    summary: hasData
      ? `已对${verifiedWorkItems.length}条已核验台账及${context.products.length + context.medicalLab.length + context.research.length}组专项指标完成结构化检查，识别${limitedFindings.length}个待人工复核的判断；另有${unverifiedWorkItems}条未核验台账未进入经营判断。`
      : '当前模块尚无可用于研判的已核验记录。人工录入和Excel草稿须经确认后才可进入统计，BMP接口须经IT验收后再同步。',
    findings: limitedFindings.length ? limitedFindings : [{ id: 'no-data', level: 'info', title: '真实数据待接入', metric: '0条', evidence: '当前未读取到平台业务记录或专项指标。' }],
    recommendations,
    evidence: [
      { source: '已核验平台台账', records: verifiedWorkItems.length, note: '仅纳入已验收BMP同步或已确认导入批次' },
      ...(unverifiedWorkItems ? [{ source: '未核验平台台账', records: unverifiedWorkItems, note: '仅做字段完整性提示，不形成经营结论' }] : []),
      ...(module.slug === 'analytics' ? [
        { source: 'BMP销量事实表', records: context.products.length, note: '按产品汇总医院数、销量及目标量' },
        { source: '医检所运营指标', records: context.medicalLab.length, note: '按医院和周期保留样本分母与结果构成' },
      ] : []),
      ...(module.slug === 'research' ? [{ source: '科研投入产出表', records: context.research.length, note: '按医院汇总项目、工时、成本、收入及成果' }] : []),
    ],
    limitations: ['AI只做信息整理、异常提示和管理建议，不替代临床诊断、遗传咨询或实施中心技术确认。', '缺失的目标值、样本分母、时间窗或人员映射不会自动补零，必须补齐后再形成正式结论。'],
    reviewRequired: true,
  };
}

function isVerifiedForBusinessAnalysis(row: WorkItemRow) {
  const metadata = payloadMetadata(row.payloadJson);
  return (metadata.source === 'bmp' && metadata.sourceVerified)
    || (metadata.source === 'excel' && metadata.importStatus === 'confirmed');
}

function analyzeWorkItems(rows: WorkItemRow[], now: number): AiFinding[] {
  if (!rows.length) return [];
  const highPriority = rows.filter((row) => row.priority === 'P0' || row.priority === 'P1');
  const overdue = rows.filter((row) => row.dueAt && row.dueAt < now && !isClosed(row.status, row.stage));
  const stageCounts = countBy(rows, (row) => row.stage || '未标记阶段');
  const sourceCounts = countBy(rows, (row) => payloadSource(row.payloadJson));
  const dominantStage = [...stageCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const findings: AiFinding[] = [];
  if (highPriority.length) findings.push({ id: 'high-priority', level: 'critical', title: '高优先级事项需要先处理', metric: `${highPriority.length}条`, evidence: highPriority.slice(0, 3).map((row) => row.title).join('；') });
  if (overdue.length) findings.push({ id: 'overdue', level: 'warning', title: '存在计划日期已过但未闭环事项', metric: `${overdue.length}条`, evidence: overdue.slice(0, 3).map((row) => `${row.title}（${date(row.dueAt)}）`).join('；') });
  if (dominantStage) findings.push({ id: 'stage-focus', level: 'info', title: `工作主要集中在“${dominantStage[0]}”`, metric: `${dominantStage[1]}/${rows.length}`, evidence: '按当前模块全部平台记录的阶段字段统计。' });
  findings.push({ id: 'data-source', level: sourceCounts.size > 1 ? 'opportunity' : 'info', title: '数据来源结构', metric: [...sourceCounts.entries()].map(([key, value]) => `${key}${value}`).join(' / '), evidence: '用于判断BMP同步、Excel导入与人工维护的覆盖情况。' });
  return findings;
}

function analyzeProducts(context: AnalysisContext): AiFinding[] {
  return context.products
    .filter((row) => row.targetQuantity > 0 && row.salesQuantity / row.targetQuantity < .8)
    .sort((a, b) => a.salesQuantity / a.targetQuantity - b.salesQuantity / b.targetQuantity)
    .slice(0, 4)
    .map((row) => ({
      id: `product-${row.productName}`,
      level: row.salesQuantity / row.targetQuantity < .6 ? 'critical' : 'warning',
      title: `${row.productName}目标达成偏弱`,
      metric: `${percent(row.salesQuantity / row.targetQuantity)}达成`,
      evidence: `${row.hospitalCount}家医院，销量${row.salesQuantity}，目标${row.targetQuantity}。`,
    }));
}

function analyzeMedicalLab(context: AnalysisContext): AiFinding[] {
  return context.medicalLab
    .filter((row) => row.amplificationSuccessBp !== null && row.amplificationSuccessBp < 9500)
    .slice(0, 3)
    .map((row) => ({
      id: `lab-${row.hospitalName}-${row.period}`,
      level: 'warning',
      title: `${row.hospitalName}扩增成功率需要复核`,
      metric: percent((row.amplificationSuccessBp || 0) / 10_000),
      evidence: `${row.period}，样本${row.sampleCount}例；需结合批次、样本质量及实验流程复核。`,
    }));
}

function analyzeResearch(context: AnalysisContext): AiFinding[] {
  return context.research.slice(0, 4).map((row) => {
    const ratio = row.totalCostCents ? row.attributableRevenueCents / row.totalCostCents : null;
    return {
      id: `research-${row.hospitalName}`,
      level: ratio !== null && ratio < 1 ? 'warning' as const : 'opportunity' as const,
      title: `${row.hospitalName}科研投入产出`,
      metric: ratio === null ? '收入待归因' : `${ratio.toFixed(2)}倍`,
      evidence: `${row.projectCount}项，${row.laborHours}工时，成本${money(row.totalCostCents)}，论文${row.paperCount}篇、专利${row.patentCount}项。`,
    };
  });
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const result = new Map<string, number>();
  rows.forEach((row) => result.set(key(row), (result.get(key(row)) || 0) + 1));
  return result;
}

function payloadSource(value: string) {
  const metadata = payloadMetadata(value);
  if (metadata.source === 'excel') return 'Excel';
  if (metadata.source === 'manual') return '人工';
  if (metadata.source === 'bmp') return 'BMP';
  if (metadata.source === 'demo') return '演示';
  return '待核验';
}

function payloadMetadata(value: string) {
  try {
    const parsed = JSON.parse(value) as { _source?: string; _sourceVerified?: boolean; _importStatus?: string };
    return { source: parsed._source || 'unknown', sourceVerified: parsed._sourceVerified === true, importStatus: parsed._importStatus || '' };
  } catch {
    return { source: 'unknown', sourceVerified: false, importStatus: '' };
  }
}

function isClosed(status: string, stage: string) { return /完成|闭环|结题|归档|正式运营|已解决/.test(`${status} ${stage}`); }
function date(value: number | null) { return value ? new Date(value).toLocaleDateString('zh-CN') : '未设置'; }
function percent(value: number) { return `${(value * 100).toFixed(1)}%`; }
function money(cents: number) { return `${(cents / 100 / 10_000).toFixed(1)}万元`; }
