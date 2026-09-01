import type { ModuleSlug } from './catalog';

export type MaintenanceModuleSlug = Exclude<ModuleSlug, 'pedigree'>;
export type WorkItemModule = 'tender' | 'research' | 'aftersales' | 'events' | 'analytics' | 'pgd_review' | 'training';
export type MaintenanceFieldType = 'text' | 'number' | 'date' | 'textarea' | 'select';

export type MaintenanceField = {
  key: string;
  label: string;
  type: MaintenanceFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export type MaintenanceConfig = {
  slug: MaintenanceModuleSlug;
  dbModule: WorkItemModule;
  bmpModule: 'tender' | 'research' | 'aftersales' | 'events' | 'salesAnalytics' | 'pgdReview' | 'training';
  recordName: string;
  titleLabel: string;
  titlePlaceholder: string;
  customerLabel: string;
  stages: string[];
  defaultStatus: string;
  fields: MaintenanceField[];
};

const configs: Record<MaintenanceModuleSlug, MaintenanceConfig> = {
  tender: {
    slug: 'tender',
    dbModule: 'tender',
    bmpModule: 'tender',
    recordName: '招标需求',
    titleLabel: '招标项目名称',
    titlePlaceholder: '如：PGT-A 试剂招标',
    customerLabel: '招标单位/医院',
    stages: ['需求登记', '参数拆解', '证据检索', '技术应答', '技术复核', '结果归档'],
    defaultStatus: '待处理',
    fields: [
      { key: 'productLine', label: '产品线', type: 'text', placeholder: 'PGT-A / PGT-M / 测序平台' },
      { key: 'bidDeadline', label: '投标截止时间', type: 'date' },
      { key: 'requirement', label: '核心参数或资料需求', type: 'textarea', placeholder: '填写必须响应项、材料缺口或特别要求' },
    ],
  },
  research: {
    slug: 'research',
    dbModule: 'research',
    bmpModule: 'research',
    recordName: '科研项目',
    titleLabel: '科研项目名称',
    titlePlaceholder: '如：MaReCs 多中心真实世界研究',
    customerLabel: '医院/合作单位',
    stages: ['需求登记', '项目评估', '正式立项', '项目启动', '执行中', '结题转化'],
    defaultStatus: '待评估',
    fields: [
      { key: 'businessNature', label: '业务性质', type: 'select', options: ['客情科研', '战略研发', '收费过渡'] },
      { key: 'principalInvestigator', label: '项目负责人/PI', type: 'text' },
      { key: 'expectedOutput', label: '预期成果', type: 'textarea', placeholder: '论文、专利、产品证据或客户汇报' },
    ],
  },
  aftersales: {
    slug: 'aftersales',
    dbModule: 'aftersales',
    bmpModule: 'aftersales',
    recordName: '售后工单',
    titleLabel: '问题主题',
    titlePlaceholder: '一句话说明客户问题',
    customerLabel: '客户/医院',
    stages: ['统一受理', '分级派单', '处理中', '待客户确认', '根因复盘', '已闭环'],
    defaultStatus: '待受理',
    fields: [
      { key: 'category', label: '问题分类', type: 'select', options: ['报告解读', '样本质量', '实验问题', '系统使用', '物流时效', '其他'] },
      { key: 'responsibleDepartment', label: '责任部门', type: 'text', placeholder: '医学部 / 实验室 / IT / 物流' },
      { key: 'issueDescription', label: '问题描述与客户诉求', type: 'textarea', required: true },
    ],
  },
  events: {
    slug: 'events',
    dbModule: 'events',
    bmpModule: 'events',
    recordName: '学术讲座申请',
    titleLabel: '会议/讲座名称',
    titlePlaceholder: '如：PGT-M 家系单体型实战讲座',
    customerLabel: '主办医院/目标客户',
    stages: ['申请中', '方案审批', '会前筹备', '会议执行', '7/30/90日跟进', '效果复盘'],
    defaultStatus: '待审批',
    fields: [
      { key: 'eventType', label: '活动类型', type: 'select', options: ['院内讲座', '区域沙龙', '培训班', '全国会议', '线上会议', '其他'] },
      { key: 'eventDate', label: '计划举办日期', type: 'date', required: true },
      { key: 'budget', label: '预算（元）', type: 'number', placeholder: '0' },
      { key: 'eventObjective', label: '学术目标与商业目标', type: 'textarea', required: true, placeholder: '写清目标客户、产品、观念改变及预期转化' },
    ],
  },
  analytics: {
    slug: 'analytics',
    dbModule: 'analytics',
    bmpModule: 'salesAnalytics',
    recordName: '数据分析任务',
    titleLabel: '分析任务名称',
    titlePlaceholder: '如：华南区 NICS 销量薄弱医院分析',
    customerLabel: '医院/分析对象',
    stages: ['需求登记', '数据同步', '口径校验', '数据分析', '结论复核', '汇报输出'],
    defaultStatus: '待分析',
    fields: [
      { key: 'analysisScope', label: '分析维度', type: 'select', options: ['产品×医院', '人员×医院×产品', '医检所运营质量', '科研投入产出', '其他'] },
      { key: 'analysisPeriod', label: '统计周期', type: 'text', placeholder: '如：2026-Q3 / 2026-01至2026-09' },
      { key: 'deliverable', label: '汇报要求', type: 'textarea', placeholder: '说明重点指标、汇报对象及是否需要 PPT' },
    ],
  },
  'pgd-review': {
    slug: 'pgd-review',
    dbModule: 'pgd_review',
    bmpModule: 'pgdReview',
    recordName: 'PGD评审/筹建单位',
    titleLabel: '评审协助事项',
    titlePlaceholder: '如：某妇幼 PGD 试运行评审辅导',
    customerLabel: '申报单位/医院',
    stages: ['申报中的单位', '筹建中单位', '试运行评审', '正式运营', '遗传咨询培训及诊疗路径梳理'],
    defaultStatus: '推进中',
    fields: [
      { key: 'completeness', label: '本阶段完成度（%）', type: 'number', placeholder: '0-100' },
      { key: 'plannedReviewDate', label: '计划评审日期', type: 'date' },
      { key: 'reviewGap', label: '资料缺口/下一节点', type: 'textarea', placeholder: '制度、SOP、人员、场地、设备或整改事项' },
    ],
  },
  training: {
    slug: 'training',
    dbModule: 'training',
    bmpModule: 'training',
    recordName: '遗传咨询培训需求',
    titleLabel: '培训需求名称',
    titlePlaceholder: '如：某中心 PGT-M 遗传咨询进阶培训',
    customerLabel: '需求医院/中心',
    stages: ['需求登记', '能力测评', '课程规划', '培训执行', '考核认证', '能力复评'],
    defaultStatus: '待评估',
    fields: [
      { key: 'learningPath', label: '培训路径', type: 'select', options: ['生殖遗传基础', 'PGT-A', 'PGT-SR', 'PGT-M', 'CNV与结构变异', '个案实训'] },
      { key: 'traineeCount', label: '计划培训人数', type: 'number', placeholder: '0' },
      { key: 'trainingObjective', label: '能力目标与需求说明', type: 'textarea', required: true },
    ],
  },
};

export const maintenanceModules = Object.values(configs);

export function getMaintenanceConfig(slug: string) {
  return configs[slug as MaintenanceModuleSlug];
}

export function getMaintenanceConfigByDbModule(module: string) {
  return maintenanceModules.find((item) => item.dbModule === module);
}

