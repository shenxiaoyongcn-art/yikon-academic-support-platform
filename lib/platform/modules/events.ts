import type { ModuleDefinition } from './types';

export const eventsModule: ModuleDefinition = {
  home: {
    code: '会', name: '推广会议', source: 'BMP / 销售数据', state: '规则待确认', stateTone: 'amber',
    desc: '会前目标、现场达成、会后商机与销量转化统一复盘。', metric: '26', metricLabel: '本季度已落地', tone: 'orange',
  },
  platform: {
    slug: 'events', short: '会', name: '推广会议与效果复盘', source: 'BMP + CRM商机 + 销量数据', owner: '区域学术经理',
    objective: '会议不按场次论英雄，按客户层级、学术观念改变和商业转化评价。',
    flow: ['会前目标', '客户与讲者', '内容审核', '会议执行', '7/30/90日跟进', '商机销量复盘'],
    gates: ['未明确目标客户和商业目标不立项', '超预算必须升级审批', '会后30日无跟进记录不计有效会议'],
    kpis: [
      { label: '本季度场次', value: '26', note: '含7场高阶赋能' },
      { label: '决策人覆盖', value: '81', note: '主任/学科带头人' },
      { label: '有效商机', value: '42', note: '会后90日' },
      { label: '转化金额', value: '368万', note: '已关联CRM' },
    ],
    columns: ['会议', '区域', '目标客户', '决策人', '会后商机', '复盘'],
    rows: [
      ['生殖遗传精准诊疗沙龙', '华南', '18', '7', '6', '7日完成'],
      ['PGT-M家系单体型实战班', '华东', '24', '9', '8', '30日跟进'],
      ['遗传咨询能力建设班', '西南', '16', '5', '4', '待复盘'],
    ],
  },
  maintenance: {
    slug: 'events', dbModule: 'events', bmpModule: 'events', recordName: '学术讲座申请', titleLabel: '会议/讲座名称',
    titlePlaceholder: '如：PGT-M 家系单体型实战讲座', customerLabel: '主办医院/目标客户',
    stages: ['申请中', '方案审批', '会前筹备', '会议执行', '7/30/90日跟进', '效果复盘'], defaultStatus: '待审批',
    fields: [
      { key: 'eventType', label: '会议类型', type: 'select', options: ['科室会', '院内讲座', '区域沙龙', '培训班', '全国会议', '线上会议', '其他'] },
      { key: 'eventDate', label: '计划举办日期', type: 'date', required: true },
      { key: 'department', label: '目标科室', type: 'text', placeholder: '生殖中心 / 生殖科 / 遗传科' },
      { key: 'productName', label: '关联产品', type: 'text', placeholder: 'PGT-A / PGT-SR / PGT-M / NICS等' },
      { key: 'meetingFormat', label: '会议形式', type: 'select', options: ['科室现场会', '线上讲座', '病例讨论', '圆桌交流', '区域联动', '其他'] },
      { key: 'speakerName', label: '主讲人', type: 'text', placeholder: '内部或外部讲者姓名' },
      { key: 'speakerProposalPath', label: '主讲方案/课件路径', type: 'text', placeholder: '上传云盘后粘贴文件路径或共享链接' },
      { key: 'eventObjective', label: '学术目标与商业目标', type: 'textarea', required: true, placeholder: '写清目标客户、产品、观念改变及预期转化' },
      { key: 'preMeetingSales', label: '会前销量（选填）', type: 'number', placeholder: '用于会后效果比较', advanced: true },
      { key: 'budget', label: '预算（元）', type: 'number', placeholder: '0', advanced: true },
    ],
  },
};
