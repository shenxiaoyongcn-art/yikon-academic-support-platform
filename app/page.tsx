import Link from 'next/link';
import { PlatformSidebar } from '@/components/platform-sidebar';
import { BmpLoginControl, UiScaleControl } from '@/components/platform-controls';
import { AiPlatformOverview } from '@/components/ai-platform-overview';
import { homeModules, platformModules } from '@/lib/platform/catalog';
import { getActor } from '@/lib/security/access';

export const dynamic = 'force-dynamic';

const moduleSlugs = platformModules.map((module) => module.slug);
const modules = homeModules;

const priorities = [
  ['P0', '核验BMP现存流程、对象ID与接口字典', 'IT / BMP负责人 / 学术', '待会签', '/modules/research'],
  ['P0', '科研历史数据只读迁移与新流程映射', 'IT / 学术PMO', '待联调', '/modules/research'],
  ['P1', '会议与KOL真实Excel专用导入预览', '学术运营 / IT', '待开发', '/modules/events'],
];

export default async function Home() {
  const actor = await getActor();
  const displayName = actor?.displayName || '学术支持总监';

  return (
    <main className="app-shell">
      <PlatformSidebar activeSlug="overview" />
      <section className="workspace" id="overview">
        <header className="topbar">
          <div className="search-box">
            <span>⌕</span>
            <input aria-label="全局搜索" placeholder="搜索项目、医院、招标参数、售后问题…" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <UiScaleControl />
            <BmpLoginControl />
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
              <p className="eyebrow">管理总览 <span>/</span> 2026年9月5日</p>
              <h1>把事务支持，变成可量化的客户价值。</h1>
              <p>当前重点：先确认系统边界和真实接口，再形成统一、可追溯的经营数据。</p>
            </div>
            <Link className="primary-button" href="/modules/research"><span>+</span> 新建科研需求</Link>
          </section>

          <section className="kpi-grid" aria-label="核心指标">
            <article><p>本月价值任务</p><strong>待统计</strong><small>以平台真实台账为准</small></article>
            <article><p>执行中科研项目</p><strong>待迁移</strong><small>BMP历史项目须保留源ID并去重</small></article>
            <article><p>待闭环问题</p><strong>待导入</strong><small>SLA口径与真实工单尚待确认</small></article>
            <article><p>客户价值转化</p><strong>待计算</strong><small>BMP销量、会议与项目映射后生成</small></article>
          </section>

          <section className="focus-grid">
            <article className="focus-card priority-card">
              <div className="card-heading">
                <div><p className="eyebrow">今日经营焦点</p><h2>优先处理与管理协同</h2></div>
                <a href="#tasks">查看全部 ↗</a>
              </div>
              <div className="priority-list" id="tasks">
                {priorities.map(([level, title, owner, due, href]) => (
                  <div className="priority-item" key={title}>
                    <span className={`level ${level === 'P0' ? 'critical' : ''}`}>{level}</span>
                    <div><strong>{title}</strong><small>{owner}</small></div>
                    <time>{due}</time><Link href={href} aria-label={`打开${title}`}>→</Link>
                  </div>
                ))}
              </div>
            </article>

            <article className="focus-card value-card">
              <div className="card-heading compact"><div><p className="eyebrow">客户深度绑定</p><h2>价值转化漏斗</h2></div><span className="period">本季度 ⌄</span></div>
              <div className="funnel">
                <div><span style={{ width: '100%' }} /><strong>—</strong><small>学术需求</small></div>
                <div><span style={{ width: '76%' }} /><strong>—</strong><small>有效立项</small></div>
                <div><span style={{ width: '52%' }} /><strong>—</strong><small>深度合作</small></div>
                <div><span style={{ width: '32%' }} /><strong>—</strong><small>业绩转化</small></div>
              </div>
              <p className="insight"><span>↗</span><b>统计原则</b>未关联客户ID、项目ID和BMP销量事实前，不生成转化率结论。</p>
            </article>
          </section>

          <AiPlatformOverview />

          <section className="module-section">
            <div className="section-heading">
              <div><p className="eyebrow">核心能力地图</p><h2>八大学术业务底座</h2></div>
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
      </section>
    </main>
  );
}
