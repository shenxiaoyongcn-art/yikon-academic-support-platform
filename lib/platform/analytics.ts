export const analyticsDataState = {
  label: '界面示例数据',
  note: '真实结果需完成 BMP、医检所接口及医院/人员主数据映射后生成。',
};

export const weakProductRows = [
  { product: 'PGT-SR', attainment: 62, trend: '-11.8%', hospitals: '华南A医院等 6 家', owner: '华南学术组', action: '优先梳理适应证认知与转诊路径' },
  { product: '携带者筛查', attainment: 68, trend: '-6.4%', hospitals: '华东B医院等 9 家', owner: '华东学术组', action: '联合遗传咨询培训推动门诊转化' },
  { product: 'NICS', attainment: 74, trend: '+1.6%', hospitals: '西南C医院等 4 家', owner: '西南学术组', action: '复盘检测路径与临床证据触达' },
  { product: 'PGT-M', attainment: 81, trend: '+4.2%', hospitals: '华中D医院等 3 家', owner: '华中学术组', action: '聚焦家系评估与疑难病例会诊' },
];

export const medicalLabRows = [
  { hospital: '华南A医院', period: '2026 Q2示例', amplification: '97.8%', positive: '41.6%', negative: '49.2%', mosaic: '9.2%', flag: '扩增稳定' },
  { hospital: '华东B医院', period: '2026 Q2示例', amplification: '95.1%', positive: '38.4%', negative: '48.7%', mosaic: '12.9%', flag: '嵌合率关注' },
  { hospital: '西南C医院', period: '2026 Q2示例', amplification: '92.6%', positive: '44.8%', negative: '46.9%', mosaic: '8.3%', flag: '扩增率关注' },
];

export const supportOwnerRows = [
  { owner: '华南学术组', hospitals: '18', weakProducts: '2', followUps: '7', linkedGrowth: '待BMP同步', focus: 'PGT-SR、携带者筛查' },
  { owner: '华东学术组', hospitals: '21', weakProducts: '3', followUps: '9', linkedGrowth: '待BMP同步', focus: '携带者筛查、PGT-M' },
  { owner: '西南学术组', hospitals: '15', weakProducts: '2', followUps: '5', linkedGrowth: '待BMP同步', focus: 'NICS、PGT-A' },
];

export const researchRoiRows = [
  { hospital: '华南A医院', projects: '5', labor: '386h', cashCost: '18.6万', outputs: '论文2/专利1', linkedValue: '待BMP归因', decision: '重点维持' },
  { hospital: '华东B医院', projects: '4', labor: '292h', cashCost: '13.2万', outputs: '论文1/会议2', linkedValue: '待BMP归因', decision: '控制新增投入' },
  { hospital: '西南C医院', projects: '3', labor: '164h', cashCost: '7.8万', outputs: '在研3', linkedValue: '待BMP归因', decision: '里程碑复核' },
];

export const pgdCenterRows = [
  { province: '广东', hospital: '华南A医院', stage: '正式运营', totalCycles: '待维护', pgdCycles: '待维护', conversion: '待计算', updatedAt: '—' },
  { province: '江苏', hospital: '华东B医院', stage: '试运行评审', totalCycles: '待维护', pgdCycles: '待维护', conversion: '待计算', updatedAt: '—' },
  { province: '四川', hospital: '西南C医院', stage: '筹建中单位', totalCycles: '待维护', pgdCycles: '待维护', conversion: '待计算', updatedAt: '—' },
];
