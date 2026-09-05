import type { Case, Field, Stage, Step } from './model.ts';

const f = (key: string, label: string, type: Field['type'] = 'text', options?: string[], required = true): Field => ({ key, label, type, options, required });
const yesNo = ['否', '是'];
export const demandFields: Field[] = [
  f('title', '项目 / 需求名称'), f('channel', '需求通道', 'select', ['月度计划', '紧急插单']), f('targetMonth', '目标月份', 'month', undefined, false),
  f('urgentReason', '紧急原因', 'textarea', undefined, false), f('cannotWait', '为什么不能等待月度批次', 'textarea', undefined, false), f('customerDeadline', '客户答复截止日', 'date', undefined, false),
  f('department', '发起部门'), f('region', '所属大区', 'text', undefined, false), f('customerId', 'BMP/CRM医院 / 客户编号', 'text', undefined, false), f('hospital', '医院 / 合作中心', 'text', undefined, false), f('clinicalDepartment', '科室', 'text', undefined, false),
  f('background', '需求背景与目标', 'textarea'), f('businessBasis', '客户业务基础 / 当前合作', 'textarea', undefined, false), f('sampleType', '样本 / 数据类型'), f('sampleQuantity', '预计数量或范围'), f('sampleSource', '样本 / 数据来源'), f('centerCount', '预计中心数', 'number'),
  f('expectedOutput', '预期成果及用途', 'textarea'), f('expectedDate', '期望完成日', 'date'), f('demandEvidence', '需求资料链接 / 云盘路径', 'text', undefined, false),
  f('sponsorEmail', '产品 / 研发Sponsor邮箱', 'email', undefined, false), f('strategicGoal', '战略目标与产品出口', 'textarea', undefined, false),
  f('productGap', '不能走现有产品的原因', 'textarea', undefined, false), f('priceIntent', '价格与收费意向', 'textarea', undefined, false),
];
export const steps: Record<Stage, Step> = {
  draft: { name: '需求草稿', role: 'applicant', help: '先记录需求事实并关联医院端负责人、日常对接人；客户编号和联系人档案均以主数据为准。', fields: demandFields },
  intake: { name: '完整性核验', role: 'pmo', help: '一次核齐资料、医院关键人员及其项目责任，预判A/B/C性质；不替代专业部门审批。', fields: [f('route', '项目性质预判', 'select', ['A', 'B', 'C']), f('evaluationRoles', '需要参与的专业部门'), f('intakeNote', '完整性核验说明', 'textarea')] },
  c_region: { name: '收费需求信息核实', role: 'regional', help: '记录客户真实需求、价格意向和拟交付边界；不在本平台形成报价或公司级承诺。', fields: [f('regionalDemand', '区域核实意见', 'textarea')] },
  product: { name: '产品 / 市场前置评估', role: 'product', help: '产品先判断是否值得建通路，研发不能先行提交。已有成熟产品时退回转正式产品流程。', fields: [f('marketConclusion', '产品缺口、共性与通路价值', 'textarea'), f('reportBoundary', '收费依据与报告用途', 'textarea'), f('transitionUntil', '过渡通路失效日', 'date'), f('exitOwner', '转产 / 退出负责人邮箱', 'email')] },
  technical: { name: '研发 / 执行评估', role: 'technical', help: '明确能否做、谁执行、样本条件、周期及设备/试剂/实验成本；客户是否付费由销售/商务确认。', fields: [f('feasibility', '技术可行性', 'select', ['可行', '条件可行', '不可行']), f('technicalPlan', '技术路线、样本要求、周期与限制', 'textarea'), f('deliveryMode', '建议承接方式', 'select', ['内部研发', '第三方外包', '检验所/生产', '联合承接']), f('testCost', '试实验 / 检测成本（元）', 'number'), f('equipmentCost', '设备及机时成本（元）', 'number'), f('consumableCost', '试剂与耗材成本（元）', 'number'), f('testCostBasis', '研发成本测算依据', 'textarea'), f('resourceSource', '资源 / 经费来源'), f('humanSamples', '涉及人体样本 / 临床研究', 'select', yesNo), f('externalContract', '涉及外部合同 / 采购', 'select', yesNo), f('customerPaid', '是否客户付费', 'select', yesNo), f('customerResources', '需要医院 / 跨区域资源', 'select', yesNo), f('majorCommitment', '重大客户 / 长期资源承诺', 'select', yesNo), f('highRisk', '需公司级合规 / 品牌例外决策', 'select', yesNo)] },
  analysis: { name: '分析人力评估', role: 'analyst', help: '分析包、人天、复核与返工范围分别说清；不涉及分析时填0并说明。', fields: [f('analysisCost', '分析人力成本（元）', 'number'), f('analysisBasis', '工时、复核及返工范围', 'textarea')] },
  costing: { name: '成本汇总与路由', role: 'pmo', help: '汇总研发、分析、论文、专利、外包及项目管理投入；每项有责任部门和测算依据，不把未知金额自动补零。', fields: [f('paperCost', '论文支持成本（元）', 'number'), f('patentCost', '专利成本（元）', 'number'), f('outsourcingCost', '外包成本（元）', 'number'), f('projectManagementCost', '项目管理与协同成本（元）', 'number'), f('otherCost', '其他直接成本（元）', 'number'), f('serviceBasis', '服务范围、工时/供应商与成本依据', 'textarea'), f('riskNote', '风险与建议结论', 'textarea')] },
  budget: { name: 'BMP预算包校验', role: 'budget', help: 'BMP快照可用额＝BMP总额－BMP已用－BMP已锁定。本平台只读已核验快照，项目成本预测单独保存且不扣减BMP余额；调额、锁定、释放和核销均回BMP/财务系统办理。', fields: [f('budgetId', 'BMP预算包编号'), f('budgetNote', '预算快照时间、回执与核验意见', 'textarea')] },
  region: { name: '大区业务意见', role: 'regional', help: '记录客户价值、资源建议和区域承诺；需正式审批时回BMP办理。', fields: [f('regionalOpinion', '客户价值与区域承诺', 'textarea')] },
  marketing: { name: '营销预审建议', role: 'marketing', help: '中台可批量形成预审建议，但不代替BMP正式流程。紧急、超预算和重点项目必须逐项提交BMP。', fields: [f('marketingOpinion', '预审条件与交付要求', 'textarea'), f('approvalUntil', '预审意见有效期', 'date')] },
  sponsor: { name: 'Sponsor战略确认', role: 'sponsor', help: '由指定产品/研发Sponsor确认战略价值、资源及Go/No-Go点；PMO不能代批。', fields: [f('sponsorOpinion', '战略价值、资源承诺与阶段决策点', 'textarea')] },
  department: { name: '产品 / 研发资源意见', role: 'department', help: '记录优先级、技术路线和资源承接建议；需要跨部门正式批准时，须提交BMP并回传流程实例。', fields: [f('departmentOpinion', '部门资源与优先级意见', 'textarea')] },
  b_region: { name: '医院 / 跨区域资源意见', role: 'regional', help: '记录医院、中心及跨区域资源可用性，不代替BMP会签。', fields: [f('centerResourceOpinion', '医院资源与协同意见', 'textarea')] },
  b_marketing: { name: '重大外部承诺预审', role: 'marketing', help: '识别重大客户、长期资源承诺或冲突，并形成提交BMP的预审建议。', fields: [f('externalOpinion', '外部承诺与资源协调建议', 'textarea')] },
  commerce: { name: '商务 / 财务条件核验', role: 'finance', help: '核实收费、合同、回款和报告交付关系；正式报价、合同、付款与财务审批仍在BMP/ERP。', fields: [f('commercialOpinion', '收费、结算、合同与回款核验意见', 'textarea')] },
  compliance: { name: '质量 / 法规 / 医学专业意见', role: 'quality', help: '记录资质、伦理、样本、数据及报告用途的专业意见；不代替有权部门正式审核。', fields: [f('complianceOpinion', '适用要求、风险与准入建议', 'textarea')] },
  exception: { name: 'BMP例外审批回执', role: 'executive', help: '超授权或高风险事项必须在BMP完成正式审批；流程实例和正式状态由已验收接口回传，本节点只记录适用范围和有效期。', fields: [f('exceptionOpinion', 'BMP回执适用范围与核验说明', 'textarea'), f('exceptionUntil', 'BMP审批有效期', 'date')] },
  budget_ready: { name: 'BMP预算结果回执', role: 'budget', help: '额度增补、锁定、释放和核销由BMP/财务系统执行；回执编号和状态由已验收接口回传，本平台只保存成本预测基线，不形成第二套财务占用。', fields: [f('fundingEvidence', '额度落实依据 / 回执链接')] },
  commitment: { name: '锁定部门执行基线', role: 'pmo', help: '引用专业意见和BMP回执，补齐七项执行承诺。全部满足后生成学术支持部项目编号；该编号不替代BMP正式项目编号。', fields: [f('scope', '范围与目标：做什么 / 不做什么', 'textarea'), f('sampleCommitment', '确认样本 / 中心 / 数量与来源', 'textarea'), f('executionDepartment', '执行部门与承接责任'), f('fundingSource', 'BMP预算 / 经费来源及编号'), f('deliverables', '关键交付物与验收标准', 'textarea'), f('deadline', '最终完成日', 'date'), f('managerEmail', '唯一项目经理邮箱', 'email'), f('acceptorEmail', '最终验收人邮箱', 'email')] },
  launch: { name: '部门启动检查', role: 'pmo', help: '方案、资源、适用合同/伦理/合规回执及节点计划齐备才进入部门执行；资料只关联受控云盘路径。', fields: [f('planEvidence', '方案 / 启动纪要链接或路径'), f('resourceEvidence', '执行部门资源确认依据'), f('quoteEvidence', 'BMP报价编号 / 回执', 'text', undefined, false), f('contractEvidence', 'BMP合同编号 / 回执', 'text', undefined, false), f('paymentEvidence', 'BMP支付 / 授信回执', 'text', undefined, false), f('ethicsEvidence', '伦理批准 / 有权部门豁免依据', 'text', undefined, false), f('complianceEvidence', '合规与报告用途正式回执', 'text', undefined, false), f('outsourcingEvidence', '外包协议 / 供应商准入依据', 'text', undefined, false)] },
  execution: { name: '项目执行', role: 'pmo', help: '节点负责人提交交付物，由指定验收人确认。计划变动必须走变更，不能直接覆盖。', fields: [] },
  waiting: { name: '等待客户', role: 'pmo', help: '暂停计时，保留等待责任人和30/60/90天站内提醒；不会擅自自动关闭项目。', fields: [] },
  paused: { name: '暂停', role: 'pmo', help: '记录原因、恢复条件和责任人；恢复保留暂停时间。', fields: [] },
  acceptance: { name: '部门交付验收', role: 'pmo', help: '指定验收人确认七项承诺、交付证据和后续事项；涉及公司级或客户签署的验收须登记外部回执。', fields: [f('acceptanceEvidence', '部门验收记录 / 客户确认依据'), f('outcomes', '论文、专利、产品 / 客户价值结果', 'textarea'), f('followUp', '后续行动与责任人（无则说明）', 'textarea')] },
  settlement: { name: '成本归集与项目收口', role: 'finance', help: '平台汇总实际投入与收入用于复盘；正式核销、回款和额度释放状态由BMP/财务已验收接口回传，不能手工代填。', fields: [f('actualCost', '实际归集成本（元）', 'number'), f('revenue', '实际客户收入（元）', 'number'), f('archiveEvidence', '结题 / 终止资料归档路径')] },
  closed: { name: '部门已收口', role: 'pmo', help: '保留专业意见、交付、BMP回执和成本复盘记录，支持归档查询。', fields: [] },
  terminated: { name: '部门已终止', role: 'pmo', help: '保留终止原因、已发生投入和外部回执；不能删除历史协同记录。', fields: [] },
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
