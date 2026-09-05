import type { ModuleDefinition } from './types';

export const aftersalesModule: ModuleDefinition = {
  home: {
    code: '售', name: '售后闭环', source: '平台售后台账；BMP / CRM接口待确认', state: '接口待确认', stateTone: 'blue',
    desc: '统一受理、多部门协同、SLA预警、根因归类与闭环复盘。', metric: '待统计', metricLabel: '真实SLA达成率', tone: 'blue',
  },
  platform: {
    slug: 'aftersales', short: '售', name: '售后闭环中心', source: '平台售后台账；BMP / CRM接口与字段口径待确认', owner: '学术支持统一接口',
    objective: '不只解决当下问题，还要找到重复问题的根因，推动产品与流程改进。',
    flow: ['统一受理', '严重度分级', '责任部门派单', 'SLA跟踪', '客户确认', '根因复盘'],
    gates: ['P0/P1必须自动升级', '关单前必须有客户确认或书面说明', '同类问题重复3次自动生成CAPA'],
    kpis: [
      { label: '待闭环', value: '待导入', note: '以真实工单台账为准' },
      { label: 'SLA达成', value: '待统计', note: '需先确认分级与时钟口径' },
      { label: '重复问题', value: '待归类', note: '按问题根因去重' },
      { label: '客户满意度', value: '待采集', note: '关单后回访' },
    ],
    columns: ['工单', '客户', '问题分类', '剩余SLA', '责任部门', '状态'],
    rows: [['待导入', '真实售后台账', '待归类', '待计算', '待分派', '数据盘点']],
  },
  maintenance: {
    slug: 'aftersales', dbModule: 'aftersales', bmpModule: 'aftersales', recordName: '售后工单', titleLabel: '问题主题',
    titlePlaceholder: '一句话说明客户问题', customerLabel: '客户/医院',
    stages: ['统一受理', '分级派单', '处理中', '待客户确认', '根因复盘', '已闭环'], defaultStatus: '待受理',
    fields: [
      { key: 'category', label: '问题分类', type: 'select', options: ['报告解读', '样本质量', '实验问题', '系统使用', '物流时效', '其他'] },
      { key: 'responsibleDepartment', label: '责任部门', type: 'text', placeholder: '医学部 / 实验室 / IT / 物流' },
      { key: 'issueDescription', label: '问题描述与客户诉求', type: 'textarea', required: true },
    ],
  },
};
