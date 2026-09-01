'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import qualificationDirectory from '@/lib/platform/pgd-qualified-centers.json';
import { PgdCenterMaintenance } from '@/components/pgd-center-maintenance';

type QualificationStatus = '申报中的单位' | '筹建中单位' | '试运行评审' | '正式运行';

type QualificationCenter = {
  id: string;
  hospital: string;
  province: string;
  city: string;
  nature: string;
  technology: string;
  trialReviewDate: string | null;
  formalReviewDate: string | null;
  qualificationStatus: QualificationStatus;
  yikonCooperation: string;
  pgtCooperation: string;
  dataQualityNotes: string[];
};

type ProvinceSummary = {
  province: string;
  total: number;
  formal: number;
  trial: number;
  construction: number;
  application: number;
};

type QualificationDirectory = {
  metadata: {
    sourceFile: string;
    dataDate: string;
    uniqueCenters: number;
    provinceCount: number;
    statusSummary: Record<QualificationStatus, number>;
    statusRule: string;
  };
  provinceSummary: ProvinceSummary[];
  centers: QualificationCenter[];
};

type CenterRow = {
  hospitalId: string;
  hospitalName: string;
  province: string;
  stage: string;
  period: string;
  totalCycleCount: number | null;
  pgdCycleCount: number | null;
  conversionBp: number | null;
  updatedAt: number;
};

const directory = qualificationDirectory as QualificationDirectory;
const qualificationStatuses: QualificationStatus[] = ['申报中的单位', '筹建中单位', '试运行评审', '正式运行'];
const firstPageSize = 30;

function cooperationLabel(value: string) {
  if (value === '是') return <span className="cooperation-tag positive">已合作</span>;
  if (value === '否') return <span className="cooperation-tag">未合作</span>;
  return <span className="muted-cell">未登记</span>;
}

function statusClass(status: QualificationStatus) {
  if (status === '正式运行') return 'formal';
  if (status === '试运行评审') return 'trial';
  if (status === '筹建中单位') return 'construction';
  return 'application';
}

export function PgdNationalPanel() {
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [syncState, setSyncState] = useState('正在读取运营数据…');
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('全部省份');
  const [status, setStatus] = useState<'全部阶段' | QualificationStatus>('全部阶段');
  const [showAll, setShowAll] = useState(false);

  const loadCenters = useCallback(async () => {
    try {
      const response = await fetch('/api/pgd-centers');
      if (!response.ok) throw new Error();
      const body = await response.json() as { items?: CenterRow[] };
      const latest = new Map<string, CenterRow>();
      for (const item of body.items || []) if (!latest.has(item.hospitalId)) latest.set(item.hospitalId, item);
      setCenters([...latest.values()]);
      setSyncState(latest.size ? `实时数据 · ${latest.size} 家中心` : '运营数据待维护');
    } catch {
      setSyncState('运营接口待授权');
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadCenters(), 0);
    const timer = window.setInterval(loadCenters, 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadCenters]);

  const filteredCenters = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    return directory.centers.filter((item) => {
      const matchesKeyword = !keyword || [item.hospital, item.province, item.city, item.technology]
        .some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword));
      const matchesProvince = province === '全部省份' || item.province === province;
      const matchesStatus = status === '全部阶段' || item.qualificationStatus === status;
      return matchesKeyword && matchesProvince && matchesStatus;
    });
  }, [province, query, status]);

  const filteredSummary = useMemo(() => ({
    formal: filteredCenters.filter((item) => item.qualificationStatus === '正式运行').length,
    trial: filteredCenters.filter((item) => item.qualificationStatus === '试运行评审').length,
    construction: filteredCenters.filter((item) => item.qualificationStatus === '筹建中单位').length,
    application: filteredCenters.filter((item) => item.qualificationStatus === '申报中的单位').length,
  }), [filteredCenters]);

  const shownCenters = showAll ? filteredCenters : filteredCenters.slice(0, firstPageSize);
  const pendingCenters = directory.metadata.uniqueCenters - directory.metadata.statusSummary['正式运行'];

  const operationalTotals = useMemo(() => {
    const totalCycles = centers.reduce((sum, item) => sum + (item.totalCycleCount || 0), 0);
    const pgdCycles = centers.reduce((sum, item) => sum + (item.pgdCycleCount || 0), 0);
    return { totalCycles, pgdCycles, conversion: totalCycles ? `${((pgdCycles / totalCycles) * 100).toFixed(1)}%` : '待计算' };
  }, [centers]);

  const operationalRows = centers.map((item) => ({
    id: item.hospitalId,
    province: item.province,
    hospital: item.hospitalName,
    stage: item.stage,
    totalCycles: item.totalCycleCount?.toLocaleString('zh-CN') || '—',
    pgdCycles: item.pgdCycleCount?.toLocaleString('zh-CN') || '—',
    conversion: item.conversionBp !== null ? `${(item.conversionBp / 100).toFixed(1)}%` : '待计算',
    updatedAt: new Date(item.updatedAt).toLocaleDateString('zh-CN'),
  }));

  function resetFilters() {
    setQuery('');
    setProvince('全部省份');
    setStatus('全部阶段');
    setShowAll(false);
  }

  return (
    <>
      <section className="analysis-card pgd-directory-card">
        <div className="card-heading analysis-heading">
          <div>
            <p className="eyebrow">全国PGD资质单位目录</p>
            <h2>按省份查询、按资质阶段汇总</h2>
            <p className="heading-note">已整理本地台账截至 {directory.metadata.dataDate} 的数据；原始 {directory.metadata.sourceFile} 保持不变。</p>
          </div>
          <span className="directory-version">数据版本 {directory.metadata.dataDate}</span>
        </div>

        <div className="pgd-national-kpis directory-kpis">
          <article><p>全国PGD相关单位</p><strong>{directory.metadata.uniqueCenters}</strong><small>已合并原表重复单位</small></article>
          <article><p>覆盖省份</p><strong>{directory.metadata.provinceCount}</strong><small>支持省份筛选与汇总</small></article>
          <article><p>正式运行</p><strong>{directory.metadata.statusSummary['正式运行']}</strong><small>含评审时间未登记单位</small></article>
          <article><p>推进中</p><strong>{pendingCenters}</strong><small>申报、筹建及试运行评审</small></article>
        </div>

        <div className="pgd-filter-bar">
          <label className="pgd-search-field">
            <span>查询单位</span>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(false); }} placeholder="输入医院、城市或技术名称" />
          </label>
          <label>
            <span>省份</span>
            <select value={province} onChange={(event) => { setProvince(event.target.value); setShowAll(false); }}>
              <option>全部省份</option>
              {directory.provinceSummary.map((item) => <option key={item.province}>{item.province}</option>)}
            </select>
          </label>
          <label>
            <span>资质阶段</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value as '全部阶段' | QualificationStatus); setShowAll(false); }}>
              <option>全部阶段</option>
              {qualificationStatuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button type="button" onClick={resetFilters}>重置</button>
        </div>

        <div className="filter-result-summary">
          <p>当前结果 <strong>{filteredCenters.length}</strong> 家</p>
          <div><span>正式 {filteredSummary.formal}</span><span>试运行 {filteredSummary.trial}</span><span>筹建 {filteredSummary.construction}</span><span>申报 {filteredSummary.application}</span></div>
        </div>

        <div className="data-table-wrap analysis-table pgd-directory-table">
          <table>
            <thead><tr><th>省份</th><th>城市</th><th>单位名称</th><th>当前资质</th><th>试运行评审时间</th><th>正式运行评审时间</th><th>亿康合作</th><th>PGT合作</th></tr></thead>
            <tbody>
              {shownCenters.map((item) => (
                <tr key={item.id}>
                  <td>{item.province}</td>
                  <td>{item.city || '—'}</td>
                  <td><strong className="hospital-name">{item.hospital}</strong>{item.dataQualityNotes.length > 0 && <small className="quality-warning" title={item.dataQualityNotes.join('；')}>原表信息待复核</small>}</td>
                  <td><span className={`qualification-status ${statusClass(item.qualificationStatus)}`}>{item.qualificationStatus}</span></td>
                  <td>{item.trialReviewDate || '—'}</td>
                  <td>{item.formalReviewDate || (item.qualificationStatus === '正式运行' ? <span className="formal-undated">已正式运行 · 时间未登记</span> : '—')}</td>
                  <td>{cooperationLabel(item.yikonCooperation)}</td>
                  <td>{cooperationLabel(item.pgtCooperation)}</td>
                </tr>
              ))}
              {!shownCenters.length && <tr><td colSpan={8} className="empty-table-cell">未找到符合条件的单位，请调整查询条件。</td></tr>}
            </tbody>
          </table>
        </div>
        {filteredCenters.length > firstPageSize && <button className="directory-more" type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? '收起，仅显示前30家' : `查看全部 ${filteredCenters.length} 家`}</button>}

        <div className="province-summary-heading"><div><p className="eyebrow">省份汇总</p><h3>各省资质单位结构</h3></div><small>点击省份可直接筛选上方名单</small></div>
        <div className="data-table-wrap analysis-table province-summary-table">
          <table>
            <thead><tr><th>省份</th><th>单位合计</th><th>正式运行</th><th>试运行评审</th><th>筹建中</th><th>申报中</th></tr></thead>
            <tbody>{directory.provinceSummary.map((item) => (
              <tr key={item.province} className={province === item.province ? 'active' : ''} onClick={() => { setProvince(item.province); setShowAll(false); }}>
                <td><button type="button" aria-pressed={province === item.province}>{item.province}</button></td><td>{item.total}</td><td>{item.formal}</td><td>{item.trial}</td><td>{item.construction}</td><td>{item.application}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="api-note"><strong>资质判定口径：</strong>{directory.metadata.statusRule} 台账中 2 组重复单位已按最高资质阶段归并，异常日期保留原表口径并标记待复核。</p>
      </section>

      <section className="analysis-card pgd-national-card">
        <div className="card-heading analysis-heading">
          <div><p className="eyebrow">PGD中心运营数据</p><h2>周期数与转化率维护端口</h2><p className="heading-note">{syncState}；已预留 BMP / 医检所同步和运营手工维护入口。</p></div>
          <PgdCenterMaintenance onSaved={loadCenters} />
        </div>
        <div className="pgd-national-kpis"><article><p>已维护中心</p><strong>{centers.length}</strong></article><article><p>正式运营</p><strong>{centers.filter((item) => item.stage === '正式运营').length}</strong></article><article><p>总周期数</p><strong>{centers.length ? operationalTotals.totalCycles.toLocaleString('zh-CN') : '待同步'}</strong></article><article><p>PGD周期转化率</p><strong>{operationalTotals.conversion}</strong></article></div>
        <div className="data-table-wrap analysis-table"><table><thead><tr><th>省份</th><th>中心名单</th><th>当前阶段</th><th>总周期数</th><th>PGD周期数</th><th>转化率</th><th>数据更新时间</th></tr></thead><tbody>{operationalRows.map((item) => <tr key={item.id}><td>{item.province}</td><td>{item.hospital}</td><td>{item.stage}</td><td>{item.totalCycles}</td><td>{item.pgdCycles}</td><td>{item.conversion}</td><td><span className="table-status">{item.updatedAt}</span></td></tr>)}{!operationalRows.length && <tr><td colSpan={7} className="empty-table-cell">尚未维护周期运营数据，可通过右上角入口录入，或等待 BMP / 医检所接口同步。</td></tr>}</tbody></table></div>
        <p className="api-note">运营维护字段：中心主数据、阶段、总周期数、PGD周期数、转化率、数据责任人与更新时间。</p>
      </section>
    </>
  );
}
