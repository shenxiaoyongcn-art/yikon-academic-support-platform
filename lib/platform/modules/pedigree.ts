import type { ModuleDefinition } from './types';

export const pedigreeModule: ModuleDefinition = {
  home: {
    code: '系', name: '遗传家系图', source: '本地浏览器', state: '可用', stateTone: 'teal',
    desc: '标准系谱符号、亲缘关系、表型与基因型一体化绘制。', metric: '3', metricLabel: '导出格式', tone: 'teal',
  },
  platform: {
    slug: 'pedigree', short: '系', name: '遗传家系图', source: '本地加密浏览器工作台', owner: '遗传咨询组',
    objective: '快速完成标准家系图绘制、表型与基因型记录，支持结构化交付。',
    flow: ['建立家系', '添加成员', '设置关系', '标记表型', '录入基因型', '导出归档'],
    gates: ['建议使用去标识化病例编号', '先证者与患病状态必须分别标注', '用于临床或PGT前须由专业人员复核'],
    kpis: [
      { label: '绘图方式', value: '自动排版', note: '三代家系一键生成' },
      { label: '成员状态', value: '4类', note: '未患病/患病/携带/不明' },
      { label: '导出', value: '3格式', note: 'PNG / SVG / JSON' },
      { label: '隐私', value: '本地', note: '默认不上传病例数据' },
    ],
    columns: ['家系', '基因', '遗传模式', '成员数', '更新时间', '状态'],
    rows: [['GJB2遗传性耳聋家系', 'GJB2', '常染色体隐性', '8', '今日', '可编辑']],
  },
};
