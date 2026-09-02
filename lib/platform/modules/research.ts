import type { ModuleDefinition } from './types';

export const researchModule: ModuleDefinition = {
  home: {
    code: '研', name: '科研项目', source: 'BMP / CRM', state: '数据底座已就绪', stateTone: 'teal',
    desc: '从需求评估、立项审批到里程碑、验收和成果转化。', metric: '157', metricLabel: '执行中 / 待执行', tone: 'violet',
  },
  platform: {
    slug: 'research', short: '研', name: '科研项目管理', source: 'BMP / CRM', owner: '学术PMO',
    objective: '先判断值不值得做，再决定怎么做，最后管是否按期交付。',
    flow: ['需求登记', '项目评估', '正式立项', '启动门禁', '里程碑执行', '验收与转化'],
    gates: ['先定客情/战略研发/收费过渡三类业务性质', '报价、合同、伦理及合规条件按路由强制校验', '多中心按主项目+中心子项目管理'],
    kpis: [
      { label: '全部台账', value: '512', note: '待主子项目去重' },
      { label: '在途项目', value: '157', note: '执行中/待执行' },
      { label: '本月逾期', value: '23', note: '超过计划日期' },
      { label: '成果转化', value: '38', note: '论文/专利/产品证据' },
    ],
    columns: ['项目编号', '项目名称', '业务性质', '当前节点', '项目经理', '风险'],
    rows: [
      ['R-2026-018', 'MaReCs多中心真实世界研究', '战略研发', '中心入组', '刘然', '中'],
      ['R-2026-043', 'NICS临床价值评估', '客情科研', '统计分析', '周珊', '低'],
      ['R-2026-061', '特殊CNV检测方法学验证', '收费过渡', '合规审核', '陈哲', '高'],
    ],
  },
  maintenance: {
    slug: 'research', dbModule: 'research', bmpModule: 'research', recordName: '科研项目', titleLabel: '科研项目名称',
    titlePlaceholder: '如：MaReCs 多中心真实世界研究', customerLabel: '医院/合作单位',
    stages: ['需求登记', '项目评估', '正式立项', '项目启动', '执行中', '结题转化'], defaultStatus: '待评估',
    fields: [
      { key: 'businessNature', label: '业务性质', type: 'select', options: ['客情科研', '战略研发', '收费过渡'] },
      { key: 'principalInvestigator', label: '项目负责人/PI', type: 'text' },
      { key: 'expectedOutput', label: '预期成果', type: 'textarea', placeholder: '论文、专利、产品证据或客户汇报' },
    ],
  },
};
