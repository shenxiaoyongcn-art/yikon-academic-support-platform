import { getChatGPTUser } from './chatgpt-auth';

export const dynamic = 'force-dynamic';

const moduleSlugs = ['tender', 'research', 'aftersales', 'events', 'pgd-review', 'training'];

const modules = [
  {
    code: '标',
    name: '招标中心',
    source: 'Synology 云盘',
    state: 'API已确认',
    stateTone: 'teal',
    desc: '参数抽取、证据定位、资质有效期与技术应答一体化。',
    metric: '4,826',
    metricLabel: '已索引材料',
    tone: 'magenta',
  },
  {
    code: '研',
    name: '科研项目',
    source: 'BMP / CRM',
    state: '数据底座已就绪',
    stateTone: 'teal',
    desc: '从需求评估、立项审批到里程碑、验收和成果转化。',
    metric: '157',
    metricLabel: '执行中 / 待执行',
    tone: 'violet',
  },
  {
    code: '售',
    name: '售后闭环',
    source: 'BMP / CRM',
    state: '接口待对接',
    stateTone: 'blue',
    desc: '统一受理、多部门协同、SLA预警、根因归类与闭环复盘。',
    metric: '93.6%',
    metricLabel: 'SLA达成率',
    tone: 'blue',
  },
  {
    code: '会',
    name: '推广会议',
    source: 'BMP / 销售数据',
    state: '规则待确认',
    stateTone: 'amber',
    desc: '会前目标、现场达成、会后商机与销量转化统一复盘。',
    metric: '26',
    metricLabel: '本季度已落地',
    tone: 'orange',
  },
  {
    code: '评',
    name: 'PGD资质评审',
    source: 'BMP / 文档库',
    state: '模板已设计',
    stateTone: 'teal',
    desc: '覆盖申报、筹建、试运行评审、正式运营及诊疗路径建设。',
    metric: '5',
    metricLabel: '全生命周期阶段',
    tone: 'teal',
  },
  {
    code: '训',
    name: '遗传咨询培训',
    source: 'BMP / 课程库',
    state: '课程待迁移',
    stateTone: 'blue',
    desc: '课程、考试、能力地图、个案实训与客户人才体系搭建。',
    metric: '72%',
    metricLabel: '年度学习达成',
    tone: 'indigo',
  },
];

const priorities = [
  ['P0', '科研立项增加“项目评估”前置门禁', '产品 / 研发 / 学术', '今天'],
  ['P0', '招标资料库权限映射与文件索引', 'IT / 学术', '09-03'],
  ['P1', '售后SLA分级及超时升级规则确认', '学术 / 产品', '09-05'],
];

export default async function Home() {
  const user = await getChatGPTUser();
  const displayName = user?.fullName || '学术支持总监';

  return (
    <div id="overview">
        <header className="topbar">
          <div className="search-box">
            <span>⌕</span>
            <input aria-label="全局搜索" placeholder="搜索项目、医院、招标参数、售后问题…" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="通知">○<span /></button>
            <button className="user-chip">
              <span className="avatar">{displayName.slice(0, 1)}</span>
              <span><strong>{displayName}</strong><small>全国学术支持部</small></span>
              <i>⌄</i>
            </button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">管理总览 <span>/</span> 2026年9月1日</p>
              <h1>把事务支持，变成可量化的客户价值。</h1>
              <p>今日聚焦：项目门禁、超时闭环、内网资料库连通。</p>
            </div>
            <button className="primary-button"><span>+</span> 新建学术任务</button>
          </section>

          <section className="kpi-grid" aria-label="核心指标">
            <article><p>本月价值任务</p><strong>43</strong><small><em>+12.5%</em> 环比</small></article>
            <article><p>执行中科研项目</p><strong>157</strong><small>512 条台账待主子项目清洗</small></article>
            <article><p>待闭环问题</p><strong>18</strong><small><em className="warn">7 项</em> 距SLA小于24小时</small></article>
            <article><p>客户价值转化</p><strong>68.4%</strong><small><em>+6.2%</em> 近三个月</small></article>
          </section>

          <section className="focus-grid">
            <article className="focus-card priority-card">
              <div className="card-heading">
                <div><p className="eyebrow">今日经营焦点</p><h2>优先处理与管理协同</h2></div>
                <a href="#tasks">查看全部 ↗</a>
              </div>
              <div className="priority-list" id="tasks">
                {priorities.map(([level, title, owner, due]) => (
                  <div className="priority-item" key={title}>
                    <span className={`level ${level === 'P0' ? 'critical' : ''}`}>{level}</span>
                    <div><strong>{title}</strong><small>{owner}</small></div>
                    <time>{due}</time><button aria-label={`打开${title}`}>→</button>
                  </div>
                ))}
              </div>
            </article>

            <article className="focus-card value-card">
              <div className="card-heading compact"><div><p className="eyebrow">客户深度绑定</p><h2>价值转化漏斗</h2></div><span className="period">本季度 ⌄</span></div>
              <div className="funnel">
                <div><span style={{ width: '100%' }} /><strong>126</strong><small>学术需求</small></div>
                <div><span style={{ width: '76%' }} /><strong>96</strong><small>有效立项</small></div>
                <div><span style={{ width: '52%' }} /><strong>66</strong><small>深度合作</small></div>
                <div><span style={{ width: '32%' }} /><strong>41</strong><small>业绩转化</small></div>
              </div>
              <p className="insight"><span>↗</span><b>核心判断</b>学术动作必须关联客户、商机与销量，否则只是记录工作量。</p>
            </article>
          </section>

          <section className="module-section">
            <div className="section-heading">
              <div><p className="eyebrow">核心能力地图</p><h2>六大学术业务底座</h2></div>
              <div className="legend"><span><i className="ok" />可用</span><span><i />待对接</span></div>
            </div>
            <div className="module-grid">
              {modules.map((module, index) => (
                <article className={`module-card ${module.tone}`} id={`module-${index + 1}`} key={module.name}>
                  <div className="module-top"><span className="module-icon">{module.code}</span><span className={`state ${module.stateTone}`}>{module.state}</span></div>
                  <h3>{module.name}</h3><p className="source">{module.source}</p><p className="module-desc">{module.desc}</p>
                  <div className="module-foot"><div><strong>{module.metric}</strong><small>{module.metricLabel}</small></div><a className="module-open" href={`/modules/${moduleSlugs[index]}`} aria-label={`进入${module.name}`}>↗</a></div>
                </article>
              ))}
            </div>
          </section>
        </div>
    </div>
  );
}
