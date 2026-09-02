'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CellValue, Row } from 'exceljs';

type Expert = {
  id: string;
  externalId?: string | null;
  name: string;
  organization?: string | null;
  department?: string | null;
  professionalTitle?: string | null;
  province?: string | null;
  city?: string | null;
  specialties: string;
  reviewStages: string;
  sessionCount: number;
  lastReviewAt?: number | null;
  reviewHistory: string[];
  source: string;
  updatedAt: number;
};

const expertColumns = [
  { key: 'externalId', header: '外部编号', width: 20 },
  { key: 'name', header: '专家姓名', width: 14 },
  { key: 'organization', header: '单位', width: 30 },
  { key: 'department', header: '科室', width: 16 },
  { key: 'professionalTitle', header: '职称', width: 14 },
  { key: 'province', header: '省份', width: 12 },
  { key: 'city', header: '城市', width: 12 },
  { key: 'specialties', header: '专业方向', width: 30 },
  { key: 'reviewStages', header: '可参与评审阶段', width: 30 },
  { key: 'sessionCount', header: '历史参与场次', width: 14 },
  { key: 'lastReviewDate', header: '最近参与时间', width: 16 },
  { key: 'reviewHistory', header: '历史评审记录', width: 52 },
];

export function PgtExpertDirectory() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('全部省份');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'import' | 'export' | 'template' | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadExperts = useCallback(async () => {
    try {
      const response = await fetch('/api/pgd-experts', { cache: 'no-store' });
      const body = await response.json() as { items?: Expert[]; error?: string };
      if (!response.ok) throw new Error(body.error || '专家库读取失败。');
      setExperts(body.items || []);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '专家库读取失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/pgd-experts', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { items?: Expert[]; error?: string };
        if (!response.ok) throw new Error(body.error || '专家库读取失败。');
        return body.items || [];
      })
      .then((items) => { if (!cancelled) setExperts(items); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : '专家库读取失败。'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const provinces = useMemo(() => [...new Set(experts.map((item) => item.province).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'zh-CN')), [experts]);
  const filteredExperts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    return experts.filter((expert) => {
      const matchesProvince = province === '全部省份' || expert.province === province;
      const haystack = [expert.name, expert.organization, expert.department, expert.professionalTitle, expert.province, expert.city, expert.specialties, expert.reviewStages, ...expert.reviewHistory]
        .filter(Boolean).join(' ').toLocaleLowerCase('zh-CN');
      return matchesProvince && (!keyword || haystack.includes(keyword));
    });
  }, [experts, province, query]);

  async function importExcel(file: File) {
    setBusy('import'); setError(''); setMessage('正在读取专家库 Excel…');
    try {
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      await workbook.xlsx.load(new Uint8Array(await file.arrayBuffer()) as never);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('Excel 中没有可读取的工作表。');
      const headers = new Map<number, string>();
      worksheet.getRow(1).eachCell((cell, column) => {
        const key = expertColumns.find((item) => item.header === cellText(cell.value))?.key;
        if (key) headers.set(column, key);
      });
      if (![...headers.values()].includes('name')) throw new Error('Excel 缺少“专家姓名”表头，请先下载模板。');
      const records: Array<Record<string, string>> = [];
      for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
        const record: Record<string, string> = {};
        headers.forEach((key, column) => { record[key] = cellText(worksheet.getRow(rowNumber).getCell(column).value, key === 'lastReviewDate'); });
        if (Object.values(record).some(Boolean)) records.push(record);
      }
      if (!records.length) throw new Error('Excel 中没有专家数据。');
      if (records.length > 500) throw new Error('单次最多导入 500 位专家，请拆分文件。');
      const missingName = records.findIndex((record) => !record.name?.trim());
      if (missingName >= 0) throw new Error(`Excel 第 ${missingName + 2} 行缺少专家姓名。`);
      const response = await fetch('/api/pgd-experts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'excel', records }) });
      const result = await response.json() as { saved?: number; error?: string };
      if (!response.ok) throw new Error(result.error || '专家库导入失败。');
      setMessage(`专家库导入完成，共写入 ${result.saved || records.length} 位专家。`);
      await loadExperts();
    } catch (caught) {
      setMessage(''); setError(caught instanceof Error ? caught.message : '专家库导入失败。');
    } finally {
      setBusy(''); if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function exportExcel(templateOnly: boolean) {
    setBusy(templateOnly ? 'template' : 'export'); setError('');
    try {
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet('PGT评审专家库', { views: [{ state: 'frozen', ySplit: 1 }] });
      sheet.columns = expertColumns.map((column) => ({ header: column.header, key: column.key, width: column.width }));
      styleHeader(sheet.getRow(1));
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: expertColumns.length } };
      if (!templateOnly) filteredExperts.forEach((expert) => sheet.addRow({
        ...expert,
        lastReviewDate: formatDate(expert.lastReviewAt),
        reviewHistory: expert.reviewHistory.join('；'),
      }));
      const guide = workbook.addWorksheet('填写说明');
      guide.columns = [{ width: 18 }, { width: 80 }];
      guide.addRows([
        ['必填字段', '专家姓名。外部编号可不填，系统会按姓名、单位和职称自动生成。'],
        ['专业方向', '建议用顿号分隔，例如：生殖医学、遗传学、PGT-M、实验室质量管理。'],
        ['评审阶段', '填写申报、筹建/试运行答辩、试运行转正式运行等可参与阶段。'],
        ['历史评审记录', '多条记录用分号分隔；建议格式：日期｜单位｜评审阶段｜专家角色。'],
        ['数据要求', '只维护工作相关履历，不导入身份证号、手机号等个人敏感信息。'],
      ]);
      styleHeader(guide.getRow(1));
      const buffer = await workbook.xlsx.writeBuffer();
      download(buffer as BlobPart, `Yikon-PGT评审专家库-${templateOnly ? '导入模板' : today()}.xlsx`);
      setMessage(templateOnly ? '专家库导入模板已下载。' : `已导出 ${filteredExperts.length} 位专家。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '专家库 Excel 生成失败。');
    } finally { setBusy(''); }
  }

  return (
    <section className="analysis-card pgt-expert-card">
      <div className="card-heading analysis-heading">
        <div><p className="eyebrow">PGT评审专家库</p><h2>专家履历、参与场次与历史评审可检索</h2><p className="heading-note">按姓名、单位、专业方向、地区及历史评审项目查询；支持 Excel 批量导入和导出。</p></div>
        <span className="directory-version">{loading ? '读取中' : `${experts.length} 位专家`}</span>
      </div>
      <div className="expert-toolbar">
        <label className="expert-search"><span>搜索专家或历史评审</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="姓名、单位、专业、评审医院或场次" /></label>
        <label><span>地区</span><select value={province} onChange={(event) => setProvince(event.target.value)}><option>全部省份</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={Boolean(busy)}>{busy === 'import' ? '导入中…' : 'Excel导入'}</button>
        <button type="button" onClick={() => void exportExcel(false)} disabled={Boolean(busy)}>{busy === 'export' ? '导出中…' : '导出结果'}</button>
        <button type="button" className="subtle" onClick={() => void exportExcel(true)} disabled={Boolean(busy)}>{busy === 'template' ? '生成中…' : '下载模板'}</button>
        <input ref={fileInput} className="hidden-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); }} />
      </div>
      {(message || error) && <p className={`record-operation-message${error ? ' error' : ''}`}>{error || message}</p>}
      <div className="expert-result-summary">当前结果 <strong>{filteredExperts.length}</strong> 位；累计参与评审/培训 <strong>{filteredExperts.reduce((sum, item) => sum + item.sessionCount, 0)}</strong> 场</div>
      <div className="data-table-wrap analysis-table expert-table">
        <table><thead><tr><th>专家</th><th>单位/科室</th><th>地区</th><th>专业方向</th><th>可参与阶段</th><th>历史场次</th><th>最近参与</th><th>历史评审记录</th></tr></thead>
          <tbody>
            {filteredExperts.map((expert) => <tr key={expert.id}>
              <td><strong className="expert-name">{expert.name}</strong><small>{expert.professionalTitle || '职称未登记'}</small></td>
              <td>{expert.organization || '—'}<small>{expert.department || ''}</small></td>
              <td>{[expert.province, expert.city].filter(Boolean).join(' ') || '—'}</td>
              <td>{expert.specialties || '—'}</td>
              <td>{expert.reviewStages || '—'}</td>
              <td><span className="expert-session-count">{expert.sessionCount}</span></td>
              <td>{formatDate(expert.lastReviewAt) || '—'}</td>
              <td className="expert-history" title={expert.reviewHistory.join('；')}>{expert.reviewHistory.slice(0, 2).join('；') || '—'}</td>
            </tr>)}
            {!loading && !filteredExperts.length && <tr><td colSpan={8} className="empty-table-cell">专家库暂无数据。请下载模板整理历史专家及评审记录后批量导入。</td></tr>}
            {loading && <tr><td colSpan={8} className="empty-table-cell">正在读取专家库…</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function cellText(value: CellValue | undefined, asDate = false): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value.getTime());
  if (asDate && typeof value === 'number') return formatDate(Date.UTC(1899, 11, 30) + value * 86_400_000);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if ('text' in value) return String(value.text || '').trim();
  if ('result' in value) return cellText(value.result, asDate);
  if ('richText' in value) return value.richText.map((item) => item.text).join('').trim();
  return '';
}

function styleHeader(row: Row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF168777' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
}

function formatDate(value?: number | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function today() { return formatDate(Date.now()); }

function download(content: BlobPart, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
