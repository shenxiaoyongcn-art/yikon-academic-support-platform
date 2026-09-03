import type { Case, Field, Stage, Step } from './model.ts';

const f = (key: string, label: string, type: Field['type'] = 'text', options?: string[], required = true): Field => ({ key, label, type, options, required });
const yesNo = ['否', '是'];
export const demandFields: Field[] = [
  f('title', '项目 / 需求名称'), f('channel', '需求通道', 'select', ['月度计划', '紧急插单']), f('targetMonth', '目标月份', 'month', undefined, false),
  f('urgentReason', '紧急原因', 'textarea', undefined, false), f('cannotWait', '为什么不能等待月度批次', 'textarea', undefined, false), f('customerDeadline', '客户答复截止日', 'date', undefined, false),
  f('department', '发起部门'), f('region', '所属大区', 'text', undefined, false), f('customerId', 'CRM医院 / 客户编号', 'text', undefined, false), f('hospital', '医院 / 合作中心', 'text', undefined, false), f('clinicalDepartment', '科室', 'text', undefined, false),
  f('background', '需求背景与目标', 'textarea'), f('businessBasis', '客户业务基础 / 当前合作', 'textarea', undefined, false), f('sampleType', '样本 / 数据类型'), f('sampleQuantity', '预计数量或范围'), f('sampleSource', '样本 / 数据来源'), f('centerCount', '预计中心数', 'number'),
  f('expectedOutput', '预期成果及用途', 'textarea'), f('expectedDate', '期望完成日', 'date'), f('demandEvidence', '需求资料链接 / 云盘路径', 'text', undefined, false),
  f('sponsorEmail', '产品 / 研发Sponsor邮箱', 'email', undefined, false), f('strategicGoal', '战略目标与产品出口', 'textarea', undefined, false),
  f('productGap', '不能走现有产品的原因', 'textarea', undefined, false), f('priceIntent', '价格与收费意向', 'textarea', undefined, false),
];
export const steps: Record<Stage, Step> = {
  draft: { name: '需求草稿', role: 'applicant', help: '先记录需求事实，不重复填审批长表。客户编号以CRM为准，名称不是主数据。', fields: demandFields },
  intake: { name: '完整性核验', role: 'pmo', help: '核齐资料、预判A/B/C性质；不替代专业部门审批。', fields: [f('route', '项目性质预判', 'select', ['A', 'B', 'C']), f('evaluationRoles', '需要参与的专业部门'), f('intakeNote', '完整性核验说明', 'textarea')] },
  c_region: { name: '真实收费需求确认', role: 'regional', help: '确认客户真实需求、价格意向、交付承诺。', fields: [f('regionalDemand', '区域确认意见', 'textarea')] },
  product: { name: '产品 / 市场前置评估', role: 'product', help: '产品先判断是否值得建通路，研发不能先行提交。已有成熟产品时退回转正式产品流程。', fields: [f('marketConclusion', '产品缺口、共性与通路价值', 'textarea'), f('reportBoundary', '收费依据与报告用途', 'textarea'), f('transitionUntil', '过渡通路失效日', 'date'), f('exitOwner', '转产 / 退出负责人邮箱', 'email')] },
  technical: { name: '研发 / 执行评估', role: 'technical', help: '明确能否做、成本、样本条件、周期和承接方式。', fields: [f('feasibility', '技术可行性', 'select', ['可行', '条件可行', '不可行']), f('technicalPlan', '技术路线、样本要求、周期与限制', 'textarea'), f('deliveryMode', '建议承接方式', 'select', ['内部研发', '第三方外包', '检验所/生产', '联合承接']), f('testCost', '试实验 / 检测成本（元）', 'number'), f('testCostBasis', '检测成本测算依据', 'textarea'), f('resourceSource', '资源 / 经费来源'), f('humanSamples', '涉及人体样本 / 临床研究', 'select', yesNo), f('externalContract', '涉及外部合同 / 采购', 'select', yesNo), f('customerPaid', '是否客户付费', 'select', yesNo), f('customerResources', '需要医院 / 跨区域资源', 'select', yesNo), f('majorCommitment', '重大客户 / 长期资源承诺', 'select', yesNo), f('highRisk', '需公司级合规 / 品牌例外决策', 'select', yesNo)] },
  analysis: { name: '分析人力评估', role: 'analyst', help: '分析包、人天、复核与返工范围分别说清；不涉及分析时填0并说明。', fields: [f('analysisCost', '分析人力成本（元）', 'number'), f('analysisBasis', '工时、复核及返工范围', 'textarea')] },
  costing: { name: '成本汇总与路由', role: 'pmo', help: '补齐论文、专利、外包及其他成本，引用专业结论，系统汇总；不强制计算ROI。', fields: [f('paperCost', '论文支持成本（元）', 'number'), f('patentCost', '专利成本（元）', 'number'), f('outsourcingCost', '外包成本（元）', 'number'), f('otherCost', '其他直接成本（元）', 'number'), f('serviceBasis', '服务范围、供应商与成本依据', 'textarea'), f('riskNote', '风险与建议结论', 'textarea')] },
  budget: { name: '医院预算核验', role: 'budget', help: '引用预算包主数据：总额－已用－已锁定＝可用。本次申请自动引用评估总成本。', fields: [f('budgetId', '医院预算包编号'), f('budgetNote', '预算核验意见', 'textarea')] },
  region: { name: '大区预算使用审批', role: 'regional', help: '批客户价值、预算使用与区域承诺，不重复审批技术细节。', fields: [f('regionalOpinion', '客户价值与区域承诺', 'textarea')] },
  marketing: { name: '营销预审 / 单项审批', role: 'marketing', help: '月度、预算内且无重大承诺可批量预审。紧急、超预算和重点项目必须逐项审批。', fields: [f('marketingOpinion', '审批条件与交付要求', 'textarea'), f('approvalUntil', '批准有效期', 'date')] },
  sponsor: { name: 'Sponsor战略确认', role: 'sponsor', help: '由指定产品/研发Sponsor确认战略价值、资源及Go/No-Go点；PMO不能代批。', fields: [f('sponsorOpinion', '战略价值、资源承诺与阶段决策点', 'textarea')] },
  department: { name: '产品 / 研发部门审批', role: 'department', help: '确认优先级、技术路线和预算资源，学术PMO负责管理但不代替决策。', fields: [f('departmentOpinion', '部门资源与优先级批准意见', 'textarea')] },
  b_region: { name: '医院 / 跨区域资源会签', role: 'regional', help: '仅确认医院、中心及跨区域资源。', fields: [f('centerResourceOpinion', '医院资源与协同承诺', 'textarea')] },
  b_marketing: { name: '重大外部承诺会签', role: 'marketing', help: '仅对重大客户、长期资源承诺或冲突作决策。', fields: [f('externalOpinion', '外部承诺与资源协调意见', 'textarea')] },
  commerce: { name: '商务 / 财务会签', role: 'finance', help: '明确收费、合同、回款和报告交付关系；此处不代替实际报价/合同对象。', fields: [f('commercialOpinion', '收费、结算、合同与回款条件', 'textarea')] },
  compliance: { name: '质量 / 法规 / 医学会签', role: 'quality', help: '按实际项目确认资质、伦理、样本、数据及报告用途，不代替有权部门的正式审核。', fields: [f('complianceOpinion', '适用要求、风险与准入结论', 'textarea')] },
  exception: { name: '授权外例外审批', role: 'executive', help: '金额授权未配置时，超预算不自动放行；例外审批留证，预算不足仍须补足额度。', fields: [f('exceptionOpinion', '例外批准范围、条件与依据', 'textarea'), f('exceptionUntil', '例外批准有效期', 'date')] },
  budget_ready: { name: '预算额度落实', role: 'budget', help: '最终批准后原子锁定预算；余额不足须先取得增补额度批准，再维护预算包，不允许负余额启动。', fields: [f('fundingEvidence', '额度落实 / 增补批准依据')] },
  commitment: { name: '锁定七项承诺', role: 'pmo', help: '引用已通过的评估与审批，仅补齐执行承诺。全部满足才生成正式项目编号和不可覆盖的基线。', fields: [f('scope', '范围与目标：做什么 / 不做什么', 'textarea'), f('sampleCommitment', '确认样本 / 中心 / 数量与来源', 'textarea'), f('executionDepartment', '执行部门与承接责任'), f('fundingSource', '预算 / 经费来源及编号'), f('deliverables', '关键交付物与验收标准', 'textarea'), f('deadline', '最终完成日', 'date'), f('managerEmail', '唯一项目经理邮箱', 'email'), f('acceptorEmail', '最终验收人邮箱', 'email')] },
  launch: { name: '启动门禁', role: 'pmo', help: '方案、资源、适用合同/伦理/合规及节点计划齐备才允许执行；上传资料请关联受控云盘路径。', fields: [f('planEvidence', '批准方案 / 启动纪要链接或路径'), f('resourceEvidence', '执行部门资源确认依据'), f('quoteEvidence', '报价编号 / 依据', 'text', undefined, false), f('contractEvidence', '合同编号 / 依据', 'text', undefined, false), f('paymentEvidence', '支付 / 授信条件落实依据', 'text', undefined, false), f('ethicsEvidence', '伦理批准 / 有权部门豁免依据', 'text', undefined, false), f('complianceEvidence', '合规与报告用途批准依据', 'text', undefined, false), f('outsourcingEvidence', '外包协议 / 供应商准入依据', 'text', undefined, false)] },
  execution: { name: '项目执行', role: 'pmo', help: '节点负责人提交交付物，由指定验收人确认。计划变动必须走变更，不能直接覆盖。', fields: [] },
  waiting: { name: '等待客户', role: 'pmo', help: '暂停计时，保留等待责任人和30/60/90天站内提醒；不会擅自自动关闭项目。', fields: [] },
  paused: { name: '暂停', role: 'pmo', help: '记录原因、恢复条件和责任人；恢复保留暂停时间。', fields: [] },
  acceptance: { name: '最终验收', role: 'pmo', help: '指定最终验收人确认七项承诺、交付证据和后续事项。', fields: [f('acceptanceEvidence', '最终验收记录 / 客户确认依据'), f('outcomes', '论文、专利、产品 / 客户价值结果', 'textarea'), f('followUp', '后续行动与责任人（无则说明）', 'textarea')] },
  settlement: { name: '费用核销与结题', role: 'finance', help: '实际费用核销，释放剩余额度；客户支付与公司投入分开，不把预算投入记成收入。', fields: [f('actualCost', '实际归集成本（元）', 'number'), f('revenue', '实际客户收入（元）', 'number'), f('paymentStatus', '回款情况 / 依据'), f('archiveEvidence', '结题 / 终止资料归档路径')] },
  closed: { name: '已结题', role: 'pmo', help: '历史审批、交付和预算核销记录保留，支持归档查询。', fields: [] },
  terminated: { name: '已终止', role: 'pmo', help: '保留终止原因与费用记录；不能删除历史审批。', fields: [] },
  archived: { name: '已归档', role: 'pmo', help: '只读归档。', fields: [] },
  returned: { name: '退回补充', role: 'applicant', help: '记录缺失项和补充截止日，补充后重新核验，不丢失原需求。', fields: demandFields },
  reserve: { name: '需求储备', role: 'applicant', help: '保留需求、下一步责任人和复审日期，可重新提交。', fields: demandFields },
};

export const templates = {
  A: ['样本 / 数据接收', '内部 / 外包执行', '阶段交付与验收', '论文 / 专利 / 客户成果'],
  B: ['方案冻结 / 中心启动', '样本入组与实验', '数据锁定与阶段验收', '产品决策与成果转化'],
  C: ['样本接收与质控', '检测 / 分析', '报告复核与交付', '转产 / 退出决策'],
};

export function routeStages(c: Case): Stage[] {
  const d = c.data;
  const sequence: Stage[] = ['intake'];
  if (c.route === 'C') sequence.push('c_region', 'product');
  sequence.push('technical', 'analysis', 'costing');
  if (c.route === 'A') sequence.push('budget', 'region', 'marketing');
  if (c.route === 'B') {
    sequence.push('sponsor', 'department');
    if (d.customerResources === '是') sequence.push('b_region');
    if (d.majorCommitment === '是') sequence.push('b_marketing');
  }
  if (c.route === 'C' || d.customerPaid === '是' || d.externalContract === '是' || d.deliveryMode === '第三方外包' || d.deliveryMode === '联合承接') sequence.push('commerce');
  if (c.route === 'C' || d.humanSamples === '是' || d.highRisk === '是') sequence.push('compliance');
  if (d.exceptionRequired === '是') sequence.push('exception');
  if (c.route === 'A' && d.overBudget === '是') sequence.push('budget_ready');
  sequence.push('commitment', 'launch', 'execution', 'acceptance', 'settlement', 'closed');
  return sequence;
}

export function fieldsFor(c: Case): Field[] {
  return steps[c.stage].fields.filter(field => {
    if (['targetMonth'].includes(field.key)) return c.data.channel !== '紧急插单';
    if (['urgentReason', 'cannotWait', 'customerDeadline'].includes(field.key)) return c.data.channel === '紧急插单';
    if (['sponsorEmail', 'strategicGoal'].includes(field.key)) return c.route === 'B';
    if (['productGap', 'priceIntent'].includes(field.key)) return c.route === 'C';
    return true;
  });
}
