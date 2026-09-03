'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { BmpLoginControl, UiScaleControl } from '@/components/platform-controls';
import { ResearchRoiPanel } from '@/components/research-roi-panel';
import { businessChain, documentNames } from '@/lib/research/chain';
import { demandFields, fieldsFor, routeStages, steps } from '@/lib/research/definition';
import { demoActor, demoBudgets, demoCustomers, demoData, demoPolicy, initialDemoCases } from '@/lib/research/demo';
import { available, money, roleNames, routeNames, totalCost, type Actor, type Budget, type Case, type Command, type Data, type DocumentKind, type Field, type History, type Role, type Route } from '@/lib/research/model';
import { alerts, batchEligible, canAct, isManager, newCase, transition } from '@/lib/research/workflow';
import './research-workspace.css';

type Item = Case & { canAct?: boolean; showMoney?: boolean; alerts?: string[]; batchEligible?: boolean };
type Customer = { id: string; name: string; region: string };
type Audit = History & { snapshot?: Case };
type ImportRow = { id: string; route: Route; data: Data; saved?: boolean; error?: string };
type ApiResult = { error?: string; items: Item[]; item: Item; actor: Actor; budgets: Budget[]; customers: Customer[]; history: Audit[]; results: { id: string; ok: boolean; message?: string }[] };
const actionNames: Record<string, string> = { create: '新建需求', save: '保存', advance: '同意 / 提交下一环节', return: '退回', reject: '拒绝', reserve: '储备', resubmit: '重新提交', pause: '暂停 / 等待', resume: '恢复', change: '发起变更', submit_milestone: '提交节点交付', accept_milestone: '节点验收', terminate: '申请终止', archive: '归档', submit_document: '提交关联申请', review_document: '审核关联申请' };
function dateTime(time: number) { return new Date(time).toLocaleString('zh-CN'); }
function EvidenceLink({ value }: { value: string }) {
  let url = '';
  try { const parsed = new URL(value); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) url = parsed.toString(); } catch { /* NAS paths are references, not invented share links. */ }
  return url ? <a href={url} target="_blank" rel="noopener noreferrer">打开关联资料 ↗</a> : <span>{value || '按权限显示'}</span>;
}
function cost(c: Case) { try { return money(totalCost(c.data)); } catch { return '待评估'; } }
function csvCell(value: unknown) { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; }
function download(name: string, text: string, type = 'text/csv;charset=utf-8') { const url = URL.createObjectURL(new Blob([type.startsWith('text/csv') ? '\uFEFF' : '', text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
async function callApi(body?: Record<string, unknown>, query = '') {
  const response = await fetch(`/api/research${query}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const result = await response.json() as ApiResult;
  if (!response.ok) throw new Error(result.error || '服务暂不可用');
  return result;
}

export function ResearchWorkspace() {
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [demoItems, setDemoItems] = useState<Case[]>(initialDemoCases);
  const [liveItems, setLiveItems] = useState<Item[]>([]);
  const [role, setRole] = useState<Role>('applicant');
  const [liveActor, setLiveActor] = useState<Actor | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>(demoBudgets);
  const [liveBudgets, setLiveBudgets] = useState<Budget[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState('demo-A');
  const [tab, setTab] = useState('work');
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState('all');
  const [month, setMonth] = useState('');
  const [channel, setChannel] = useState('all');
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [demoHistory, setDemoHistory] = useState<Record<string, Audit[]>>({});
  const [liveHistory, setLiveHistory] = useState<Audit[]>([]);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [newRoute, setNewRoute] = useState<Route>('A');
  const actor = mode === 'demo' ? demoActor(role) : liveActor;
  const items = mode === 'demo' ? demoItems : liveItems;
  const budgetRows = mode === 'demo' ? budgets : liveBudgets;
  const customerRows = mode === 'demo' ? demoCustomers : customers;
  const current = items.find(c => c.id === selected);
  const filtered = items.filter(c => (!query || `${c.requestNo} ${c.projectNo || ''} ${c.data.title} ${c.data.hospital} ${c.data.managerEmail || c.creatorEmail}`.toLowerCase().includes(query.toLowerCase())) && (route === 'all' || c.route === route) && (!month || c.data.targetMonth === month) && (channel === 'all' || c.data.channel === channel) && (!onlyTodo || Boolean(actor && canAct(c, actor))));
  const canBudget = actor?.roles.includes('budget');
  const showMoney = mode === 'demo' || Boolean(actor?.roles.some(r => ['budget', 'finance', 'regional', 'marketing', 'executive'].includes(r)));

  async function loadLive() {
    const result = await callApi(); setLiveItems(result.items); setLiveActor(result.actor); setLiveBudgets(result.budgets); setCustomers(result.customers);
    return result.items as Item[];
  }
  async function chooseMode(next: 'demo' | 'live') {
    setMode(next); setMessage(''); setBatchIds([]); setImports([]); setLiveHistory([]);
    if (next === 'demo') { setSelected(demoItems[0]?.id || ''); return; }
    setBusy(true); setSelected('');
    try { const list = await loadLive(); setSelected(list[0]?.id || ''); }
    catch (error) { setLiveActor(null); setLiveItems([]); setLiveBudgets([]); setCustomers([]); setMessage(error instanceof Error ? error.message : '读取失败'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (mode !== 'live' || !selected) return;
    let active = true;
    callApi(undefined, `?id=${encodeURIComponent(selected)}`).then(result => { if (active) setLiveHistory(result.history); }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [mode, selected, liveItems]);

  async function run(id: string, command: Omit<Command, 'expectedRevision'>) {
    const previous = items.find(c => c.id === id); if (!previous || !actor) return;
    setBusy(true); setMessage('');
    try {
      if (mode === 'demo') {
        const b = budgets.find(b => b.id === (command.data?.budgetId || previous.data.budgetId));
        const next = transition(previous, { ...command, expectedRevision: previous.revision }, { actor, now: Date.now(), policy: demoPolicy, budget: b, projectNo: `DEMO-PROJECT-${previous.id}` });
        if (previous.reservedCents !== next.reservedCents) setBudgets(list => list.map(b => b.id === (next.budgetId || previous.budgetId) ? { ...b, lockedCents: b.lockedCents + next.reservedCents - previous.reservedCents, usedCents: b.usedCents + (previous.stage === 'settlement' && command.action === 'advance' && previous.route === 'A' ? Math.round(Number(next.data.actualCost) * 100) : 0), revision: b.revision + 1 } : b));
        setDemoItems(list => list.map(c => c.id === id ? next : c));
        setDemoHistory(list => ({ ...list, [id]: [{ id: crypto.randomUUID(), revision: next.revision, action: command.action, from: previous.stage, to: next.stage, actor: actor.email, at: next.updatedAt, note: command.note || '', baseline: next.baseline, snapshot: structuredClone(next) }, ...(list[id] || [])] }));
      } else {
        await callApi({ ...command, id, expectedRevision: previous.revision }); await loadLive();
      }
      setMessage(`${mode === 'demo' ? '演练：' : ''}${actionNames[command.action] || '操作'}已保存${mode === 'demo' ? '，仅本次页面有效，不写入正式数据' : '，尚未同步BMP'}。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '操作未保存'); }
    finally { setBusy(false); }
  }
  async function create() {
    if (!actor) return;
    setBusy(true); setMessage('');
    try {
      const c = mode === 'demo' ? newCase(crypto.randomUUID(), `DEMO-REQ-${demoItems.length + 1}`, demoActor('applicant'), Date.now(), { channel: '月度计划' }, newRoute) : (await callApi({ action: 'create', route: newRoute, data: { channel: '月度计划' } })).item as Case;
      if (mode === 'demo') { setDemoItems(list => [c, ...list]); setRole('applicant'); } else await loadLive();
      setSelected(c.id); setTab('work');
    } catch (error) { setMessage(error instanceof Error ? error.message : '创建失败'); }
    finally { setBusy(false); }
  }
  function exportList() {
    const columns = ['需求编号', '项目编号', '名称', '医院', '业务性质', '需求通道', '当前节点', '负责人', ...(showMoney ? ['评估成本（元）', '预算占用（元）'] : []), '节点完成', '风险提醒'];
    const rows = filtered.map(c => [c.requestNo, c.projectNo || '', c.data.title, c.data.hospital || '内部研发', routeNames[c.route], c.data.channel, steps[c.stage].name, c.data.managerEmail || c.creatorEmail, ...(showMoney ? [cost(c), money(c.reservedCents)] : []), `${c.milestones.filter(m => m.acceptedAt).length}/${c.milestones.length}`, alerts(c).join('；')]);
    download(`${mode === 'demo' ? '演练-' : ''}科研项目查询结果.csv`, [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n'));
  }
  async function importFile(file: File) {
    setBusy(true); setMessage('');
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('单个文件不超过8MB。');
      const { Workbook } = await import('exceljs'); const wb = new Workbook();
      await wb.xlsx.load(new Uint8Array(await file.arrayBuffer()) as never);
      const sheet = wb.worksheets[0]; if (!sheet || sheet.rowCount > 51) throw new Error('请使用模板，单次最多50条需求（首行标题）。');
      const headings = sheet.getRow(1); const columns = ['业务性质', ...demandFields.map(f => f.label)];
      if (columns.some((title, i) => headings.getCell(i + 1).text.trim() !== title)) throw new Error('表头不匹配，请先下载本模块模板。');
      const parsed: ImportRow[] = [];
      sheet.eachRow((row, i) => { if (i === 1) return; const route = row.getCell(1).text.trim(); const data: Data = {};
        demandFields.forEach((f, k) => { const v = row.getCell(k + 2); if (v.type === 6) throw new Error(`第${i}行含公式，请粘贴为值后导入。`); data[f.key] = v.value instanceof Date ? v.value.toISOString().slice(0, f.type === 'month' ? 7 : 10) : v.text.trim(); });
        if (!['A', 'B', 'C'].includes(route)) throw new Error(`第${i}行业务性质必须为A、B或C。`);
        parsed.push({ id: crypto.randomUUID(), route: route as Route, data });
      }); setImports(parsed); setMessage('已读取预览；确认后仅创建需求草稿，不导入审批结果或跳过门禁。');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Excel读取失败'); }
    finally { setBusy(false); }
  }
  async function template() {
    const { Workbook } = await import('exceljs'); const wb = new Workbook(), sheet = wb.addWorksheet('科研需求草稿');
    sheet.addRow(['业务性质', ...demandFields.map(f => f.label)]); sheet.getRow(1).font = { bold: true }; sheet.columns.forEach(c => { c.width = 24; }); sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const note = wb.addWorksheet('填写说明'); note.addRow(['只导入需求草稿，不得用于导入历史批准状态。A/B/C代表三类路由；日期用YYYY-MM-DD，月份YYYY-MM。']); note.addRow(['医院编号必须来自CRM主数据；缺少信息可以保留草稿，但提交时必须补齐。']); note.columns = [{ width: 100 }];
    const url = URL.createObjectURL(new Blob([await wb.xlsx.writeBuffer() as BlobPart])); const a = document.createElement('a'); a.href = url; a.download = '科研需求导入模板.xlsx'; a.click(); URL.revokeObjectURL(url);
  }
  async function confirmImport() {
    if (!actor) return; setBusy(true);
    const updated = [...imports];
    for (const row of updated.filter(r => !r.saved)) {
      try {
        if (mode === 'demo') { const c = newCase(row.id, `DEMO-IMPORT-${row.id.slice(0, 8)}`, demoActor('applicant'), Date.now(), row.data, row.route); setDemoItems(list => list.some(x => x.id === c.id) ? list : [c, ...list]); }
        else await callApi({ action: 'create', clientId: row.id, route: row.route, data: row.data });
        row.saved = true; row.error = undefined;
      } catch (error) { row.error = error instanceof Error ? error.message : '保存失败'; }
    }
    setImports(updated); if (mode === 'live') await loadLive().catch(() => {}); setBusy(false); setMessage(`已保存${updated.filter(r => r.saved).length}条草稿；失败行保留，可补充后重试。`);
  }
  async function batchApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!actor || !batchIds.length) return;
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Data;
    if (mode === 'demo') {
      for (const id of batchIds) { const c = items.find(x => x.id === id)!; if (!batchEligible(c, budgets.find(b => b.id === c.data.budgetId))) { setMessage('仅预算内月度A类常规需求可以批量预审。'); return; } }
      for (const id of batchIds) await run(id, { action: 'advance', data, note: data.marketingOpinion, batchId: 'DEMO-BATCH' });
    } else {
      setBusy(true); try { const result = await callApi({ action: 'batch', ids: batchIds.map(id => ({ id, revision: items.find(c => c.id === id)!.revision })), data, note: data.marketingOpinion }); await loadLive(); setMessage(result.results.map((r: { id: string; ok: boolean; message?: string }) => `${items.find(c => c.id === r.id)?.requestNo}: ${r.ok ? '已通过' : r.message}`).join('；')); } catch (e) { setMessage(e instanceof Error ? e.message : '批量处理失败'); } finally { setBusy(false); }
    } setBatchIds([]);
  }

  return <section className="module-page research-workspace">
    <header className="module-header"><span className="module-context">业务工作台 / 科研项目管理</span><div className="module-header-actions"><UiScaleControl /><BmpLoginControl /></div></header>
    <div className="rw-container">
      <header className="rw-title"><div><p className="eyebrow">科研流程独立模块 · 依据 2026-08-31 业务流程</p><h1>科研项目管理</h1><p>从需求到交付，明确谁决策、谁出钱、谁负责。</p></div><div className="rw-mode" aria-label="工作模式"><button onClick={() => void chooseMode('demo')} aria-pressed={mode === 'demo'} disabled={busy}>流程演练</button><button onClick={() => void chooseMode('live')} aria-pressed={mode === 'live'} disabled={busy}>正式工作区</button></div></header>
      <div className={`rw-notice ${mode}`}><strong>{mode === 'demo' ? '演练环境 · 虚拟项目和预算，刷新即重置' : '正式工作区 · 保存至中台数据库'}</strong><span>{mode === 'demo' ? '与正式数据隔离，适合与老板、IT逐节点讨论。' : 'BMP角色、流程和接口尚待IT对接；不会自动付款、出库或写回BMP。'}</span>{mode === 'demo' && <label>当前演练角色 <select value={role} onChange={e => setRole(e.target.value as Role)}>{Object.entries(roleNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}{mode === 'live' && actor && <span>{actor.name} · {actor.roles.map(r => roleNames[r]).join(' / ')}</span>}</div>
      <nav className="rw-tabs" aria-label="科研工作区"><button onClick={() => setTab('work')} aria-current={tab === 'work' ? 'page' : undefined}>需求池与项目</button><button onClick={() => setTab('budget')} aria-current={tab === 'budget' ? 'page' : undefined}>医院预算</button><button onClick={() => setTab('overview')} aria-current={tab === 'overview' ? 'page' : undefined}>汇总与投入</button><button onClick={() => setTab('it')} aria-current={tab === 'it' ? 'page' : undefined}>流程说明与IT对接</button></nav>
      {message && <p className="rw-message" role="status">{message}</p>}
      {tab === 'work' && <>
        <div className="rw-metrics">{[['需求总数', items.length], ['独立主项目', items.filter(c => c.projectNo).length], ['中心数', items.reduce((n, c) => n + c.centers.length, 0)], ['需关注项目', items.filter(c => alerts(c).length).length]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
        <section className="rw-card">
          <div className="rw-toolbar"><input aria-label="查询科研项目" placeholder="查询医院、项目、编号或负责人" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="业务性质" value={route} onChange={e => setRoute(e.target.value)}><option value="all">全部业务性质</option>{Object.entries(routeNames).map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select><select aria-label="需求通道" value={channel} onChange={e => setChannel(e.target.value)}><option value="all">全部通道</option><option>月度计划</option><option>紧急插单</option></select><input aria-label="目标月份" type="month" value={month} onChange={e => setMonth(e.target.value)} /><label><input type="checkbox" checked={onlyTodo} onChange={e => setOnlyTodo(e.target.checked)} /> 只看我的待办</label><button onClick={exportList}>导出查询结果</button></div>
          <div className="rw-toolbar"><select value={newRoute} onChange={e => setNewRoute(e.target.value as Route)} aria-label="新需求业务性质">{Object.entries(routeNames).map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select><button className="rw-primary" disabled={busy || !actor} onClick={() => void create()}>＋ 新建科研需求</button><button onClick={() => void template().catch(() => setMessage('模板生成失败'))}>下载Excel模板</button><label className="rw-file">导入Excel<input type="file" accept=".xlsx" disabled={busy || !actor} onChange={e => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} /></label><small>导入只建草稿，审批必须在系统内逐项完成</small></div>
          {imports.length > 0 && <div className="rw-import"><h3>导入预览（{imports.length}条）</h3>{imports.map(r => <p key={r.id}>{r.route} · {r.data.title || '未命名'} · {r.data.hospital || '内部研发'} — {r.saved ? '已保存' : r.error || '待确认'}</p>)}<button disabled={busy || imports.every(r => r.saved)} onClick={() => void confirmImport()}>确认保存草稿</button><button onClick={() => setImports([])}>关闭预览</button></div>}
          <div className="rw-table-wrap"><table><thead><tr><th>选择</th><th>需求 / 主项目</th><th>医院与通道</th><th>当前节点</th><th>下一处理角色</th><th>提醒</th></tr></thead><tbody>{filtered.map(c => <tr key={c.id} className={c.id === selected ? 'selected' : ''}><td><input aria-label={`选择${c.requestNo}用于批量预审`} type="checkbox" checked={batchIds.includes(c.id)} disabled={c.stage !== 'marketing' || !actor?.roles.includes('marketing')} onChange={e => setBatchIds(ids => e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))} /></td><td><button className="rw-text-button" onClick={() => setSelected(c.id)}>{c.data.title || '未命名需求'}</button><small>{c.projectNo || c.requestNo} · {c.route}类</small></td><td>{c.data.hospital || '内部研发'}<small>{c.data.channel} · {c.data.targetMonth || '即时处理'}</small></td><td><span className="rw-status">{steps[c.stage].name}</span></td><td>{c.stage === 'sponsor' ? c.data.sponsorEmail : roleNames[steps[c.stage].role]}</td><td>{alerts(c)[0] || '—'}</td></tr>)}</tbody></table>{!filtered.length && <p className="rw-empty">{mode === 'live' && !actor ? '请登录并由IT分配科研权限，或切换“流程演练”先讨论流程。' : '当前条件没有记录，可以新建需求或调整筛选。'}</p>}</div>
          {batchIds.length > 0 && <form className="rw-batch" onSubmit={batchApprove}><strong>营销批量预审 · {batchIds.length}条</strong><input name="marketingOpinion" required placeholder="本批批准条件" /><input name="approvalUntil" aria-label="批准有效期" type="date" required /><button disabled={busy}>通过符合条件的需求</button><small>紧急、超预算、重大承诺等自动排除；逐条留存审批快照。</small></form>}
        </section>
        {current && actor && <CaseDetail key={`${current.id}-${mode}`} c={current} actor={actor} mode={mode} busy={busy} customers={customerRows} budgetRows={budgetRows} history={mode === 'demo' ? demoHistory[current.id] || [] : liveHistory} onRole={setRole} onCommand={command => run(current.id, command)} />}
      </>}
      {tab === 'budget' && <BudgetPanel budgets={budgetRows} canEdit={Boolean(canBudget)} mode={mode} customers={customerRows} onSave={async data => { setBusy(true); try { if (mode === 'demo') { const customer = demoCustomers.find(c => c.id === data.customerId); if (!customer) throw new Error('请先选择演练医院'); const old = budgets.find(b => b.id === data.id), total = Number(data.total) * 100; if (!Number.isSafeInteger(total) || total < (old?.usedCents || 0) + (old?.lockedCents || 0)) throw new Error('额度不能低于已用和锁定金额'); setBudgets(list => [{ id: data.id, customerId: data.customerId, hospital: customer.name, region: customer.region, period: data.period, totalCents: total, usedCents: old?.usedCents || 0, lockedCents: old?.lockedCents || 0, revision: (old?.revision || 0) + 1, evidence: data.evidence }, ...list.filter(b => b.id !== data.id)]); } else { await callApi({ action: 'budget', ...data }); await loadLive(); } setMessage('预算包已保存，金额以批准依据为准。'); } catch (e) { setMessage(e instanceof Error ? e.message : '预算保存失败'); } finally { setBusy(false); } }} busy={busy} />}
      {tab === 'overview' && <section className="rw-card"><h2>医院项目与投入汇总</h2><p>主项目按唯一项目编号计数，中心单独统计。成本是资源投入，不强制折算ROI；无批准和实际费用数据时不补零。</p><div className="rw-table-wrap"><table><thead><tr><th>医院</th><th>需求 / 主项目</th><th>已验收节点</th>{showMoney && <th>已完成评估成本</th>}<th>结题 / 在途</th></tr></thead><tbody>{[...new Set(filtered.map(c => c.data.hospital || '内部研发'))].map(hospital => { const rows = filtered.filter(c => (c.data.hospital || '内部研发') === hospital); return <tr key={hospital}><td>{hospital}</td><td>{rows.length} / {rows.filter(c => c.projectNo).length}</td><td>{rows.reduce((n, c) => n + c.milestones.filter(m => m.acceptedAt).length, 0)}</td>{showMoney && <td>{money(rows.reduce((n, c) => { try { return n + totalCost(c.data); } catch { return n; } }, 0))} 元<small>未完成评估的项目不计入</small></td>}<td>{rows.filter(c => ['closed', 'archived'].includes(c.stage)).length} / {rows.filter(c => !['closed', 'archived', 'terminated'].includes(c.stage)).length}</td></tr>; })}</tbody></table></div><button onClick={exportList}>导出明细，供客户汇报复核</button><details><summary>原有投入产出展示模板（示例，未接真实数据）</summary><ResearchRoiPanel /></details></section>}
      {tab === 'it' && <ItPanel />}
    </div>
  </section>;
}

function FieldInput({ field, value, onChange, disabled }: { field: Field; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className={field.type === 'textarea' ? 'rw-wide' : ''}><span>{field.label}{field.required && <b aria-label="必填"> *</b>}</span>{field.type === 'select' ? <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}><option value="">请选择</option>{field.options?.map(o => <option key={o}>{o}</option>)}</select> : field.type === 'textarea' ? <textarea value={value} rows={3} onChange={e => onChange(e.target.value)} disabled={disabled} /> : <input type={field.type || 'text'} value={value} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} onChange={e => onChange(e.target.value)} disabled={disabled} />}{field.hint && <small>{field.hint}</small>}</label>;
}

function CaseDetail({ c, actor, mode, busy, customers, budgetRows, history, onRole, onCommand }: { c: Item; actor: Actor; mode: 'demo' | 'live'; busy: boolean; customers: Customer[]; budgetRows: Budget[]; history: Audit[]; onRole: (role: Role) => void; onCommand: (cmd: Omit<Command, 'expectedRevision'>) => Promise<void> }) {
  const [data, setData] = useState<Data>(c.data);
  const [view, setView] = useState('current');
  const [kind, setKind] = useState<DocumentKind>('contract');
  const [note, setNote] = useState('');
  const [special, setSpecial] = useState('');
  const [milestones, setMilestones] = useState(c.milestones);
  const [centers, setCenters] = useState(c.centers);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [seenRevision, setSeenRevision] = useState(c.revision);
  if (seenRevision !== c.revision) {
    setSeenRevision(c.revision); setData(c.data); setMilestones(c.milestones); setCenters(c.centers); setNote(''); setSpecial('');
  }
  const enabled = canAct(c, actor), canMoney = mode === 'demo' || c.showMoney;
  const permittedSecondary = (action: string) => {
    const manager = isManager(c, actor), end = ['closed', 'terminated', 'archived'].includes(c.stage);
    if (['return', 'reserve', 'reject'].includes(action)) return enabled && !end && !['draft', 'execution', 'waiting', 'paused', 'settlement', 'returned', 'reserve'].includes(c.stage) && (!c.projectNo || (action === 'return' && c.stage === 'acceptance'));
    if (action === 'pause') return manager && ['launch', 'execution'].includes(c.stage);
    if (action === 'resume') return manager && ['waiting', 'paused'].includes(c.stage);
    if (action === 'change') return manager && c.projectNo && ['launch', 'execution', 'waiting', 'paused', 'acceptance', 'settlement'].includes(c.stage);
    if (action === 'terminate') return manager && !end;
    if (action === 'archive') return manager && ['closed', 'terminated'].includes(c.stage);
    return false;
  };
  function change(key: string, value: string) { setData(d => ({ ...d, [key]: value })); }
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') || 'save'; await onCommand({ action: action as Command['action'], data, note, ...(c.stage === 'launch' ? { milestones, centers } : {}) }); }
  const docs = c.documents.filter(d => d.kind === kind);
  return <section className="rw-case" aria-label="科研项目业务链">
    <header className="rw-case-title"><div><span className="rw-route">{c.route} · {routeNames[c.route]}</span><h2>{c.data.title || '未命名需求'}</h2><p>{c.projectNo || c.requestNo} · 基线 {c.baseline || '待立项'} · 第 {c.revision} 次记录 · {c.creatorEmail}</p></div><div><span>当前节点</span><strong>{steps[c.stage].name}</strong><small>处理：{c.stage === 'sponsor' ? c.data.sponsorEmail : roleNames[steps[c.stage].role]}</small></div></header>
    <nav className="rw-business-chain" aria-label="科研业务单据链">{businessChain(c).map(node => <button key={node.key} className={node.state} onClick={() => { if (node.kind) { setKind(node.kind); setView('documents'); } else setView(node.key === 'execution' ? 'milestones' : node.key === 'demand' || node.key === 'project' ? 'facts' : 'current'); }}><span className="rw-chain-dot" /><strong>{node.name}</strong><b>{node.count}</b><small>{node.state === 'done' ? '已形成记录' : node.state === 'current' ? '当前办理' : node.state === 'optional' ? '按需，不强制' : '待办理'}</small></button>)}</nav>
    <p className="rw-chain-note">各节点可点击查看关联单据。合同、付款与物料记录在中台内流转；实际付款、ERP出库仍由原系统执行。</p>
    <nav className="rw-subtabs">{[['current', '当前办理'], ['facts', '需求与立项'], ['milestones', '节点与中心'], ['documents', '关联申请'], ['history', '审批与历史']].map(([id, name]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{name}</button>)}</nav>
    {alerts(c).length > 0 && <div className="rw-warnings">{alerts(c).map(a => <p key={a}>{a}</p>)}</div>}
    {view === 'current' && <div className="rw-current-grid"><form className="rw-card" onSubmit={submit}>
      <div className="rw-section-title"><h3>{steps[c.stage].name}</h3>{mode === 'demo' && <div><button type="button" onClick={() => { setData(d => ({ ...d, ...demoData(c.route) })); }}>填入演练值</button>{!enabled && <button type="button" onClick={() => onRole(steps[c.stage].role)}>切换为当前处理角色</button>}</div>}</div><p>{steps[c.stage].help}</p>
      {!enabled && <p className="rw-muted">当前账号无此节点办理权限，资料仅供查看。</p>}
      <div className="rw-form-grid">
        {['draft', 'returned', 'reserve'].includes(c.stage) && <label className="rw-wide"><span>从医院主数据选择（B类内部项目可不选）</span><select value={data.customerId || ''} disabled={!enabled} onChange={e => { const customer = customers.find(x => x.id === e.target.value); if (customer) setData(d => ({ ...d, customerId: customer.id, hospital: customer.name, region: customer.region })); }}><option value="">选择医院</option>{customers.map(x => <option key={x.id} value={x.id}>{x.name} / {x.id}</option>)}</select><small>正式工作区只接受CRM主数据中的编号、名称和大区。</small></label>}
        {fieldsFor({ ...c, data }).map(field => field.key === 'budgetId' ? <label key={field.key}><span>医院预算包 *</span><select value={data.budgetId || ''} disabled={!enabled} onChange={e => change('budgetId', e.target.value)}><option value="">选择对应医院预算包</option>{budgetRows.filter(b => b.customerId === c.data.customerId).map(b => <option key={b.id} value={b.id}>{b.id} · 可用 {money(available(b))} 元</option>)}</select></label> : <FieldInput key={field.key} field={field} value={data[field.key] || ''} onChange={value => change(field.key, value)} disabled={!enabled || (mode === 'live' && ['customerId', 'hospital', 'region'].includes(field.key))} />)}
      </div>
      {canMoney && !['draft', 'intake'].includes(c.stage) && <p className="rw-money">评估总成本：{cost({ ...c, data })} 元 · 已锁预算：{money(c.reservedCents)} 元</p>}
      {c.stage === 'launch' && <p className="rw-tip">启动前请在“节点与中心”页签补齐计划日期、负责人、验收标准，再回到这里提交启动。</p>}
      {c.stage === 'execution' && <p className="rw-tip">请在“节点与中心”中提交和验收每个节点，再申请最终验收。</p>}
      {['waiting', 'paused'].includes(c.stage) && <p>等待事项：{c.waitReason}；责任人：{c.waitOwner}；恢复条件：{c.resumeCondition}</p>}
      {enabled && !['closed', 'terminated', 'archived', 'waiting', 'paused'].includes(c.stage) && <><label className="rw-note"><span>本次审批 / 操作意见</span><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="说明批准条件、需要补充什么或执行结果" /></label><div className="rw-actions"><button value="save" disabled={busy}>保存本节点</button><button className="rw-primary" value="advance" disabled={busy}>{c.stage === 'draft' || c.stage === 'returned' || c.stage === 'reserve' ? '提交需求' : c.stage === 'execution' ? '申请最终验收' : c.stage === 'settlement' ? '确认核销并完成' : '同意 / 提交下一环节'}</button></div></>}
      <div className="rw-secondary-actions">{[['return', '退回补充'], ['reserve', '转需求储备'], ['reject', '拒绝需求'], ['pause', '等待客户 / 暂停'], ['resume', '恢复执行'], ['change', '发起变更'], ['terminate', '申请终止'], ['archive', '归档']].filter(([action]) => permittedSecondary(action)).map(([action, title]) => <button type="button" key={action} disabled={busy} onClick={() => setSpecial(action)}>{title}</button>)}</div>
      {special && <fieldset className="rw-special"><legend>{actionNames[special]}</legend><p>所有操作校验角色及当前状态；变更后重新评估审批，原基线和原预算占用保留。</p><textarea aria-label="操作原因" value={note} onChange={e => setNote(e.target.value)} placeholder="必须填写原因" />{['return', 'reserve'].includes(special) && <><input aria-label="补充截止日" type="date" value={data.supplementBy || ''} onChange={e => change('supplementBy', e.target.value)} /><input aria-label="下一步责任人" type="email" placeholder="下一步责任人邮箱" value={data.nextOwner || ''} onChange={e => change('nextOwner', e.target.value)} /></>}{special === 'pause' && <><select value={data.waiting || '是'} onChange={e => change('waiting', e.target.value)}><option value="是">等待客户</option><option value="否">内部暂停</option></select><input aria-label="等待责任人" placeholder="客户 / 等待事项责任人" value={data.waitOwner || ''} onChange={e => change('waitOwner', e.target.value)} /><input aria-label="恢复条件" placeholder="恢复条件" value={data.resumeCondition || ''} onChange={e => change('resumeCondition', e.target.value)} /></>}<button type="button" disabled={busy || !note} onClick={() => void onCommand({ action: special as Command['action'], note, data })}>确认操作</button><button type="button" onClick={() => setSpecial('')}>取消</button></fieldset>}
    </form><aside className="rw-card rw-steps"><h3>审批节点与职责</h3><ol>{routeStages(c).map(stage => <li key={stage} className={c.stage === stage ? 'current' : c.decisions.some(d => d.stage === stage) ? 'done' : ''}><strong>{steps[stage].name}</strong><small>{roleNames[steps[stage].role]}</small></li>)}</ol><p>预算内月度A类在营销节点可批量预审；B/C按条件加载会签。</p></aside></div>}
    {view === 'facts' && <section className="rw-card"><h3>需求事实与七项立项承诺</h3><div className="rw-facts">{[...demandFields, ...steps.commitment.fields].filter(f => c.data[f.key]).map(f => <div key={f.key}><span>{f.label}</span><p>{c.data[f.key]}</p></div>)}</div><p>批准过的范围、样本、预算和日期不可直接覆盖；请在“当前办理”发起变更。完整历史见“审批与历史”。</p><button onClick={() => setView('current')}>进入当前办理</button></section>}
    {view === 'milestones' && <section className="rw-card"><h3>节点计划与交付验收</h3><p>计划在启动前锁定。完成日期由系统记录，节点负责人提交、指定验收人确认；B类产品决策由Sponsor确认。</p>{!milestones.length && <p className="rw-empty">正式立项后自动生成本路线节点模板。</p>}
      {milestones.map((m, i) => <article key={m.id} className="rw-milestone"><h4>{m.name} <span>{m.acceptedAt ? '已验收' : m.submittedAt ? '待验收' : '待交付'}</span></h4>{c.stage === 'launch' && enabled ? <div className="rw-form-grid">{[{ key: 'plannedDate', label: '计划完成日', type: 'date' }, { key: 'owner', label: '节点负责人邮箱', type: 'email' }, { key: 'acceptor', label: '验收人邮箱', type: 'email' }, { key: 'standard', label: '预期交付物 / 验收标准', type: 'text' }].map(f => <FieldInput key={f.key} field={f as Field} value={String(m[f.key as keyof typeof m] || '')} onChange={v => setMilestones(list => list.map((x, n) => n === i ? { ...x, [f.key]: v } : x))} disabled={Boolean(m.acceptedAt)} />)}</div> : <p>计划：{m.plannedDate || '待制定'} · 负责人：{m.owner} · 验收：{m.acceptor}<br />标准：{m.standard || '待制定'}{m.acceptedAt && <><br />实际验收：{dateTime(m.acceptedAt)}</>}</p>}{m.evidence && <p>交付物：{m.evidence}</p>}{c.stage === 'execution' && !m.acceptedAt && <MilestoneActions c={c} milestoneId={m.id} busy={busy} onCommand={onCommand} />}</article>)}
      {c.stage === 'launch' && enabled && <div className="rw-actions"><button onClick={() => setMilestones(list => [...list, { id: crypto.randomUUID(), name: '自定义节点', owner: c.data.managerEmail, acceptor: c.data.acceptorEmail, plannedDate: '', standard: '', evidence: '', overdueReason: '', correction: '' }])}>＋ 自定义节点</button>{mode === 'demo' && <button onClick={() => setMilestones(list => list.map(m => ({ ...m, plannedDate: c.data.deadline, owner: 'technical@example.test', acceptor: c.route === 'B' && m.name.includes('产品决策') ? 'sponsor@example.test' : 'pmo@example.test', standard: '演练交付完整、结果可复核' })))}>填入演练计划</button>}<button disabled={busy} onClick={() => void onCommand({ action: 'save', data, milestones, centers })}>保存节点与中心计划</button></div>}
      <h3>中心子项目 · 不重复计算主项目</h3><div className="rw-table-wrap"><table><thead><tr><th>CRM医院编号 / 中心</th><th>中心负责人</th><th>当前情况</th><th>样本量</th><th>伦理 / 合同依据</th></tr></thead><tbody>{centers.map((center, i) => <tr key={center.id}><td>{center.name}<small>{center.customerId}</small></td><td>{c.stage === 'launch' ? <input aria-label="中心负责人邮箱" value={center.owner} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, owner: e.target.value } : x))} /> : center.owner}</td><td>{c.stage === 'launch' ? <input aria-label="中心当前情况" value={center.status} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, status: e.target.value } : x))} /> : center.status}</td><td>{c.stage === 'launch' ? <input aria-label="中心样本量" type="number" min="0" value={center.sampleCount} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, sampleCount: Number(e.target.value) } : x))} /> : center.sampleCount}</td><td>{c.stage === 'launch' ? <><input aria-label="中心伦理依据" placeholder="伦理依据 / 不适用原因" value={center.ethics} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, ethics: e.target.value } : x))} /><input aria-label="中心合同依据" placeholder="合同依据 / 不适用原因" value={center.contract} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, contract: e.target.value } : x))} /></> : `${center.ethics || '待补'} / ${center.contract || '待补'}`}</td></tr>)}</tbody></table></div>{c.stage === 'launch' && enabled && <select value="" aria-label="增加中心" onChange={e => { const customer = customers.find(x => x.id === e.target.value); if (customer && !centers.some(x => x.customerId === customer.id)) setCenters(list => [...list, { id: customer.id, customerId: customer.id, name: customer.name, owner: c.data.managerEmail, status: '待启动', ethics: '', contract: '', sampleCount: 0 }]); }}><option value="">＋ 从CRM医院主数据增加中心</option>{customers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
    </section>}
    {view === 'documents' && <section className="rw-card"><div className="rw-section-title"><h3>关联申请 · 一条主项目链</h3><select aria-label="申请类别" value={kind} onChange={e => setKind(e.target.value as DocumentKind)}>{Object.entries(documentNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div><p>申请记录与科研项目关联，审核意见留痕。中台审核不等于BMP已付款或ERP已出库。</p>
      {kind === 'payment' && c.route === 'A' && <div className="rw-money">预算包：{canMoney ? c.budgetId || '待关联' : '按权限显示'} · 当前占用：{canMoney ? money(c.reservedCents) + ' 元' : '按权限显示'}</div>}
      {docs.map(d => <article key={d.id} className="rw-document"><h4>{d.title} <span>{d.status === 'approved' ? '中台已审核' : d.status === 'returned' ? '已退回，补充后新建关联单' : '待审核'}</span></h4><p>{d.applicant} · {dateTime(d.createdAt)}{canMoney && d.amount && ` · ${d.amount}元`}</p><p>{d.note}</p><p>外部单据编号：{d.reference || '待提供'} · 资料：<EvidenceLink value={d.evidence} /></p>{d.reviewNote && <p>审核：{d.reviewer} · {d.reviewNote}</p>}{d.status === 'submitted' && <form className="rw-inline-form" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); void onCommand({ action: 'review_document', note: String(fd.get('reviewNote')), data: { documentId: d.id, decision: String(fd.get('decision')) } }); }}><input name="reviewNote" required placeholder="审核条件 / 退回原因" /><select name="decision"><option value="approved">同意</option><option value="returned">退回</option></select><button disabled={busy}>提交审核</button><small>{kind === 'resource' ? '研发 / 执行' : kind === 'summary' ? '学术PMO' : '商务 / 财务'}权限</small></form>}</article>)}
      {kind === 'expense' && c.decisions.some(d => d.stage === 'settlement') && <article className="rw-document"><h4>项目费用核销记录（主流程生成）</h4><p>{canMoney ? `实际成本 ${c.data.actualCost} 元；客户收入 ${c.data.revenue} 元` : '费用金额按权限显示'}</p><p>归档：<EvidenceLink value={c.data.archiveEvidence || ''} /></p></article>}
      {kind === 'summary' && c.decisions.some(d => d.stage === 'acceptance') && <article className="rw-document"><h4>项目最终验收记录（主流程生成）</h4><p>{c.data.outcomes}</p><p>验收资料：<EvidenceLink value={c.data.acceptanceEvidence || ''} /></p><p>后续安排：{c.data.followUp}</p></article>}
      {!docs.length && <p className="rw-empty">尚无{documentNames[kind]}申请。适用时建立，不适用时无需补假单据。</p>}
      {c.projectNo && !['closed', 'terminated', 'archived'].includes(c.stage) && <form className="rw-document-form" onSubmit={e => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.currentTarget)) as Data; void onCommand({ action: 'submit_document', data: { ...fd, kind } }); }}><h4>＋ 新建{documentNames[kind]}申请</h4><div className="rw-form-grid"><label>申请名称<input name="title" required /></label><label>金额（付款 / 核销必填）<input name="amount" type="number" min="0" step="0.01" /></label><label>BMP / 合同 / ERP关联编号<input name="reference" /></label><label>资料链接或云盘路径<input name="evidence" required placeholder="https://… 或 /科研资料/…" /></label><label className="rw-wide">申请用途与说明<textarea name="note" required /></label></div><button disabled={busy}>提交此申请</button></form>}
    </section>}
    {view === 'history' && <section className="rw-card"><h3>审批、操作与基线历史</h3><p>每一次操作都追加记录。旧基线只读，不能覆盖；金额和专业资料按当前账号权限显示。</p><div className="rw-history">{history.map(h => <article key={h.id}><span>第{h.revision}次记录 · 基线{h.baseline}</span><strong>{actionNames[h.action] || h.action}：{steps[h.from].name} → {steps[h.to].name}</strong><p>{h.actor} · {dateTime(h.at)}</p>{h.note && <p>{h.note}</p>}{h.snapshot && <button onClick={() => setSelectedRevision(selectedRevision === h.revision ? null : h.revision)}>查看该版本</button>}{selectedRevision === h.revision && h.snapshot && <pre>{JSON.stringify({ projectNo: h.snapshot.projectNo, data: h.snapshot.data, decisions: h.snapshot.decisions, milestones: h.snapshot.milestones }, null, 2)}</pre>}</article>)}</div>{!history.length && <p>尚无流转记录，提交需求后开始记录。</p>}</section>}
  </section>;
}

function MilestoneActions({ c, milestoneId, busy, onCommand }: { c: Case; milestoneId: string; busy: boolean; onCommand: (cmd: Omit<Command, 'expectedRevision'>) => Promise<void> }) {
  const m = c.milestones.find(m => m.id === milestoneId)!;
  return <form className="rw-inline-form" onSubmit={e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)) as Data; const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') as Command['action']; void onCommand({ action, milestoneId, data, note: data.note }); }}><input name="evidence" defaultValue={m.evidence} placeholder="交付物链接 / 云盘路径" /><input name="overdueReason" placeholder="逾期原因（如有）" /><input name="correction" placeholder="纠偏措施（如有）" /><input name="note" placeholder="验收结论 / B类继续或调整决策" /><button value="submit_milestone" disabled={busy}>负责人提交</button><button value="accept_milestone" disabled={busy || !m.submittedAt}>验收人确认</button></form>;
}

function BudgetPanel({ budgets, canEdit, mode, customers, onSave, busy }: { budgets: Budget[]; canEdit: boolean; mode: string; customers: Customer[]; onSave: (d: Data) => Promise<void>; busy: boolean }) {
  const [editing, setEditing] = useState<Budget | null>(null);
  return <section className="rw-card"><h2>医院预算包</h2><p>可用余额＝总额－已用－已锁定。批准时锁定，结题按实际成本核销并释放差额。调整额度须有批准依据。</p><div className="rw-table-wrap"><table><thead><tr><th>医院 / 预算包</th><th>期间</th><th>总额（元）</th><th>已用</th><th>已锁定</th><th>可用</th><th>维护</th></tr></thead><tbody>{budgets.map(b => <tr key={b.id}><td>{b.hospital}<small>{b.id}</small></td><td>{b.period}</td><td>{money(b.totalCents)}</td><td>{money(b.usedCents)}</td><td>{money(b.lockedCents)}</td><td>{money(available(b))}</td><td><button disabled={!canEdit} onClick={() => setEditing(b)}>调整额度</button></td></tr>)}</tbody></table></div>{!budgets.length && <p className="rw-empty">暂无可见预算包。额度仅向商务预算、财务、大区及授权管理角色开放。</p>}{canEdit ? <form key={editing?.id || 'new'} className="rw-budget-form" onSubmit={e => { e.preventDefault(); void onSave(Object.fromEntries(new FormData(e.currentTarget)) as Data); }}><h3>{editing ? '调整已批准预算总额' : '录入已批准预算包'}</h3><div className="rw-form-grid"><label>预算包编号<input name="id" required defaultValue={editing?.id} readOnly={Boolean(editing)} /></label><label>CRM医院<select name="customerId" required defaultValue={editing?.customerId}>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>预算期间<input name="period" required placeholder="2026 或 2026-Q3" defaultValue={editing?.period} readOnly={Boolean(editing)} /></label><label>批准预算总额（元）<input name="total" type="number" step="0.01" min="0" required defaultValue={editing ? editing.totalCents / 100 : ''} /></label><label className="rw-wide">批准依据 / 调整原因<textarea name="evidence" required placeholder="填写真实批准文件编号、云盘路径及调整原因" /></label><input type="hidden" name="revision" value={editing?.revision || 0} /></div><button disabled={busy}>保存预算包</button>{editing && <button type="button" onClick={() => setEditing(null)}>新建另一个预算包</button>}</form> : <p>{mode === 'demo' ? '切换为“商务预算管理员”可演练额度维护。' : '预算维护需商务预算管理员权限。'}</p>}</section>;
}

function ItPanel() {
  return <section className="rw-card rw-it"><h2>按BMP业务单据链讨论，再映射到真实系统</h2><p>以2026-08-31流程和XMind为目标，8月29日诊断材料用于补问题。截图只参考交互方式，不把会议审批人或金额套到科研。</p><div className="rw-route-grid">{[['A', '医院预算包 → 商务核验 → 大区审批 → 营销预审', 'PMO负责项目与客户交付；预算不足不得启动。'], ['B', '专业评估 → 指定Sponsor → 产品/研发部门负责人', '医院资源及重大外部承诺才触发条件会签，PMO不代替战略审批。'], ['C', '大区确认 → 产品/市场前置 → 研发评估 → 条件会签', '先确认产品缺口，再进入研发；临时通路必须有失效日与转产/退出Owner。']].map(([key, chain, note]) => <article key={key}><h3>{key} · {routeNames[key as Route]}</h3><strong>{chain}</strong><p>{note}</p></article>)}</div>
    <h3>本期可运行</h3><p>需求登记、动态审批、成本汇总、预算锁定/释放、七项立项承诺、关联申请审核、节点计划/交付/验收、变更/等待客户/终止、中心子项目、查询与Excel草稿导入、历史版本及站内风险提醒。演练和正式工作区使用同一套规则。</p>
    <h3>IT会议需一次性确认</h3><ol><li>科研角色与真实BMP账号、部门、大区及团队映射；上线前不能把管理账号当作所有审批角色。</li><li>医院预算主数据归口、批准额度、超授权阈值与核销时点；当前不允许负余额放行。</li><li>BMP流程定义、项目主数据、审批日志、多中心映射四类导出，核实真实节点及字段。</li><li>CRM客户、报价、合同、付款、物料、报销、ERP与研发项目编号的对象和接口。</li><li>工作日历、节假日、代理/加签/转办规则及企业微信提醒通道；目前为站内目标时效提示，不自动发通知。</li></ol>
    <h3>已有资料能确认什么</h3><p>BMP已有“科研立项申请”和“科研项目管理”，包含资料、明细、里程碑、报价、销售机会、订单及合同关联页签；具体后台审批顺序和强制校验尚未核实。历史512条是台账行，不是去重后的主项目数，本工作区不拿它作为实时统计。</p>
    <h3>独立开发与同步约定</h3><p>业务规则、页面、接口、数据表分层独立；与平台共享导航和登录。现阶段新记录写入科研独立表，历史BMP台账不自动覆盖。每次变更写入待对接事件，默认不外发；IT确认字段、权限、唯一编号及冲突策略后再打开真正同步。</p>
    <a href="/api/research/handoff">下载IT交付说明与接口约定</a>
  </section>;
}
