import type { ModuleDefinition } from './types';

export const researchModule: ModuleDefinition = {
  home: {
    code: '研', name: '科研项目', source: '独立科研工作区 / BMP待对接', state: '流程可演练', stateTone: 'teal',
    desc: '部门需求评估、资源计划、项目协同与交付；正式审批和预算事实留在BMP。', metric: 'A / B / C', metricLabel: '三类分路 · 一条业务链', tone: 'violet',
  },
  platform: {
    slug: 'research', short: '研', name: '科研项目管理', source: '学术支持部门工作区；BMP主数据与回执待对接', owner: '学术PMO',
    objective: '先判断值不值得做，再决定怎么做，最后管是否按期交付。',
    flow: ['需求登记', '项目评估', '部门建档 / BMP回执', '启动门禁', '里程碑执行', '验收与转化'],
    gates: ['先定客情/战略研发/收费过渡三类业务性质', '报价、合同、伦理及合规条件按路由强制校验', '多中心按主项目+中心子项目管理'],
    kpis: [
      { label: '历史科研台账', value: '待迁移', note: '从BMP读取，保留源项目ID' },
      { label: '部门在途项目', value: '待录入', note: '按主项目与中心子项目管理' },
      { label: '逾期项目', value: '待统计', note: '按里程碑计划日期计算' },
      { label: '成果转化', value: '待核验', note: '论文/专利/产品证据' },
    ],
    columns: ['项目编号', '项目名称', '业务性质', '当前节点', '项目经理', '风险'],
    rows: [['待迁移', 'BMP历史科研项目', '保留原分类', '接口待确认', 'IT/学术PMO', '待核验']],
  },
};
