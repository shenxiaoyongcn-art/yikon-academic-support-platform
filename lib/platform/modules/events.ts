import type { ModuleDefinition } from './types';

export const eventsModule: ModuleDefinition = {
  home: {
    code: '会', name: '推广会议', source: '会议规划表 / 部门台账；BMP销量待对接', state: '真实数据待导入', stateTone: 'amber',
    desc: '会前目标、现场达成、会后商机与销量转化统一复盘。', metric: '35', metricLabel: '总表候选记录，待导入确认', tone: 'orange',
  },
  platform: {
    slug: 'events', short: '会', name: '推广会议与效果复盘', source: '会议规划表 + 部门台账；BMP销量接口待确认', owner: '区域学术经理',
    objective: '会议不按场次论英雄，按客户层级、学术观念改变和商业转化评价。',
    flow: ['会前目标', '客户与讲者', '内容审核', '会议执行', '7/30/90日跟进', '商机销量复盘'],
    gates: ['未明确目标客户和商业目标不立项', '超预算必须升级审批', '会后30日无跟进记录不计有效会议'],
    kpis: [
      { label: '会议规划总表', value: '35', note: '候选记录，需预览确认后导入' },
      { label: 'KOL总表', value: '204', note: '候选成员，需去重并确认标签' },
      { label: '已落地会议', value: '待导入', note: '不得以规划记录代替实际召开' },
      { label: '销量转化', value: '待接入', note: '以BMP官方销量口径为准' },
    ],
    columns: ['待接数据集', '来源', '候选记录', '导入规则', '接口状态', '下一步'],
    rows: [
      ['2026年会议规划', 'Excel总表', '35', '预览、校验、确认后写入', '尚未导入', '确认字段映射'],
      ['产品KOL与优秀讲者', 'Excel总表', '204', '姓名去重、保留来源行', '尚未导入', '确认标签口径'],
      ['会议销量效果', 'BMP销量', '—', '医院×产品×月份', '接口待确认', 'IT提供接口契约'],
    ],
  },
  maintenance: {
    slug: 'events', dbModule: 'events', bmpModule: 'events', recordName: '学术讲座申请', titleLabel: '会议/讲座名称',
    titlePlaceholder: '如：PGT-M 家系单体型实战讲座', customerLabel: '目标医院/客户（待BMP映射）',
    stages: ['部门申请草稿', '方案核验', '会前筹备', '会议执行', '7/30/90日跟进', '效果复盘', '公司流程回执关联'], defaultStatus: '部门草稿',
    bmpSyncStatus: 'pending', excelImportMode: 'preview_required',
    fields: [
      { key: 'eventType', label: '会议类型', type: 'select', options: ['科室会', '院内讲座', '区域沙龙', '培训班', '全国会议', '线上会议', '其他'] },
      { key: 'eventDate', label: '计划举办日期', type: 'date', required: true },
      { key: 'department', label: '目标科室', type: 'text', placeholder: '生殖中心 / 生殖科 / 遗传科' },
      { key: 'productName', label: '关联产品', type: 'text', placeholder: 'PGT-A / PGT-SR / PGT-M / NICS等' },
      { key: 'meetingFormat', label: '会议形式', type: 'select', options: ['科室现场会', '线上讲座', '病例讨论', '圆桌交流', '区域联动', '其他'] },
      { key: 'speakerName', label: '主讲人', type: 'text', placeholder: '内部或外部讲者姓名' },
      { key: 'speakerProposalPath', label: '主讲方案/课件路径', type: 'text', placeholder: '上传云盘后粘贴文件路径或共享链接' },
      { key: 'eventObjective', label: '学术目标与商业目标', type: 'textarea', required: true, placeholder: '写清目标客户、产品、观念改变及预期转化' },
      { key: 'bmpCustomerIdCandidate', label: 'BMP医院/客户编号（候选）', type: 'text', placeholder: '接口未接通时可暂存候选编号；手填默认未核验', advanced: true },
      { key: 'bmpSalesSnapshotId', label: 'BMP销量快照/报表编号（待核验）', type: 'text', placeholder: '只登记BMP报表ID和统计周期；手填不作为已关联', advanced: true },
      { key: 'bmpBudgetReceiptId', label: 'BMP预算包/审批回执编号（待核验）', type: 'text', placeholder: '正式预算与审批以BMP回执核验结果为准', advanced: true },
    ],
  },
};
