import type { ModuleDefinition } from './types';

export const trainingModule: ModuleDefinition = {
  home: {
    code: '训', name: '遗传咨询培训', source: '平台培训台账 / 课程资料索引；BMP接口待确认', state: '课程待迁移', stateTone: 'blue',
    desc: '课程、考试、能力地图、个案实训与客户人才体系搭建。', metric: '待导入', metricLabel: '真实培训台账', tone: 'indigo',
  },
  platform: {
    slug: 'training', short: '训', name: '遗传咨询培训', source: '平台培训台账 + 课程/题库/个案资料索引；BMP接口待确认', owner: '遗传咨询培训组',
    objective: '对客户的一次性授课，升级为可测评、可认证、可持续运转的人才体系。',
    flow: ['能力测评', '学习路径', '课程学习', '个案实训', '考核认证', '能力复评'],
    gates: ['课程必须区分PGT-A/PGT-SR/PGT-M/CNV能力层级', '个案实训必须去标识化', '通过率与临床应用率同时评价'],
    kpis: [
      { label: '在学人数', value: '待导入', note: '按医院与学员去重' },
      { label: '课程完成率', value: '待统计', note: '按年度学习路径' },
      { label: '考核通过率', value: '待统计', note: '区分首次与补考' },
      { label: '活跃个案组', value: '待维护', note: '仅使用去标识化病例' },
    ],
    columns: ['中心', '培训路径', '在学', '完成率', '导师', '下次考核'],
    rows: [['待导入医院', '真实培训台账', '—', '待统计', '待分配', '待排期']],
  },
  maintenance: {
    slug: 'training', dbModule: 'training', bmpModule: 'training', recordName: '遗传咨询培训需求', titleLabel: '培训需求名称',
    titlePlaceholder: '如：某中心 PGT-M 遗传咨询进阶培训', customerLabel: '需求医院/中心',
    stages: ['需求登记', '能力测评', '课程规划', '培训执行', '考核认证', '能力复评'], defaultStatus: '待评估',
    fields: [
      { key: 'learningPath', label: '培训路径', type: 'select', options: ['生殖遗传基础', 'PGT-A', 'PGT-SR', 'PGT-M', 'CNV与结构变异', '个案实训'] },
      { key: 'traineeCount', label: '计划培训人数', type: 'number', placeholder: '0' },
      { key: 'trainingObjective', label: '能力目标与需求说明', type: 'textarea', required: true },
    ],
  },
};
