'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { Row } from 'exceljs';
import { getMaintenanceConfig, type MaintenanceModuleSlug } from '@/lib/platform/module-maintenance';

type WorkItemRecord = {
  id: string;
  externalId?: string | null;
  customerId?: string | null;
  title: string;
  customerName?: string | null;
  region?: string | null;
  priority: string;
  status: string;
  stage: string;
  dueAt?: number | null;
  source: string;
  verificationStatus?: string;
  ownerName?: string;
  fields: Record<string, unknown>;
  updatedAt: number;
};

type ApiError = { error?: string };

export function ModuleMaintenancePanel({ moduleSlug }: { moduleSlug: MaintenanceModuleSlug }) {
  const config = getMaintenanceConfig(moduleSlug)!;
  const bmpSyncVerified = config.bmpSyncStatus === 'verified';
  const directExcelImport = config.excelImportMode !== 'preview_required';
  const fileInput = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<WorkItemRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'sync' | 'import' | 'export' | 'template' | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadRecords = useCallback(async () => {
    try {
      const response = await fetch(`/api/work-items/${moduleSlug}?limit=200`, { cache: 'no-store' });
      const data = await response.json() as { items?: WorkItemRecord[] } & ApiError;
      if (!response.ok) throw new Error(apiMessage(response.status, data.error));
      setRecords(data.items || []);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '记录加载失败。');
    } finally {
      setLoading(false);
    }
  }, [moduleSlug]);

  useEffect(() => {
    let cancelled = false;
    void requestRecords(moduleSlug)
      .then((items) => {
        if (cancelled) return;
        setRecords(items);
        setError('');
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : '记录加载失败。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [moduleSlug]);

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const record = Object.fromEntries(data.entries());
    setBusy('save');
    setError('');
    setMessage('正在保存…');
    try {
      const response = await fetch(`/api/work-items/${moduleSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'manual', record }),
      });
      const result = await response.json() as { saved?: number } & ApiError;
      if (!response.ok) throw new Error(apiMessage(response.status, result.error));
      form.reset();
      setFormOpen(false);
      setMessage(`${config.recordName}已保存，可在下方台账查看。`);
      await loadRecords();
    } catch (caught) {
      setMessage('');
      setError(caught instanceof Error ? caught.message : '保存失败。');
    } finally {
      setBusy('');
    }
  }

  async function syncBmp() {
    if (!bmpSyncVerified) {
      setError('该模块的 BMP 接口、字段和权限尚未通过 IT 验收，当前不能同步。');
      return;
    }
    setBusy('sync');
    setError('');
    setMessage('正在读取已验收的 BMP 接口…');
    let cursor: string | undefined;
    let total = 0;
    let pages = 0;
    try {
      do {
        const response = await fetch(`/api/bmp/sync/${config.bmpModule}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor }),
        });
        const result = await response.json() as { persisted?: number; nextCursor?: string | null } & ApiError;
        if (!response.ok) throw new Error(apiMessage(response.status, result.error));
        total += result.persisted || 0;
        cursor = result.nextCursor || undefined;
        pages += 1;
      } while (cursor && pages < 20);
      setMessage(`已从验收接口读取并写入 ${total} 条记录${cursor ? '；剩余数据请再次同步' : ''}。请按源系统ID抽样核验。`);
      await loadRecords();
    } catch (caught) {
      setMessage('');
      setError(caught instanceof Error ? caught.message : 'BMP 同步失败。');
    } finally {
      setBusy('');
    }
  }

  async function importExcel(file: File) {
    if (!directExcelImport) {
      setError('该模块需使用专用的 Excel 预览—校验—确认导入流程，通用直写已停用。');
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setBusy('import');
    setError('');
    setMessage('正在读取 Excel 并校验字段…');
    try {
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      await workbook.xlsx.load(new Uint8Array(await file.arrayBuffer()) as never);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('Excel 中没有可读取的工作表。');

      const headerMap = new Map<number, string>();
      worksheet.getRow(1).eachCell((cell, columnNumber) => {
        const key = headerKey(cellText(cell.value), config);
        if (key) headerMap.set(columnNumber, key);
      });
      if (![...headerMap.values()].includes('title')) throw new Error(`Excel 缺少必填表头“${config.titleLabel}”。请先下载模板。`);

      const imported: Array<Record<string, string>> = [];
      for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const record: Record<string, string> = {};
        headerMap.forEach((key, columnNumber) => {
          const fieldType = key === 'dueDate' ? 'date' : config.fields.find((field) => field.key === key)?.type;
          record[key] = cellText(row.getCell(columnNumber).value, fieldType === 'date');
        });
        if (Object.values(record).some(Boolean)) imported.push(record);
      }
      if (!imported.length) throw new Error('Excel 中没有可导入的数据行。');
      if (imported.length > 500) throw new Error('单次最多导入 500 条，请拆分文件后重试。');

      const missingTitleRow = imported.findIndex((record) => !record.title?.trim());
      if (missingTitleRow >= 0) throw new Error(`Excel 第 ${missingTitleRow + 2} 行缺少“${config.titleLabel}”。`);
      for (const field of config.fields.filter((item) => item.required)) {
        const missingRow = imported.findIndex((record) => !record[field.key]?.trim());
        if (missingRow >= 0) throw new Error(`Excel 第 ${missingRow + 2} 行缺少“${field.label}”。`);
      }

      setMessage(`已读取 ${imported.length} 条，正在写入平台…`);
      const response = await fetch(`/api/work-items/${moduleSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'excel', records: imported }),
      });
      const result = await response.json() as { saved?: number } & ApiError;
      if (!response.ok) throw new Error(apiMessage(response.status, result.error));
      setMessage(`Excel 导入完成，共写入 ${result.saved || imported.length} 条记录。`);
      await loadRecords();
    } catch (caught) {
      setMessage('');
      setError(caught instanceof Error ? caught.message : 'Excel 导入失败。');
    } finally {
      setBusy('');
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function exportExcel(templateOnly = false) {
    setBusy(templateOnly ? 'template' : 'export');
    setError('');
    try {
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      workbook.creator = 'Yikon 学术支持管理平台';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet(config.recordName.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
      const columns = excelColumns(config);
      worksheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width }));
      worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
      styleHeader(worksheet.getRow(1));

      if (!templateOnly) {
        for (const record of records) {
          worksheet.addRow({
            externalId: record.externalId || '',
            title: record.title,
            customerName: record.customerName || '',
            region: record.region || '',
            priority: record.priority,
            stage: record.stage,
            status: record.status,
            dueDate: formatDate(record.dueAt),
            ownerName: record.ownerName || '',
            ...record.fields,
          });
        }
      }
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.height = 22;
          row.alignment = { vertical: 'middle', wrapText: true };
        }
      });

      const guide = workbook.addWorksheet('导入说明');
      guide.columns = [{ width: 18 }, { width: 76 }];
      guide.addRows([
        ['使用规则', '请在第一张工作表填写数据，不要修改第一行中文表头。'],
        ['必填字段', `${config.titleLabel}、${config.fields.filter((field) => field.required).map((field) => field.label).join('、') || '无其他必填项'}`],
        ['日期格式', '统一使用 YYYY-MM-DD，例如 2026-09-15。'],
        ['批量上限', '单次最多导入 500 条记录。'],
        ['更新规则', '“外部编号”相同时更新原记录；空白时作为新记录写入。'],
        ['数据边界', '不得导入患者姓名、身份证号、手机号等病例级敏感信息。'],
      ]);
      styleHeader(guide.getRow(1));

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(buffer as BlobPart, `Yikon-${config.recordName}-${templateOnly ? '导入模板' : '台账'}-${today()}.xlsx`);
      setMessage(templateOnly ? 'Excel 导入模板已下载。' : `已导出 ${records.length} 条记录。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Excel 导出失败。');
    } finally {
      setBusy('');
    }
  }

  if (!config) return null;

  return (
    <section className="record-maintenance-card" id="module-maintenance">
      <div className="record-maintenance-heading">
        <div>
          <p className="eyebrow">统一数据入口</p>
          <h2>{config.recordName}维护</h2>
          <p>人工新建、Excel 导入和台账导出在这里完成；BMP 仅在接口契约通过 IT 验收后开放同步。</p>
        </div>
        <span>{loading ? '读取中' : `${records.length} 条平台记录`}</span>
      </div>

      <div className="record-source-actions">
        <button type="button" className="primary" onClick={() => setFormOpen((value) => !value)} disabled={Boolean(busy)}>
          <b>＋</b>{formOpen ? '收起录入' : `新建${config.recordName}`}
        </button>
        <button type="button" onClick={() => void syncBmp()} disabled={Boolean(busy) || !bmpSyncVerified} title={bmpSyncVerified ? '从已验收的BMP模块接口读取' : 'BMP模块接口待IT确认'}><b>↻</b>{busy === 'sync' ? 'BMP 同步中' : bmpSyncVerified ? '从 BMP 拉取' : 'BMP接口待确认'}</button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={Boolean(busy) || !directExcelImport} title={directExcelImport ? '导入标准模板' : '需先完成专用预览导入器'}><b>↑</b>{busy === 'import' ? 'Excel 导入中' : directExcelImport ? 'Excel 批量导入' : '专用导入待完成'}</button>
        <button type="button" onClick={() => void exportExcel(false)} disabled={Boolean(busy)}><b>↓</b>{busy === 'export' ? '正在导出' : '导出当前台账'}</button>
        <button type="button" className="subtle" onClick={() => void exportExcel(true)} disabled={Boolean(busy)}>{busy === 'template' ? '生成中' : '下载导入模板'}</button>
        <input ref={fileInput} className="hidden-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); }} />
      </div>

      {formOpen && (
        <form className="record-entry-form" onSubmit={saveRecord}>
          <label className="wide"><span>{config.titleLabel} *</span><input name="title" required maxLength={200} placeholder={config.titlePlaceholder} /></label>
          <label><span>{config.customerLabel}</span><input name="customerName" maxLength={200} /></label>
          <label><span>省份/区域</span><input name="region" maxLength={80} /></label>
          <label><span>当前阶段</span><select name="stage" defaultValue={config.stages[0]}>{config.stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          {advancedOpen && <>
            <label><span>优先级</span><select name="priority" defaultValue="P2"><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select></label>
            <label><span>当前状态</span><input name="status" defaultValue={config.defaultStatus} maxLength={80} /></label>
            <label><span>计划完成日期</span><input name="dueDate" type="date" /></label>
            <label><span>负责人</span><input name="ownerName" maxLength={80} placeholder="默认当前提交人" /></label>
          </>}
          {config.fields.filter((field) => advancedOpen || !field.advanced).map((field) => (
            <label key={field.key} className={field.type === 'textarea' ? 'wide' : ''}>
              <span>{field.label}{field.required ? ' *' : ''}</span>
              {field.type === 'textarea'
                ? <textarea name={field.key} required={field.required} maxLength={2000} placeholder={field.placeholder} />
                : field.type === 'select'
                  ? <select name={field.key} required={field.required} defaultValue=""><option value="">请选择</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
                  : <input name={field.key} required={field.required} type={field.type} placeholder={field.placeholder} min={field.type === 'number' ? 0 : undefined} />}
            </label>
          ))}
          <div className="record-form-actions"><button type="button" className="advanced-toggle" onClick={() => setAdvancedOpen((value) => !value)}>{advancedOpen ? '收起低频字段' : '更多字段'}</button><button type="button" onClick={() => setFormOpen(false)}>取消</button><button type="submit" className="primary" disabled={busy === 'save'}>{busy === 'save' ? '保存中…' : `提交${config.recordName}`}</button></div>
        </form>
      )}

      {(message || error) && <p className={`record-operation-message${error ? ' error' : ''}`}>{error || message}</p>}

      <div className="record-ledger-wrap">
        <table className="record-ledger">
          <thead><tr><th>{config.titleLabel}</th><th>{config.customerLabel}</th><th>省份/区域</th><th>阶段</th><th>负责人</th><th>数据来源</th><th>更新时间</th></tr></thead>
          <tbody>
            {!loading && records.map((record) => (
              <tr key={record.id}>
                <td><strong>{record.title}</strong><small>{record.priority} · {record.status}</small></td>
                <td>{record.customerName || '—'}<small>{record.customerId ? `BMP ID：${record.customerId}` : record.customerName ? 'BMP ID待映射' : ''}</small></td>
                <td>{record.region || '—'}</td>
                <td><span className="record-stage">{record.stage}</span></td>
                <td>{record.ownerName || '—'}</td>
                <td><span className={`record-source ${record.source}`}>{sourceLabel(record.source, record.verificationStatus)}</span></td>
                <td>{formatDate(record.updatedAt)}</td>
              </tr>
            ))}
            {!loading && !records.length && <tr><td colSpan={7} className="record-empty">暂无平台记录。可先人工新建或使用适用的 Excel 导入；BMP 数据须待模块接口通过 IT 验收后同步。</td></tr>}
            {loading && <tr><td colSpan={7} className="record-empty">正在读取平台记录…</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function excelColumns(config: NonNullable<ReturnType<typeof getMaintenanceConfig>>) {
  return [
    { key: 'externalId', header: '外部编号', width: 20 },
    { key: 'title', header: config.titleLabel, width: 34 },
    { key: 'customerName', header: config.customerLabel, width: 28 },
    { key: 'region', header: '省份/区域', width: 14 },
    { key: 'priority', header: '优先级', width: 10 },
    { key: 'stage', header: '当前阶段', width: 24 },
    { key: 'status', header: '当前状态', width: 14 },
    { key: 'dueDate', header: '计划完成日期', width: 16 },
    { key: 'ownerName', header: '负责人', width: 14 },
    ...config.fields.map((field) => ({ key: field.key, header: field.label, width: field.type === 'textarea' ? 42 : 20 })),
  ];
}

function headerKey(header: string, config: NonNullable<ReturnType<typeof getMaintenanceConfig>>) {
  const aliases: Record<string, string> = {
    外部编号: 'externalId',
    记录标题: 'title',
    [config.titleLabel]: 'title',
    '客户/单位': 'customerName',
    [config.customerLabel]: 'customerName',
    '省份/区域': 'region',
    省份: 'region',
    区域: 'region',
    优先级: 'priority',
    当前阶段: 'stage',
    当前状态: 'status',
    计划完成日期: 'dueDate',
    负责人: 'ownerName',
  };
  for (const field of config.fields) aliases[field.label] = field.key;
  return aliases[header.trim()] || '';
}

function cellText(value: unknown, asDate = false): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value.getTime());
  if (asDate && typeof value === 'number') {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return formatDate(excelEpoch + value * 86_400_000);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (typeof value === 'object') {
    const cell = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
    if (cell.text !== undefined) return String(cell.text).trim();
    if (cell.result !== undefined) return cellText(cell.result, asDate);
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text || '').join('').trim();
  }
  return String(value).trim();
}

function styleHeader(row: Row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA20D7B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
}

function downloadBlob(content: BlobPart, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value?: number | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function today() { return formatDate(Date.now()); }

function sourceLabel(source: string, verificationStatus?: string) {
  const verified = verificationStatus === 'verified';
  if (source === 'bmp') return verified ? 'BMP·已核验' : 'BMP·待核验';
  if (source === 'excel') return verified ? 'Excel·已确认' : 'Excel·未核验';
  if (source === 'manual') return '人工草稿·未核验';
  if (source === 'demo') return '演示数据';
  return '来源待核验';
}

function apiMessage(status: number, serverMessage?: string) {
  if (status === 401) return '请先登录平台后再维护数据。';
  if (status === 403) return '当前账号无 BMP 同步权限；人工新建和 Excel 导入仍可使用。';
  if (status === 501) return '该模块 BMP 接口尚未通过 IT 验收，当前不能同步。';
  return serverMessage || '操作失败，请稍后重试。';
}

async function requestRecords(moduleSlug: MaintenanceModuleSlug) {
  const response = await fetch(`/api/work-items/${moduleSlug}?limit=200`, { cache: 'no-store' });
  const data = await response.json() as { items?: WorkItemRecord[] } & ApiError;
  if (!response.ok) throw new Error(apiMessage(response.status, data.error));
  return data.items || [];
}
