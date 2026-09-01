import { notFound } from 'next/navigation';
import { getPlatformModule, platformModules } from '@/lib/platform/catalog';
import { TenderSearch } from '@/components/tender-search';
import { PlatformSidebar } from '@/components/platform-sidebar';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return platformModules.map((module) => ({ slug: module.slug }));
}

export default async function ModulePage({ params }: Props) {
  const { slug } = await params;
  const module = getPlatformModule(slug);
  if (!module) notFound();

  return (
    <main className="app-shell">
      <PlatformSidebar activeSlug={module.slug} />
      <section className="workspace module-page">
        <header className="module-header">
        <a href="/" className="back-link">← 返回管理总览</a>
        <div className="module-user"><span>学</span>全国学术支持部</div>
        </header>
        <div className="module-container">
        <section className="module-hero">
          <div className="hero-icon">{module.short}</div>
          <div>
            <p className="eyebrow">{module.source}</p>
            <h1>{module.name}</h1>
            <p>{module.objective}</p>
          </div>
          <button className="primary-button">+ 新建记录</button>
        </section>

        <section className="module-kpis">
          {module.kpis.map((item) => <article key={item.label}><p>{item.label}</p><strong>{item.value}</strong><small>{item.note}</small></article>)}
        </section>

        {module.lifecycle && (
          <section className="lifecycle-card">
            <div className="card-heading"><div><p className="eyebrow">PGT中心全生命周期</p><h2>从资质申报到诊疗能力建设</h2></div><span className="owner">数据对接 BMP 后自动统计</span></div>
            <div className="lifecycle-flow">
              {module.lifecycle.map((item, index) => (
                <article key={item.stage}>
                  <span className="lifecycle-index">{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item.stage}</strong>
                  <small>{item.note}</small>
                  <b>{item.count}</b>
                  {index < module.lifecycle!.length - 1 && <i>→</i>}
                </article>
              ))}
            </div>
          </section>
        )}

        {module.slug === 'tender' && <TenderSearch />}

        <section className="process-card">
          <div className="card-heading"><div><p className="eyebrow">标准化流程</p><h2>业务节点与启动门禁</h2></div><span className="owner">责任：{module.owner}</span></div>
          <div className={`process-flow steps-${module.flow.length}`}>
            {module.flow.map((step, index) => <div key={step}><span>{index + 1}</span><strong>{step}</strong>{index < module.flow.length - 1 && <i>→</i>}</div>)}
          </div>
          <div className="gate-list">
            {module.gates.map((gate) => <p key={gate}><span>门禁</span>{gate}</p>)}
          </div>
        </section>

        <section className="data-card">
          <div className="card-heading"><div><p className="eyebrow">当前工作面</p><h2>重点记录</h2></div><div className="table-actions"><button>筛选</button><button>导出</button></div></div>
          <div className="data-table-wrap">
            <table><thead><tr>{module.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{module.rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === row.length - 1 ? <span className="table-status">{cell}</span> : cell}</td>)}</tr>)}</tbody></table>
          </div>
        </section>
        </div>
      </section>
    </main>
  );
}
