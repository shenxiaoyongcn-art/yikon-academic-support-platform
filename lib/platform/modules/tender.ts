import type { ModuleDefinition } from './types';

export const tenderModule: ModuleDefinition = {
  home: {
    code: '标', name: '招标中心', source: 'Synology 云盘', state: 'API已确认', stateTone: 'teal',
    desc: '参数抽取、证据定位、资质有效期与技术应答一体化。', metric: '4,826', metricLabel: '已索引材料', tone: 'magenta',
  },
  platform: {
    slug: 'tender', short: '标', name: '招标中心', source: 'Synology 云盘 + 平台证据索引', owner: '招标PMO',
    objective: '从“人找文件”升级为“参数—证据—应答—审核”可追溯闭环。',
    flow: ['招标需求登记', '参数拆解', '云盘证据检索', '差异化应答', '技术复核', '结果复盘归档'],
    gates: ['注册证/资质必须在有效期', '参数不得超出证据边界', '对外应答必须留存版本和复核人'],
    kpis: [
      { label: '待应答', value: '12', note: '3项距截止小于48小时' },
      { label: '证据覆盖率', value: '86.4%', note: '按必须响应项统计' },
      { label: '资质预警', value: '7', note: '90天内到期' },
      { label: '本季中标率', value: '71.2%', note: '+8.3%同比' },
    ],
    columns: ['项目', '客户', '截止时间', '证据覆盖', '负责人', '状态'],
    rows: [
      ['PGT-A试剂招标', '某省妇幼保健院', '09-03 17:00', '92%', '李文慧', '技术复核'],
      ['胚胎植入前遗传检测服务', '某大学附属医院', '09-06 12:00', '78%', '王宁', '证据补齐'],
      ['高通量测序平台采购', '某市人民医院', '09-12 17:00', '64%', '陈晨', '参数拆解'],
    ],
  },
  maintenance: {
    slug: 'tender', dbModule: 'tender', bmpModule: 'tender', recordName: '招标需求', titleLabel: '招标项目名称',
    titlePlaceholder: '如：PGT-A 试剂招标', customerLabel: '招标单位/医院',
    stages: ['需求登记', '参数拆解', '证据检索', '技术应答', '技术复核', '结果归档'], defaultStatus: '待处理',
    fields: [
      { key: 'productLine', label: '产品线', type: 'text', placeholder: 'PGT-A / PGT-M / 测序平台' },
      { key: 'bidDeadline', label: '投标截止时间', type: 'date' },
      { key: 'requirement', label: '核心参数或资料需求', type: 'textarea', placeholder: '填写必须响应项、材料缺口或特别要求' },
    ],
  },
};
