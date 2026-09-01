'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pgdCenterRows } from '@/lib/platform/analytics';
import { PgdCenterMaintenance } from '@/components/pgd-center-maintenance';

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

export function PgdNationalPanel() {
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [syncState, setSyncState] = useState('正在读取运营数据…');

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
    void loadCenters();
    const timer = window.setInterval(loadCenters, 60_000);
    return () => window.clearInterval(timer);
  }, [loadCenters]);

  const totals = useMemo(() => {
    const totalCycles = centers.reduce((sum, item) => sum + (item.totalCycleCount || 0), 0);
    const pgdCycles = centers.reduce((sum, item) => sum + (item.pgdCycleCount || 0), 0);
    return { totalCycles, pgdCycles, conversion: totalCycles ? `${((pgdCycles / totalCycles) * 100).toFixed(1)}%` : '待计算' };
  }, [centers]);

  const displayRows = centers.length ? centers.map((item) => ({
    province: item.province,
    hospital: item.hospitalName,
    stage: item.stage,
    totalCycles: item.totalCycleCount?.toLocaleString('zh-CN') || '—',
    pgdCycles: item.pgdCycleCount?.toLocaleString('zh-CN') || '—',
    conversion: item.conversionBp !== null ? `${(item.conversionBp / 100).toFixed(1)}%` : '待计算',
    updatedAt: new Date(item.updatedAt).toLocaleDateString('zh-CN'),
  })) : pgdCenterRows;

  return (
    <section className="analysis-card pgd-national-card">
      <div className="card-heading analysis-heading">
        <div><p className="eyebrow">全国PGD中心地图底座</p><h2>中心数量、名单与运营效率统一维护</h2><p className="heading-note">{syncState}；名单支持运营维护和 BMP 同步，周期数据按月沉淀。</p></div>
        <PgdCenterMaintenance onSaved={loadCenters} />
      </div>
      <div className="pgd-national-kpis"><article><p>全国中心总数</p><strong>{centers.length || '待运营维护'}</strong></article><article><p>正式运营</p><strong>{centers.length ? centers.filter((item) => item.stage === '正式运营').length : '待同步'}</strong></article><article><p>总周期数</p><strong>{centers.length ? totals.totalCycles.toLocaleString('zh-CN') : '待医检所/BMP同步'}</strong></article><article><p>PGD周期转化率</p><strong>{totals.conversion}</strong></article></div>
      <div className="data-table-wrap analysis-table"><table><thead><tr><th>省份</th><th>中心名单</th><th>当前阶段</th><th>总周期数</th><th>PGD周期数</th><th>转化率</th><th>数据更新时间</th></tr></thead><tbody>{displayRows.map((item) => <tr key={item.hospital}><td>{item.province}</td><td>{item.hospital}</td><td>{item.stage}</td><td>{item.totalCycles}</td><td>{item.pgdCycles}</td><td>{item.conversion}</td><td><span className="table-status">{item.updatedAt}</span></td></tr>)}</tbody></table></div>
      <p className="api-note">已预留运营维护接口：中心主数据、阶段、总周期数、PGD周期数、转化率、数据责任人与更新时间。</p>
    </section>
  );
}
