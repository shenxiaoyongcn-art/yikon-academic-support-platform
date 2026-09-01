'use client';

import { useMemo, useState } from 'react';
import { analyticsDataState, medicalLabRows, supportOwnerRows, weakProductRows } from '@/lib/platform/analytics';
import { ReportExportButton } from '@/components/report-export-button';

type Scope = 'product' | 'hospital' | 'owner';

export function AnalyticsDashboard() {
  const [scope, setScope] = useState<Scope>('product');
  const scopeTitle = useMemo(() => ({ product: '按产品识别销量薄弱点', hospital: '按医院定位产品渗透缺口', owner: '按学术支持人员复盘覆盖与转化' })[scope], [scope]);

  return (
    <>
      <section className="analysis-status">
        <div><p className="eyebrow">DATA GOVERNANCE</p><h2>先统一口径，再形成管理判断</h2><p>{analyticsDataState.note}</p></div>
        <span>{analyticsDataState.label}</span>
      </section>

      <section className="analysis-card weak-product-card">
        <div className="card-heading analysis-heading">
          <div><p className="eyebrow">BMP 销量看板</p><h2>{scopeTitle}</h2></div>
          <div className="scope-tabs" aria-label="分析维度">
            <button className={scope === 'product' ? 'active' : ''} onClick={() => setScope('product')}>产品维度</button>
            <button className={scope === 'hospital' ? 'active' : ''} onClick={() => setScope('hospital')}>医院维度</button>
            <button className={scope === 'owner' ? 'active' : ''} onClick={() => setScope('owner')}>人员维度</button>
          </div>
        </div>

        {scope !== 'owner' ? (
          <div className="weak-product-grid">
            {weakProductRows.map((item) => (
              <article key={item.product}>
                <div className="weak-product-title"><strong>{item.product}</strong><span>{item.trend}</span></div>
                <div className="attainment-line"><i style={{ width: `${item.attainment}%` }} /></div>
                <p><b>{item.attainment}%</b> 目标达成率</p>
                <dl><div><dt>重点医院</dt><dd>{item.hospitals}</dd></div><div><dt>责任团队</dt><dd>{item.owner}</dd></div></dl>
                <small>{item.action}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="data-table-wrap analysis-table"><table><thead><tr><th>学术支持人员/组</th><th>覆盖医院</th><th>薄弱产品</th><th>待跟进动作</th><th>关联增长</th><th>推广重点</th></tr></thead><tbody>{supportOwnerRows.map((item) => <tr key={item.owner}><td>{item.owner}</td><td>{item.hospitals}</td><td>{item.weakProducts}</td><td>{item.followUps}</td><td>{item.linkedGrowth}</td><td><span className="table-status">{item.focus}</span></td></tr>)}</tbody></table></div>
        )}
      </section>

      <section className="analysis-card">
        <div className="card-heading analysis-heading">
          <div><p className="eyebrow">医检所运营质量</p><h2>按医院监测关键实验室与报告指标</h2></div>
          <ReportExportButton
            title="医检所运营质量季度汇报"
            subtitle="医院运营指标、异常识别与学术支持行动"
            fileName="医检所运营质量季度汇报"
            summary={[
              { label: '统计医院', value: '待接入', note: '医检所接口' },
              { label: '扩增成功率', value: '按医院', note: '保留样本分母' },
              { label: '结果构成', value: '阳/阴/嵌合', note: '按周期复盘' },
              { label: '异常预警', value: '规则就绪', note: '阈值待医学确认' },
            ]}
            columns={['医院', '统计周期', '扩增成功率', '阳性率', '阴性率', '嵌合率', '判断']}
            rows={medicalLabRows.map((item) => [item.hospital, item.period, item.amplification, item.positive, item.negative, item.mosaic, item.flag])}
            recommendations={['优先复核扩增成功率明显偏低医院的样本质量、实验流程与数据分母。', '嵌合率等结果构成指标仅用于趋势和质量复盘，不直接替代临床医学判断。', '季度汇报必须同时呈现问题、归因、责任人、整改节点和复核结论。']}
          />
        </div>
        <div className="quality-grid">
          {medicalLabRows.map((item) => (
            <article key={item.hospital}>
              <div className="quality-title"><strong>{item.hospital}</strong><span>{item.period}</span></div>
              <div className="quality-metrics"><div><small>扩增成功率</small><b>{item.amplification}</b></div><div><small>阳性率</small><b>{item.positive}</b></div><div><small>阴性率</small><b>{item.negative}</b></div><div><small>嵌合率</small><b>{item.mosaic}</b></div></div>
              <p>{item.flag}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
