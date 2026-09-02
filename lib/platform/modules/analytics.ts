import type { ModuleDefinition } from './types';

export const analyticsModule: ModuleDefinition = {
  home: {
    code: '析', name: '数据分析与汇报', source: 'BMP / 医检所', state: '规则引擎已接入', stateTone: 'teal',
    desc: '薄弱产品、医院运营质量、人员贡献及季度汇报一体化分析。', metric: 'AI', metricLabel: '辅助分析可追溯', tone: 'magenta',
  },
  platform: {
    slug: 'analytics', short: '析', name: '数据分析与汇报', source: 'BMP销量 + 医检所运营数据', owner: '学术运营与数据分析组',
    objective: '用医院、产品和学术支持人员三层数据定位销量薄弱点，并将医检所运营质量转成可直接汇报的管理结论。',
    flow: ['数据同步', '口径校验', '薄弱产品识别', '医院与人员归因', '运营质量分析', '季度PPT汇报'],
    gates: ['销量必须按医院、产品、期间和责任人统一颗粒度', '扩增成功率、阳性率、阴性率、嵌合率必须保留分母口径', '汇报导出必须标记数据截止时间和数据源'],
    kpis: [
      { label: 'BMP销量数据', value: '待接入', note: '接口与字段映射已预留' },
      { label: '薄弱产品识别', value: '规则就绪', note: '目标达成、同比及医院渗透率' },
      { label: '医检所运营数据', value: '待接入', note: '按医院与统计周期同步' },
      { label: '季度PPT汇报', value: '可生成', note: '带数据源与口径说明' },
    ],
    columns: ['分析对象', '分析维度', '核心指标', '当前状态', '责任人', '下一动作'],
    rows: [
      ['产品销量薄弱分析', '产品×医院', '目标达成率/同比', '待BMP同步', '学术运营', '接口字段确认'],
      ['学术支持贡献分析', '人员×医院×产品', '覆盖/增量/转化', '待BMP同步', '部门负责人', '人员映射确认'],
      ['医检所运营质量', '医院×周期', '扩增/阳性/阴性/嵌合率', '待医检所同步', '医学与运营', '口径校验'],
    ],
  },
  maintenance: {
    slug: 'analytics', dbModule: 'analytics', bmpModule: 'salesAnalytics', recordName: '数据分析任务', titleLabel: '分析任务名称',
    titlePlaceholder: '如：华南区 NICS 销量薄弱医院分析', customerLabel: '医院/分析对象',
    stages: ['需求登记', '数据同步', '口径校验', '数据分析', '结论复核', '汇报输出'], defaultStatus: '待分析',
    fields: [
      { key: 'analysisScope', label: '分析维度', type: 'select', options: ['产品×医院', '人员×医院×产品', '医检所运营质量', '科研投入产出', '其他'] },
      { key: 'analysisPeriod', label: '统计周期', type: 'text', placeholder: '如：2026-Q3 / 2026-01至2026-09' },
      { key: 'deliverable', label: '汇报要求', type: 'textarea', placeholder: '说明重点指标、汇报对象及是否需要 PPT' },
    ],
  },
};
