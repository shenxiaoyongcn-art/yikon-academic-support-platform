import type { ModuleDefinition } from './types';

export const pgdReviewModule: ModuleDefinition = {
  home: {
    code: '评', name: 'PGT资质评审', source: 'PGT资质台账 / Synology资料索引', state: '真实台账已导入', stateTone: 'teal',
    desc: '覆盖申报、筹建、试运行评审、正式运营及诊疗路径建设。', metric: '5', metricLabel: '全生命周期阶段', tone: 'teal',
  },
  platform: {
    slug: 'pgd-review', short: '评', name: 'PGT资质评审协助', source: 'PGT资质台账（2026-09-01）+ Synology资料索引；BMP待对接', owner: '资质评审专项组',
    objective: '统一管理申报、筹建、试运行评审、正式运营和后续能力建设，并沉淀可行性报告、分平台SOP、模拟病例、诊疗路径、答辩模板、视频、FAQ及专家履历。',
    flow: ['申报中的单位', '筹建中单位', '试运行评审', '正式运营', '遗传咨询培训及诊疗路径梳理'],
    gates: ['申报、筹建、试运行每阶段必须有明确责任人和计划时间', '制度、SOP、记录表单必须三者一致，且SOP必须标记适用测序平台与版本', '专家参与记录和评审资料必须可追溯，正式运营后持续维护遗传咨询能力与诊疗路径'],
    kpis: [
      { label: '全国PGT相关单位', value: '163', note: '已合并原表重复单位' },
      { label: '正式运行', value: '107', note: '含评审时间未登记单位' },
      { label: '推进中单位', value: '56', note: '申报、筹建及试运行评审' },
      { label: '覆盖省份', value: '29', note: '数据截至2026-09-01' },
    ],
    lifecycle: [
      { stage: '申报中的单位', count: '2家', note: '资质申报、资料预审与节点推进' },
      { stage: '筹建中单位', count: '14家', note: '人员、场地、设备、制度与SOP建设' },
      { stage: '试运行评审', count: '40家', note: '试运行数据、模拟评审和问题整改' },
      { stage: '正式运营', count: '107家', note: '质量监测、学科运营和持续改进' },
      { stage: '遗传咨询培训及诊疗路径梳理', count: '待运营维护', note: '咨询能力、个案管理与诊疗流程标准化' },
    ],
    columns: ['单位', '当前阶段', '本阶段完成度', '运营维护：总周期/PGT周期', '项目经理', '下一节点'],
    rows: [
      ['北京某大学医院', '试运行评审', '88%', '待运营维护', '周珊', '整改验收'],
      ['海南某国际医院', '筹建中单位', '73%', '待运营维护', '刘然', '模拟评审'],
      ['云南某妇幼保健院', '申报中的单位', '61%', '待运营维护', '王宁', '申报材料预审'],
    ],
  },
  maintenance: {
    slug: 'pgd-review', dbModule: 'pgd_review', bmpModule: 'pgdReview', recordName: 'PGT评审/筹建单位', titleLabel: '评审协助事项',
    titlePlaceholder: '如：某妇幼 PGT 试运行评审辅导', customerLabel: '申报单位/医院',
    stages: ['申报中的单位', '筹建中单位', '试运行评审', '正式运营', '遗传咨询培训及诊疗路径梳理'], defaultStatus: '推进中',
    fields: [
      { key: 'completeness', label: '本阶段完成度（%）', type: 'number', placeholder: '0-100' },
      { key: 'plannedReviewDate', label: '计划评审日期', type: 'date' },
      { key: 'reviewGap', label: '资料缺口/下一节点', type: 'textarea', placeholder: '制度、SOP、人员、场地、设备或整改事项' },
    ],
  },
};
