'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { BmpLoginControl, UiScaleControl } from '@/components/platform-controls';
import { ResearchRoiPanel } from '@/components/research-roi-panel';
import { businessChain, documentNames } from '@/lib/research/chain';
import { demandFields, fieldsFor, routeStages, steps } from '@/lib/research/definition';
import { demoActor, demoBudgets, demoContacts, demoCustomers, demoData, demoPolicy, demoStakeholderInputs, initialDemoCases } from '@/lib/research/demo';
import { available, money, projectFileCategories, roleNames, routeNames, stakeholderImportanceLevels, stakeholderRoleNames, totalCost, type Actor, type Budget, type Case, type CaseStakeholder, type Command, type CustomerContact, type Data, type DocumentKind, type Field, type History, type Role, type Route, type StakeholderInput, type StakeholderRole } from '@/lib/research/model';
import { alerts, batchEligible, canAct, isManager, newCase, transition } from '@/lib/research/workflow';
import './research-workspace.css';

type Item = Case & { canAct?: boolean; showMoney?: boolean; alerts?: string[]; batchEligible?: boolean };
type Customer = { id: string; name: string; region: string };
type Audit = History & { snapshot?: Case };
type ImportRow = { id: string; route: Route; data: Data; saved?: boolean; error?: string };
type ApiResult = { error?: string; items: Item[]; item: Item; actor: Actor; budgets: Budget[]; customers: Customer[]; contacts: CustomerContact[]; contact: CustomerContact; history: Audit[]; results: { id: string; ok: boolean; message?: string }[] };
const actionNames: Record<string, string> = { create: '新建需求', save: '保存', advance: '完成本节点 / 提交下一步', return: '退回', reject: '拒绝', reserve: '储备', resubmit: '重新提交', pause: '暂停 / 等待', resume: '恢复', change: '发起变更', submit_milestone: '提交节点交付', accept_milestone: '节点验收', terminate: '申请终止', archive: '归档', submit_document: '登记外部单据', review_document: '核验外部单据', post_update: '发布月度进展', link_file: '新增资料索引', archive_file: '归档资料版本' };
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
  const [mode, setMode] = useState<'demo' | 'live'>('live');
  const [demoItems, setDemoItems] = useState<Case[]>(initialDemoCases);
  const [liveItems, setLiveItems] = useState<Item[]>([]);
  const [role, setRole] = useState<Role>('applicant');
  const [liveActor, setLiveActor] = useState<Actor | null>(null);
  const budgets = demoBudgets;
  const [liveBudgets, setLiveBudgets] = useState<Budget[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [liveContacts, setLiveContacts] = useState<CustomerContact[]>([]);
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState('work');
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState('all');
  const [month, setMonth] = useState('');
  const [channel, setChannel] = useState('all');
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [busy, setBusy] = useState(true);
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
  const contactRows = mode === 'demo' ? demoContacts : liveContacts;
  const current = items.find(c => c.id === selected);
  const filtered = items.filter(c => (!query || `${c.requestNo} ${c.projectNo || ''} ${c.data.title} ${c.data.hospital} ${c.data.managerEmail || c.creatorEmail} ${(c.stakeholders || []).map(person => person.profileSnapshot.name).join(' ')}`.toLowerCase().includes(query.toLowerCase())) && (route === 'all' || c.route === route) && (!month || c.data.targetMonth === month) && (channel === 'all' || c.data.channel === channel) && (!onlyTodo || Boolean(actor && canAct(c, actor))));
  const showMoney = mode === 'demo' || Boolean(actor?.roles.some(r => ['budget', 'finance', 'regional', 'marketing', 'executive'].includes(r)));

  async function loadLive() {
    const result = await callApi(); setLiveItems(result.items); setLiveActor(result.actor); setLiveBudgets(result.budgets); setCustomers(result.customers); setLiveContacts(result.contacts || []);
    return result.items as Item[];
  }
  async function chooseMode(next: 'demo' | 'live') {
    setMode(next); setMessage(''); setBatchIds([]); setImports([]); setLiveHistory([]);
    if (next === 'demo') { setSelected(demoItems[0]?.id || ''); return; }
    setBusy(true); setSelected('');
    try { const list = await loadLive(); setSelected(list[0]?.id || ''); }
    catch (error) { setLiveActor(null); setLiveItems([]); setLiveBudgets([]); setCustomers([]); setLiveContacts([]); setMessage(error instanceof Error ? error.message : '读取失败'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    callApi().then(result => {
      if (!active) return;
      setLiveItems(result.items || []); setLiveActor(result.actor); setLiveBudgets(result.budgets || []); setCustomers(result.customers || []); setLiveContacts(result.contacts || []); setSelected(result.items?.[0]?.id || '');
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : '读取部门工作区失败'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
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
        const next = transition(previous, { ...command, expectedRevision: previous.revision }, { actor, now: Date.now(), policy: demoPolicy, budget: b, contacts: demoContacts, projectNo: `DEMO-PROJECT-${previous.id}` });
        setDemoItems(list => list.map(c => c.id === id ? next : c));
        setDemoHistory(list => ({ ...list, [id]: [{ id: crypto.randomUUID(), revision: next.revision, action: command.action, from: previous.stage, to: next.stage, actor: actor.email, at: next.updatedAt, note: command.note || '', baseline: next.baseline, snapshot: structuredClone(next) }, ...(list[id] || [])] }));
      } else {
        await callApi({ ...command, id, expectedRevision: previous.revision }); await loadLive();
      }
      setMessage(`${mode === 'demo' ? '演练：' : ''}${actionNames[command.action] || '操作'}已保存${mode === 'demo' ? '，仅本次页面有效，不写入业务数据' : '为部门协同状态；尚未同步BMP，也不代表公司级审批完成'}。`);
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
    const columns = ['需求编号', '学术支持部项目编号', '名称', '医院', '业务性质', '需求通道', '医院端项目负责人', '负责人重要程度', '医院端日常对接人', '对接人重要程度', '当前节点', '我方项目经理', ...(showMoney ? ['评估成本（元）', '部门成本预测基线（元）'] : []), 'BMP对接状态', 'BMP正式状态', '节点完成', '风险提醒'];
    const rows = filtered.map(c => { const lead = (c.stakeholders || []).find(person => person.role === 'hospital_project_lead'), liaison = (c.stakeholders || []).find(person => person.role === 'hospital_liaison'); return [c.requestNo, c.projectNo || '', c.data.title, c.data.hospital || '内部研发', routeNames[c.route], c.data.channel, lead?.profileSnapshot.name || '', lead?.importance || '', liaison?.profileSnapshot.name || '', liaison?.importance || '', steps[c.stage].name, c.data.managerEmail || c.creatorEmail, ...(showMoney ? [cost(c), money(c.costForecastCents)] : []), c.bmp.integrationStatus, c.bmp.bmpOfficialStatus || '未同步', `${c.milestones.filter(m => m.acceptedAt).length}/${c.milestones.length}`, alerts(c).join('；')]; });
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
      }); setImports(parsed); setMessage('已读取预览；确认后仅创建部门需求草稿，不导入BMP审批结果或跳过校验。');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Excel读取失败'); }
    finally { setBusy(false); }
  }
  async function template() {
    const { Workbook } = await import('exceljs'); const wb = new Workbook(), sheet = wb.addWorksheet('科研需求草稿');
    sheet.addRow(['业务性质', ...demandFields.map(f => f.label)]); sheet.getRow(1).font = { bold: true }; sheet.columns.forEach(c => { c.width = 24; }); sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const note = wb.addWorksheet('填写说明'); note.addRow(['只导入部门需求草稿，不得用于导入BMP历史审批状态。A/B/C代表三类路由；日期用YYYY-MM-DD，月份YYYY-MM。']); note.addRow(['医院编号必须来自BMP/CRM主数据；导入后须在系统中匹配医院端负责人和日常对接人，Excel不会自动创建联系人主档或公司审批记录。']); note.columns = [{ width: 100 }];
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
      setBusy(true); try { const result = await callApi({ action: 'batch', ids: batchIds.map(id => ({ id, revision: items.find(c => c.id === id)!.revision })), data, note: data.marketingOpinion }); await loadLive(); setMessage(result.results.map((r: { id: string; ok: boolean; message?: string }) => `${items.find(c => c.id === r.id)?.requestNo}: ${r.ok ? '已记录部门预审' : r.message}`).join('；')); } catch (e) { setMessage(e instanceof Error ? e.message : '批量处理失败'); } finally { setBusy(false); }
    } setBatchIds([]);
  }

  return <section className="module-page research-workspace">
    <header className="module-header"><span className="module-context">业务工作台 / 科研项目管理</span><div className="module-header-actions"><UiScaleControl /><BmpLoginControl /></div></header>
    <div className="rw-container">
      <header className="rw-title"><div><p className="eyebrow">学术支持部项目工作台 · BMP公司主系统的业务协同扩展</p><h1>科研项目管理</h1><p>本平台管需求评估、部门协同、进展、资料和成果；客户、销量、预算包、合同付款和正式审批以BMP/ERP为准。</p></div><div className="rw-mode" aria-label="工作模式"><button onClick={() => void chooseMode('live')} aria-pressed={mode === 'live'} disabled={busy}>部门工作区</button><button onClick={() => void chooseMode('demo')} aria-pressed={mode === 'demo'} disabled={busy}>流程设计预览</button></div></header>
      <div className={`rw-notice ${mode}`}><strong>{mode === 'demo' ? '设计预览 · 全部是虚拟数据，刷新即重置' : '部门工作区 · 学术支持部协同记录'}</strong><span>{mode === 'demo' ? '只用于跟业务和IT讨论规则，不形成任何公司批准。' : '本页保存学术支持部工作状态；无BMP对象ID、流程实例ID和回执，不得称为公司级批准或财务完成。'}</span>{mode === 'demo' && <label>当前预览角色 <select value={role} onChange={e => setRole(e.target.value as Role)}>{Object.entries(roleNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}{mode === 'live' && actor && <span>{actor.name} · {actor.roles.map(r => roleNames[r]).join(' / ')}</span>}</div>
      <nav className="rw-tabs" aria-label="科研工作区"><button onClick={() => setTab('work')} aria-current={tab === 'work' ? 'page' : undefined}>需求池与项目</button><button onClick={() => setTab('contacts')} aria-current={tab === 'contacts' ? 'page' : undefined}>BMP客户与联系人</button><button onClick={() => setTab('budget')} aria-current={tab === 'budget' ? 'page' : undefined}>BMP预算包</button><button onClick={() => setTab('overview')} aria-current={tab === 'overview' ? 'page' : undefined}>汇总与投入</button><button onClick={() => setTab('it')} aria-current={tab === 'it' ? 'page' : undefined}>系统边界与IT对接</button></nav>
      {message && <p className="rw-message" role="status">{message}</p>}
      {tab === 'work' && <>
        <div className="rw-metrics">{[['评估中', items.filter(c => !c.projectNo && !['closed', 'terminated', 'archived'].includes(c.stage)).length], ['部门已建档', items.filter(c => Boolean(c.projectNo) && !['closed', 'terminated', 'archived'].includes(c.stage)).length], ['部门已收口', items.filter(c => ['closed', 'archived'].includes(c.stage)).length], ['异常', items.filter(c => alerts(c).length > 0 || ['returned', 'reserve', 'waiting', 'paused', 'terminated'].includes(c.stage)).length]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
        <section className="rw-card">
          <div className="rw-toolbar"><input aria-label="查询科研项目" placeholder="查询医院、项目、编号或负责人" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="业务性质" value={route} onChange={e => setRoute(e.target.value)}><option value="all">全部业务性质</option>{Object.entries(routeNames).map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select><select aria-label="需求通道" value={channel} onChange={e => setChannel(e.target.value)}><option value="all">全部通道</option><option>月度计划</option><option>紧急插单</option></select><input aria-label="目标月份" type="month" value={month} onChange={e => setMonth(e.target.value)} /><label><input type="checkbox" checked={onlyTodo} onChange={e => setOnlyTodo(e.target.checked)} /> 只看我的待办</label><button onClick={exportList}>导出查询结果</button></div>
          <div className="rw-toolbar"><select value={newRoute} onChange={e => setNewRoute(e.target.value as Route)} aria-label="新需求业务性质">{Object.entries(routeNames).map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}</select><button className="rw-primary" disabled={busy || !actor} onClick={() => void create()}>＋ 新建科研需求</button><button onClick={() => void template().catch(() => setMessage('模板生成失败'))}>下载Excel模板</button><label className="rw-file">导入Excel<input type="file" accept=".xlsx" disabled={busy || !actor} onChange={e => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} /></label><small>导入只建中台需求草稿；正式审批仍须在BMP完成并回传单据ID</small></div>
          {imports.length > 0 && <div className="rw-import"><h3>导入预览（{imports.length}条）</h3>{imports.map(r => <p key={r.id}>{r.route} · {r.data.title || '未命名'} · {r.data.hospital || '内部研发'} — {r.saved ? '已保存' : r.error || '待确认'}</p>)}<button disabled={busy || imports.every(r => r.saved)} onClick={() => void confirmImport()}>确认保存草稿</button><button onClick={() => setImports([])}>关闭预览</button></div>}
          <div className="rw-table-wrap"><table><thead><tr><th>选择</th><th>需求 / 主项目</th><th>医院与通道</th><th>当前节点</th><th>下一处理角色</th><th>提醒</th></tr></thead><tbody>{filtered.map(c => <tr key={c.id} className={c.id === selected ? 'selected' : ''}><td><input aria-label={`选择${c.requestNo}用于批量预审`} type="checkbox" checked={batchIds.includes(c.id)} disabled={c.stage !== 'marketing' || !actor?.roles.includes('marketing')} onChange={e => setBatchIds(ids => e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))} /></td><td><button className="rw-text-button" onClick={() => setSelected(c.id)}>{c.data.title || '未命名需求'}</button><small>{c.projectNo || c.requestNo} · {c.route}类</small></td><td>{c.data.hospital || '内部研发'}<small>{c.data.channel} · {c.data.targetMonth || '即时处理'}</small></td><td><span className="rw-status">{steps[c.stage].name}</span></td><td>{c.stage === 'sponsor' ? c.data.sponsorEmail : roleNames[steps[c.stage].role]}</td><td>{alerts(c)[0] || '—'}</td></tr>)}</tbody></table>{!filtered.length && <p className="rw-empty">{mode === 'live' && !actor ? '请登录并由IT分配科研权限，或切换“流程演练”先讨论流程。' : '当前条件没有记录，可以新建需求或调整筛选。'}</p>}</div>
          {batchIds.length > 0 && <form className="rw-batch" onSubmit={batchApprove}><strong>营销批量预审 · {batchIds.length}条</strong><input name="marketingOpinion" required placeholder="本批预审条件" /><input name="approvalUntil" aria-label="预审意见有效期" type="date" required /><button disabled={busy}>记录符合条件的预审意见</button><small>紧急、超预算、重大承诺等自动排除；逐条留存部门协同快照，正式审批仍提交BMP。</small></form>}
        </section>
        {current && actor && <CaseDetail key={`${current.id}-${mode}`} c={current} actor={actor} mode={mode} busy={busy} customers={customerRows} contacts={contactRows} budgetRows={budgetRows} history={mode === 'demo' ? demoHistory[current.id] || [] : liveHistory} onRole={setRole} onCommand={command => run(current.id, command)} />}
      </>}
      {tab === 'contacts' && <ContactPanel contacts={contactRows} customers={customerRows} mode={mode} />}
      {tab === 'budget' && <BudgetPanel budgets={budgetRows} mode={mode} />}
      {tab === 'overview' && <section className="rw-card"><h2>医院项目与投入汇总</h2><p>主项目按学术支持部项目编号计数，中心单独统计。成本是资源投入，不强制折算ROI；缺BMP回执或实际费用数据时不补零。</p><div className="rw-table-wrap"><table><thead><tr><th>医院</th><th>需求 / 部门项目</th><th>已验收节点</th>{showMoney && <th>已完成评估成本</th>}<th>收口 / 在途</th></tr></thead><tbody>{[...new Set(filtered.map(c => c.data.hospital || '内部研发'))].map(hospital => { const rows = filtered.filter(c => (c.data.hospital || '内部研发') === hospital); return <tr key={hospital}><td>{hospital}</td><td>{rows.length} / {rows.filter(c => c.projectNo).length}</td><td>{rows.reduce((n, c) => n + c.milestones.filter(m => m.acceptedAt).length, 0)}</td>{showMoney && <td>{money(rows.reduce((n, c) => { try { return n + totalCost(c.data); } catch { return n; } }, 0))} 元<small>未完成评估的项目不计入</small></td>}<td>{rows.filter(c => ['closed', 'archived'].includes(c.stage)).length} / {rows.filter(c => !['closed', 'archived', 'terminated'].includes(c.stage)).length}</td></tr>; })}</tbody></table></div><button onClick={exportList}>导出明细，供客户汇报复核</button><details><summary>原有投入产出展示模板（示例，未接真实数据）</summary><ResearchRoiPanel /></details></section>}
      {tab === 'it' && <ItPanel />}
    </div>
  </section>;
}

function FieldInput({ field, value, onChange, disabled }: { field: Field; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className={field.type === 'textarea' ? 'rw-wide' : ''}><span>{field.label}{field.required && <b aria-label="必填"> *</b>}</span>{field.type === 'select' ? <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}><option value="">请选择</option>{field.options?.map(o => <option key={o}>{o}</option>)}</select> : field.type === 'textarea' ? <textarea value={value} rows={3} onChange={e => onChange(e.target.value)} disabled={disabled} /> : <input type={field.type || 'text'} value={value} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} onChange={e => onChange(e.target.value)} disabled={disabled} />}{field.hint && <small>{field.hint}</small>}</label>;
}

function stakeholderInputsFrom(items: CaseStakeholder[] = []): StakeholderInput[] { return items.map(({ contactId, role, importance, importanceBasis, responsibility }) => ({ contactId, role, importance, importanceBasis, responsibility })); }

function CaseDetail({ c, actor, mode, busy, customers, contacts, budgetRows, history, onRole, onCommand }: { c: Item; actor: Actor; mode: 'demo' | 'live'; busy: boolean; customers: Customer[]; contacts: CustomerContact[]; budgetRows: Budget[]; history: Audit[]; onRole: (role: Role) => void; onCommand: (cmd: Omit<Command, 'expectedRevision'>) => Promise<void> }) {
  const [data, setData] = useState<Data>(c.data);
  const [view, setView] = useState('current');
  const [kind, setKind] = useState<DocumentKind>('contract');
  const [note, setNote] = useState('');
  const [special, setSpecial] = useState('');
  const [milestones, setMilestones] = useState(c.milestones);
  const [centers, setCenters] = useState(c.centers);
  const [stakeholders, setStakeholders] = useState<StakeholderInput[]>(stakeholderInputsFrom(c.stakeholders));
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [seenRevision, setSeenRevision] = useState(c.revision);
  if (seenRevision !== c.revision) {
    setSeenRevision(c.revision); setData(c.data); setMilestones(c.milestones); setCenters(c.centers); setStakeholders(stakeholderInputsFrom(c.stakeholders)); setNote(''); setSpecial('');
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
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') || 'save'; await onCommand({ action: action as Command['action'], data, note, stakeholders, ...(c.stage === 'launch' ? { milestones, centers } : {}) }); }
  const docs = c.documents.filter(d => d.kind === kind);
  return <section className="rw-case" aria-label="科研项目业务链">
    <header className="rw-case-title"><div><span className="rw-route">{c.route} · {routeNames[c.route]}</span><h2>{c.data.title || '未命名需求'}</h2><p>{c.projectNo || c.requestNo} · 部门基线 {c.baseline || '待建档'} · 第 {c.revision} 次记录 · {c.creatorEmail}</p></div><div><span>平台流程状态</span><strong>{steps[c.stage].name}</strong><small>处理：{c.stage === 'sponsor' ? c.data.sponsorEmail : roleNames[steps[c.stage].role]}</small><small>BMP对接状态：{c.bmp.integrationStatus === 'synced' ? '已同步' : c.bmp.integrationStatus === 'error' ? '同步异常' : c.bmp.integrationStatus === 'pending_sync' ? '待同步' : '待IT确认契约'}</small><small>BMP正式状态：{c.bmp.bmpOfficialStatus || '未同步'}{c.bmp.bmpWorkflowInstanceId && ` · ${c.bmp.bmpWorkflowInstanceId}`}</small>{c.bmp.budgetReceiptId && <small>BMP预算回执：{c.bmp.budgetReceiptStatus} · {c.bmp.budgetReceiptId}</small>}{c.bmp.settlementReceiptId && <small>BMP收口回执：{c.bmp.settlementStatus} · {c.bmp.settlementReceiptId}</small>}</div></header>
    <nav className="rw-business-chain" aria-label="科研业务单据链">{businessChain(c).map(node => <button key={node.key} className={node.state} onClick={() => { if (node.kind) { setKind(node.kind); setView('documents'); } else setView(node.key === 'execution' ? 'milestones' : node.key === 'demand' || node.key === 'project' ? 'facts' : 'current'); }}><span className="rw-chain-dot" /><strong>{node.name}</strong><b>{node.count}</b><small>{node.state === 'done' ? '已形成记录' : node.state === 'current' ? '当前办理' : node.state === 'optional' ? '按需，不强制' : '待办理'}</small></button>)}</nav>
    <p className="rw-chain-note">横向链路是业务全景，不是另建一套财务系统。合同、报价、订单、预算、付款和正式审批只登记BMP/ERP编号与回执，以源系统为准。</p>
    <nav className="rw-subtabs">{[['current', '当前办理'], ['facts', '需求与建档'], ['milestones', '节点与中心'], ['progress', '月度进展'], ['files', '资料索引'], ['documents', 'BMP单据引用'], ['history', '操作与历史']].map(([id, name]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{name}</button>)}</nav>
    {alerts(c).length > 0 && <div className="rw-warnings">{alerts(c).map(a => <p key={a}>{a}</p>)}</div>}
    {view === 'current' && <div className="rw-current-grid"><form className="rw-card" onSubmit={submit}>
      <div className="rw-section-title"><h3>{steps[c.stage].name}</h3>{mode === 'demo' && <div><button type="button" onClick={() => { setData(d => ({ ...d, ...demoData(c.route) })); setStakeholders(demoStakeholderInputs()); }}>填入演练值</button>{!enabled && <button type="button" onClick={() => onRole(steps[c.stage].role)}>切换为当前处理角色</button>}</div>}</div><p>{steps[c.stage].help}</p>
      {!enabled && <p className="rw-muted">当前账号无此节点办理权限，资料仅供查看。</p>}
      {!['draft', 'returned', 'reserve'].includes(c.stage) && <StakeholderSummary stakeholders={c.stakeholders || []} />}
      <div className="rw-form-grid">
        {['draft', 'returned', 'reserve'].includes(c.stage) && <label className="rw-wide"><span>从BMP医院主数据选择（B类纯内部项目可不选）</span><select value={data.customerId || ''} disabled={!enabled} onChange={e => { const customer = customers.find(x => x.id === e.target.value); setStakeholders([]); setData(d => customer ? ({ ...d, customerId: customer.id, hospital: customer.name, region: customer.region }) : ({ ...d, customerId: '', hospital: '', region: '' })); }}><option value="">不关联医院 / 请选择医院</option>{customers.map(x => <option key={x.id} value={x.id}>{x.name} / {x.id}</option>)}</select><small>切换医院会清空已选关键人员，防止人员串院；部门工作区只接受BMP/CRM同步主数据。</small></label>}
        {['draft', 'returned', 'reserve'].includes(c.stage) && data.customerId && <StakeholderEditor customerId={data.customerId} contacts={contacts} value={stakeholders} onChange={setStakeholders} disabled={!enabled} />}
        {fieldsFor({ ...c, data }).map(field => field.key === 'budgetId' ? <label key={field.key}><span>医院预算包 *</span><select value={data.budgetId || ''} disabled={!enabled} onChange={e => change('budgetId', e.target.value)}><option value="">选择对应医院预算包</option>{budgetRows.filter(b => b.customerId === c.data.customerId).map(b => <option key={b.id} value={b.id}>{b.id} · 可用 {money(available(b))} 元</option>)}</select></label> : <FieldInput key={field.key} field={field} value={data[field.key] || ''} onChange={value => change(field.key, value)} disabled={!enabled || (mode === 'live' && (['customerId', 'hospital', 'region'].includes(field.key) || field.key.startsWith('bmp')))} />)}
      </div>
      {canMoney && !['draft', 'intake'].includes(c.stage) && <p className="rw-money">评估总成本：{cost({ ...c, data })} 元 · 部门成本预测基线：{money(c.costForecastCents)} 元 <small>（用于投入复盘；不扣减BMP余额）</small></p>}
      {c.stage === 'launch' && <p className="rw-tip">启动前请在“节点与中心”页签补齐计划日期、负责人、验收标准，再回到这里提交启动。</p>}
      {c.stage === 'execution' && <p className="rw-tip">请在“节点与中心”中提交和验收每个节点，再申请最终验收。</p>}
      {['waiting', 'paused'].includes(c.stage) && <p>等待事项：{c.waitReason}；责任人：{c.waitOwner}；恢复条件：{c.resumeCondition}</p>}
      {enabled && !['closed', 'terminated', 'archived', 'waiting', 'paused'].includes(c.stage) && <><label className="rw-note"><span>本次部门协同意见</span><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="说明本节点结论、需要补充什么或下一步动作" /></label><div className="rw-actions"><button value="save" disabled={busy}>保存本节点</button><button className="rw-primary" value="advance" disabled={busy}>{c.stage === 'draft' || c.stage === 'returned' || c.stage === 'reserve' ? '提交需求' : c.stage === 'execution' ? '申请部门交付验收' : c.stage === 'settlement' ? '记录成本并收口' : '完成本节点 / 下一步'}</button></div></>}
      <div className="rw-secondary-actions">{[['return', '退回补充'], ['reserve', '转需求储备'], ['reject', '拒绝需求'], ['pause', '等待客户 / 暂停'], ['resume', '恢复执行'], ['change', '发起变更'], ['terminate', '申请终止'], ['archive', '归档']].filter(([action]) => permittedSecondary(action)).map(([action, title]) => <button type="button" key={action} disabled={busy} onClick={() => setSpecial(action)}>{title}</button>)}</div>
      {special && <fieldset className="rw-special"><legend>{actionNames[special]}</legend><p>所有操作校验角色及当前状态；变更后重新评估，原部门基线、历史快照和成本预测保留。</p>{special === 'change' && data.customerId && <><p>如本次涉及医院负责人、对接人或重要程度变化，请在这里更新；旧项目快照仍保留。</p><StakeholderEditor customerId={data.customerId} contacts={contacts} value={stakeholders} onChange={setStakeholders} /></>}<textarea aria-label="操作原因" value={note} onChange={e => setNote(e.target.value)} placeholder="必须填写原因" />{['return', 'reserve'].includes(special) && <><input aria-label="补充截止日" type="date" value={data.supplementBy || ''} onChange={e => change('supplementBy', e.target.value)} /><input aria-label="下一步责任人" type="email" placeholder="下一步责任人邮箱" value={data.nextOwner || ''} onChange={e => change('nextOwner', e.target.value)} /></>}{special === 'pause' && <><select value={data.waiting || '是'} onChange={e => change('waiting', e.target.value)}><option value="是">等待客户</option><option value="否">内部暂停</option></select><input aria-label="等待责任人" placeholder="客户 / 等待事项责任人" value={data.waitOwner || ''} onChange={e => change('waitOwner', e.target.value)} /><input aria-label="恢复条件" placeholder="恢复条件" value={data.resumeCondition || ''} onChange={e => change('resumeCondition', e.target.value)} /></>}<button type="button" disabled={busy || !note} onClick={() => void onCommand({ action: special as Command['action'], note, data, ...(special === 'change' ? { stakeholders } : {}) })}>确认操作</button><button type="button" onClick={() => setSpecial('')}>取消</button></fieldset>}
    </form><aside className="rw-card rw-steps"><h3>协同节点与职责</h3><ol>{routeStages(c).map(stage => <li key={stage} className={c.stage === stage ? 'current' : c.decisions.some(d => d.stage === stage) ? 'done' : ''}><strong>{steps[stage].name}</strong><small>{roleNames[steps[stage].role]}</small></li>)}</ol><p>预算内月度A类在营销节点可批量形成部门预审；B/C按条件加载专业意见。公司级审批仍在BMP。</p></aside></div>}
    {view === 'facts' && <section className="rw-card"><h3>需求事实与七项执行承诺</h3><StakeholderSummary stakeholders={c.stakeholders || []} /><div className="rw-facts">{[...demandFields, ...steps.commitment.fields].filter(f => c.data[f.key]).map(f => <div key={f.key}><span>{f.label}</span><p>{c.data[f.key]}</p></div>)}</div><p>已确认的范围、关键人员、样本、预算引用和日期不可直接覆盖；请在“当前办理”发起变更。完整历史见“操作与历史”。</p><button onClick={() => setView('current')}>进入当前办理</button></section>}
    {view === 'milestones' && <section className="rw-card"><h3>节点计划与交付验收</h3><p>计划在部门启动前锁定。完成日期由系统记录，节点负责人提交、指定验收人确认；B类产品方向由Sponsor确认。</p>{!milestones.length && <p className="rw-empty">部门项目建档后自动生成本路线节点模板。</p>}
      {milestones.map((m, i) => <article key={m.id} className="rw-milestone"><h4>{m.name} <span>{m.acceptedAt ? '已验收' : m.submittedAt ? '待验收' : '待交付'}</span></h4>{c.stage === 'launch' && enabled ? <div className="rw-form-grid">{[{ key: 'plannedDate', label: '计划完成日', type: 'date' }, { key: 'owner', label: '节点负责人邮箱', type: 'email' }, { key: 'acceptor', label: '验收人邮箱', type: 'email' }, { key: 'standard', label: '预期交付物 / 验收标准', type: 'text' }].map(f => <FieldInput key={f.key} field={f as Field} value={String(m[f.key as keyof typeof m] || '')} onChange={v => setMilestones(list => list.map((x, n) => n === i ? { ...x, [f.key]: v } : x))} disabled={Boolean(m.acceptedAt)} />)}</div> : <p>计划：{m.plannedDate || '待制定'} · 负责人：{m.owner} · 验收：{m.acceptor}<br />标准：{m.standard || '待制定'}{m.acceptedAt && <><br />实际验收：{dateTime(m.acceptedAt)}</>}</p>}{m.evidence && <p>交付物：{m.evidence}</p>}{c.stage === 'execution' && !m.acceptedAt && <MilestoneActions c={c} milestoneId={m.id} busy={busy} onCommand={onCommand} />}</article>)}
      {c.stage === 'launch' && enabled && <div className="rw-actions"><button onClick={() => setMilestones(list => [...list, { id: crypto.randomUUID(), name: '自定义节点', owner: c.data.managerEmail, acceptor: c.data.acceptorEmail, plannedDate: '', standard: '', evidence: '', overdueReason: '', correction: '' }])}>＋ 自定义节点</button>{mode === 'demo' && <button onClick={() => setMilestones(list => list.map(m => ({ ...m, plannedDate: c.data.deadline, owner: 'technical@example.test', acceptor: c.route === 'B' && m.name.includes('产品决策') ? 'sponsor@example.test' : 'pmo@example.test', standard: '演练交付完整、结果可复核' })))}>填入演练计划</button>}<button disabled={busy} onClick={() => void onCommand({ action: 'save', data, milestones, centers })}>保存节点与中心计划</button></div>}
      <h3>中心子项目 · 不重复计算主项目</h3><p>这里的负责人是亿康内部执行责任人；医院端负责人和对接人在上方“医院关键人员”中维护。</p><div className="rw-table-wrap"><table><thead><tr><th>CRM医院编号 / 中心</th><th>我方中心执行负责人</th><th>当前情况</th><th>样本量</th><th>伦理 / 合同依据</th></tr></thead><tbody>{centers.map((center, i) => <tr key={center.id}><td>{center.name}<small>{center.customerId}</small></td><td>{c.stage === 'launch' ? <input aria-label="我方中心执行负责人邮箱" value={center.owner} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, owner: e.target.value } : x))} /> : center.owner}</td><td>{c.stage === 'launch' ? <input aria-label="中心当前情况" value={center.status} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, status: e.target.value } : x))} /> : center.status}</td><td>{c.stage === 'launch' ? <input aria-label="中心样本量" type="number" min="0" value={center.sampleCount} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, sampleCount: Number(e.target.value) } : x))} /> : center.sampleCount}</td><td>{c.stage === 'launch' ? <><input aria-label="中心伦理依据" placeholder="伦理依据 / 不适用原因" value={center.ethics} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, ethics: e.target.value } : x))} /><input aria-label="中心合同依据" placeholder="合同依据 / 不适用原因" value={center.contract} onChange={e => setCenters(list => list.map((x, n) => n === i ? { ...x, contract: e.target.value } : x))} /></> : `${center.ethics || '待补'} / ${center.contract || '待补'}`}</td></tr>)}</tbody></table></div>{c.stage === 'launch' && enabled && <select value="" aria-label="增加中心" onChange={e => { const customer = customers.find(x => x.id === e.target.value); if (customer && !centers.some(x => x.customerId === customer.id)) setCenters(list => [...list, { id: customer.id, customerId: customer.id, name: customer.name, owner: c.data.managerEmail, status: '待启动', ethics: '', contract: '', sampleCount: 0 }]); }}><option value="">＋ 从CRM医院主数据增加中心</option>{customers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
    </section>}
    {view === 'documents' && <section className="rw-card"><div className="rw-section-title"><h3>BMP / ERP单据与回执引用</h3><select aria-label="单据类别" value={kind} onChange={e => setKind(e.target.value as DocumentKind)}>{Object.entries(documentNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div><p>本平台只登记外部单据ID、资料与核验结果。无BMP流程实例ID或财务回执，不得展示为公司级审批、付款或出库完成。</p>
      {kind === 'payment' && c.route === 'A' && <div className="rw-money">BMP预算包：{canMoney ? c.budgetId || '待关联' : '按权限显示'} · 部门成本预测基线：{canMoney ? money(c.costForecastCents) + ' 元' : '按权限显示'}（不扣减BMP余额）</div>}
      {docs.map(d => <article key={d.id} className="rw-document"><h4>{d.title} <span>{d.status === 'verified' ? '外部引用已核验' : d.status === 'returned' ? '信息退回补充' : '待核验'}</span></h4><p>{d.applicant} · {dateTime(d.createdAt)}{canMoney && d.amount && ` · ${d.amount}元`}</p><p>{d.note}</p><p>外部单据编号：{d.reference || '待提供'} · 资料：<EvidenceLink value={d.evidence} /></p>{d.reviewNote && <p>核验：{d.reviewer} · {d.reviewNote}</p>}{d.status === 'submitted' && <form className="rw-inline-form" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); void onCommand({ action: 'review_document', note: String(fd.get('reviewNote')), data: { documentId: d.id, decision: String(fd.get('decision')) } }); }}><input name="reviewNote" required placeholder="核验说明 / 退回原因" /><select name="decision"><option value="verified">外部引用有效</option><option value="returned">退回补充</option></select><button disabled={busy}>提交核验</button><small>{kind === 'resource' ? '研发 / 执行' : kind === 'summary' ? '学术PMO' : '商务 / 财务'}权限；只核验编号和证据，不代表源系统审批通过</small></form>}</article>)}
      {kind === 'expense' && c.decisions.some(d => d.stage === 'settlement') && <article className="rw-document"><h4>项目成本归集记录（部门流程生成）</h4><p>{canMoney ? `实际成本 ${c.data.actualCost} 元；客户收入 ${c.data.revenue} 元` : '费用金额按权限显示'}</p><p>BMP核销 / 回款：{c.bmp.settlementReceiptId ? `${c.bmp.settlementStatus} · ${c.bmp.settlementReceiptId}` : '待已验收接口回传'} · 归档：<EvidenceLink value={c.data.archiveEvidence || ''} /></p></article>}
      {kind === 'summary' && c.decisions.some(d => d.stage === 'acceptance') && <article className="rw-document"><h4>部门交付验收记录</h4><p>{c.data.outcomes}</p><p>验收资料：<EvidenceLink value={c.data.acceptanceEvidence || ''} /></p><p>后续安排：{c.data.followUp}</p></article>}
      {!docs.length && <p className="rw-empty">尚无{documentNames[kind]}关联记录。不适用时不需补假单据。</p>}
      {c.projectNo && !['closed', 'terminated', 'archived'].includes(c.stage) && <form className="rw-document-form" onSubmit={e => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.currentTarget)) as Data; void onCommand({ action: 'submit_document', data: { ...fd, kind } }); }}><h4>＋ 登记{documentNames[kind]}外部单据</h4><div className="rw-form-grid"><label>单据名称<input name="title" required /></label><label>金额（付款 / 核销必填）<input name="amount" type="number" min="0" step="0.01" /></label><label>BMP / 合同 / ERP唯一编号<input name="reference" required={['contract', 'quote', 'order', 'payment', 'expense'].includes(kind)} /></label><label>回执或资料链接<input name="evidence" required placeholder="https://… 或 /科研资料/…" /></label><label className="rw-wide">用途与关联说明<textarea name="note" required /></label></div><button disabled={busy}>登记外部单据</button></form>}
    </section>}
    {view === 'progress' && <section className="rw-card"><h3>项目月度进展</h3><p>按月记录完成事项、下一步、风险和跨部门支持需求，便于向研发、产品和销售同步。</p>{c.updates.map(update => <article className="rw-document" key={update.id}><h4>{update.period} <span>{update.author} · {dateTime(update.at)}</span></h4><p><b>本期完成：</b>{update.summary}</p><p><b>下一步：</b>{update.nextAction}</p>{update.risk && <p><b>风险：</b>{update.risk}</p>}{update.supportNeeded && <p><b>需支持：</b>{update.supportNeeded}</p>}</article>)}{!c.updates.length && <p className="rw-empty">暂无月度进展。</p>}{c.projectNo && !['closed', 'terminated', 'archived'].includes(c.stage) && <form className="rw-document-form" onSubmit={e => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.currentTarget)) as Data; void onCommand({ action: 'post_update', data: fd }); }}><div className="rw-form-grid"><label>进展月份<input name="period" type="month" defaultValue={new Date().toISOString().slice(0, 7)} required /></label><label>关联里程碑<select name="milestoneId" defaultValue=""><option value="">不指定</option>{c.milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="rw-wide">本期完成<textarea name="summary" required /></label><label className="rw-wide">下一步动作、责任人和日期<textarea name="nextAction" required /></label><label>风险 / 卡点<textarea name="risk" /></label><label>需要谁提供什么支持<textarea name="supportNeeded" /></label></div><button className="rw-primary" disabled={busy}>发布进展</button></form>}</section>}
    {view === 'files' && <section className="rw-card"><h3>企业微信微盘 / 云盘资料索引</h3><p>文件正文仍留在原受控资料库；中台只保存外部文件ID、路径、版本和业务关联，不重复上传。</p>{c.files.map(file => <article className="rw-document" key={file.id}><h4>{file.title} <span>{file.current ? '当前版本' : '历史版本'} · {file.version}</span></h4><p>{file.category} · {file.addedBy} · {dateTime(file.addedAt)}</p><p><EvidenceLink value={file.location} />{file.externalFileId && ` · 外部ID：${file.externalFileId}`}</p>{file.note && <p>{file.note}</p>}{file.current && <button type="button" disabled={busy} onClick={() => void onCommand({ action: 'archive_file', data: { fileId: file.id } })}>标记为历史版本</button>}</article>)}{!c.files.length && <p className="rw-empty">尚无资料索引。</p>}<form className="rw-document-form" onSubmit={e => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.currentTarget)) as Data; void onCommand({ action: 'link_file', data: fd }); }}><div className="rw-form-grid"><label>资料分类<select name="category" required defaultValue=""><option value="">请选择</option>{projectFileCategories.map(category => <option key={category}>{category}</option>)}</select></label><label>文件 / 在线文档名称<input name="title" required /></label><label>企业微信微盘/云盘路径或链接<input name="location" required /></label><label>外部文件ID<input name="externalFileId" placeholder="用于改版识别和去重" /></label><label>版本<input name="version" defaultValue="v1" /></label><label>关联里程碑<select name="milestoneId" defaultValue=""><option value="">不指定</option>{c.milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="rw-wide">说明<textarea name="note" /></label></div><button className="rw-primary" disabled={busy}>保存资料索引</button></form></section>}
    {view === 'history' && <section className="rw-card"><h3>协同、操作与基线历史</h3><p>每一次部门操作都追加记录。旧基线只读，不能覆盖；金额和专业资料按当前账号权限显示。BMP正式审批记录须以流程实例和回执另行关联。</p><div className="rw-history">{history.map(h => <article key={h.id}><span>第{h.revision}次记录 · 基线{h.baseline}</span><strong>{actionNames[h.action] || h.action}：{steps[h.from].name} → {steps[h.to].name}</strong><p>{h.actor} · {dateTime(h.at)}</p>{h.note && <p>{h.note}</p>}{h.snapshot && <button onClick={() => setSelectedRevision(selectedRevision === h.revision ? null : h.revision)}>查看该版本</button>}{selectedRevision === h.revision && h.snapshot && <pre>{JSON.stringify({ projectNo: h.snapshot.projectNo, stakeholders: h.snapshot.stakeholders, data: h.snapshot.data, decisions: h.snapshot.decisions, milestones: h.snapshot.milestones }, null, 2)}</pre>}</article>)}</div>{!history.length && <p>尚无流转记录，提交需求后开始记录。</p>}</section>}
  </section>;
}

function StakeholderEditor({ customerId, contacts, value, onChange, disabled }: { customerId: string; contacts: CustomerContact[]; value: StakeholderInput[]; onChange: (value: StakeholderInput[]) => void; disabled?: boolean }) {
  const profiles = contacts.filter(contact => contact.customerId === customerId && contact.status === 'active');
  const update = (role: StakeholderRole, patch: Partial<StakeholderInput>) => {
    const old = value.find(item => item.role === role) || { role, contactId: '', importance: role === 'hospital_project_lead' ? '核心决策' : '执行协同', importanceBasis: '', responsibility: '' } satisfies StakeholderInput;
    const next = { ...old, ...patch };
    onChange([next, ...value.filter(item => item.role !== role)].filter(item => item.contactId));
  };
  return <div className="rw-stakeholder-editor rw-wide"><div className="rw-stakeholder-heading"><strong>医院关键人员</strong><small>人员主档来自BMP；重要程度、本项目责任和判断依据是项目快照，不反写BMP。</small></div>{profiles.length ? <div className="rw-stakeholder-grid">{(Object.keys(stakeholderRoleNames) as StakeholderRole[]).map(role => { const item = value.find(person => person.role === role), profile = profiles.find(person => person.id === item?.contactId); return <article key={role}><h4>{stakeholderRoleNames[role]} *</h4><label>选择BMP医院人员<select value={item?.contactId || ''} disabled={disabled} onChange={event => update(role, { contactId: event.target.value })}><option value="">请选择</option>{profiles.map(contact => <option key={contact.id} value={contact.id}>{contact.name} · {contact.department} · {contact.jobTitle}</option>)}</select></label>{profile && <p className="rw-profile-brief"><strong>{profile.name}</strong> · {profile.professionalTitle || profile.jobTitle}<br />{profile.researchBackground}<br /><span>专长：{profile.expertise.join('、') || '待BMP补充'} · 源快照第{profile.revision}版</span></p>}<label>本项目重要程度<select value={item?.importance || ''} disabled={disabled} onChange={event => update(role, { importance: event.target.value as StakeholderInput['importance'] })}><option value="">请选择</option>{stakeholderImportanceLevels.map(level => <option key={level}>{level}</option>)}</select></label><label>在本项目中的具体责任<textarea rows={2} value={item?.responsibility || ''} disabled={disabled} onChange={event => update(role, { responsibility: event.target.value })} placeholder="例如：确认研究目标、协调样本或负责日常进度" /></label><label>重要程度判断依据<textarea rows={2} value={item?.importanceBasis || ''} disabled={disabled} onChange={event => update(role, { importanceBasis: event.target.value })} placeholder="写客观职责或决策范围，不写关系好坏" /></label></article>; })}</div> : <p className="rw-empty">该医院暂无BMP有效联系人快照。请先在BMP维护联系人，再由IT同步；不在本平台重复创建。</p>}{value.length === 2 && value[0].contactId === value[1].contactId && <p className="rw-tip">当前由同一人兼任两个角色；系统会分别保存两项项目责任和依据。</p>}</div>;
}

function StakeholderSummary({ stakeholders }: { stakeholders: CaseStakeholder[] }) {
  if (!stakeholders.length) return <div className="rw-stakeholder-summary"><strong>医院关键人员</strong><p>尚未关联；纯内部B类可不填，涉及医院的项目必须在提交前补齐。</p></div>;
  return <div className="rw-stakeholder-summary"><div className="rw-stakeholder-heading"><strong>医院关键人员 · 当前项目快照</strong><small>联系人主档后续更新不会自动改写本次需求评估与责任依据。</small></div><div className="rw-stakeholder-grid">{stakeholders.map(person => <article key={person.role}><h4>{stakeholderRoleNames[person.role]} <span>{person.importance}</span></h4><p><strong>{person.profileSnapshot.name}</strong> · {person.profileSnapshot.department} · {person.profileSnapshot.jobTitle}{person.profileSnapshot.professionalTitle && ` / ${person.profileSnapshot.professionalTitle}`}</p><p>{person.profileSnapshot.researchBackground}</p><p><b>项目责任：</b>{person.responsibility}<br /><b>重要程度依据：</b>{person.importanceBasis}</p><small>档案第{person.profileRevision}版 · {dateTime(person.confirmedAt)}确认</small></article>)}</div></div>;
}

function ContactPanel({ contacts, customers, mode }: { contacts: CustomerContact[]; customers: Customer[]; mode: 'demo' | 'live' }) {
  const [customerId, setCustomerId] = useState('all');
  const visibleRows = contacts.filter(contact => customerId === 'all' || contact.customerId === customerId);
  return <section className="rw-card"><div className="rw-section-title"><div><h2>BMP客户与联系人（只读）</h2><p>客户名称、医院归属、联系人姓名和科室只在BMP维护，本平台不设第二个编辑入口。</p></div><select aria-label="按医院筛选联系人" value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="all">全部医院</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div><p className="rw-tip">{mode === 'demo' ? '当前为虚拟快照，只用于流程预览。' : '本页设计为BMP主数据的只读缓存；在接口及同步时间未验证前，不能视为BMP实时数据。项目只补充“医院端项目负责人/日常对接人”的项目责任和当时快照，不反向改写BMP。'}</p><div className="rw-table-wrap"><table><thead><tr><th>医院 / 姓名</th><th>科室与职务</th><th>可用专业信息</th><th>BMP状态 / 同步版本</th></tr></thead><tbody>{visibleRows.map(contact => <tr key={contact.id}><td>{contact.name}<small>{contact.hospital} · {contact.bmpContactId || 'BMP联系人ID待映射'}</small></td><td>{contact.department}<small>{contact.jobTitle}{contact.professionalTitle && ` · ${contact.professionalTitle}`}</small></td><td>{contact.researchBackground || '待BMP提供'}<small>{contact.expertise.join('、') || '无专长标签'}</small></td><td>{contact.status === 'active' ? '有效' : '已停用'}<small>{new Date(contact.verifiedAt).toLocaleDateString('zh-CN')} · 第{contact.revision}版</small></td></tr>)}</tbody></table>{!visibleRows.length && <p className="rw-empty">BMP联系人尚未同步或当前账号无权查看。请先在BMP维护，再由IT同步；不在本平台重复新建。</p>}</div></section>;
}

function MilestoneActions({ c, milestoneId, busy, onCommand }: { c: Case; milestoneId: string; busy: boolean; onCommand: (cmd: Omit<Command, 'expectedRevision'>) => Promise<void> }) {
  const m = c.milestones.find(m => m.id === milestoneId)!;
  return <form className="rw-inline-form" onSubmit={e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)) as Data; const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') as Command['action']; void onCommand({ action, milestoneId, data, note: data.note }); }}><input name="evidence" defaultValue={m.evidence} placeholder="交付物链接 / 云盘路径" /><input name="overdueReason" placeholder="逾期原因（如有）" /><input name="correction" placeholder="纠偏措施（如有）" /><input name="note" placeholder="验收结论 / B类继续或调整决策" /><button value="submit_milestone" disabled={busy}>负责人提交</button><button value="accept_milestone" disabled={busy || !m.submittedAt}>验收人确认</button></form>;
}

function BudgetPanel({ budgets, mode }: { budgets: Budget[]; mode: 'demo' | 'live' }) {
  return <section className="rw-card"><h2>BMP预算包快照（只读）</h2><p>预算包总额、已用、正式锁定、额度调整和核销以BMP/财务系统为唯一口径。本平台只读已核验快照，项目成本预测仅留在项目记录中，不扣减BMP余额。</p><p className="rw-tip">{mode === 'demo' ? '当前是虚拟预算，只用于流程预览。' : '本页不提供额度调整、锁定、释放或核销入口。接口未验收、无BMP外部对象ID或快照未核验时，不展示为可用预算。'}</p><div className="rw-table-wrap"><table><thead><tr><th>医院 / 预算包</th><th>期间</th><th>BMP总额（元）</th><th>BMP已用</th><th>BMP已锁定</th><th>BMP快照可用</th><th>源快照</th></tr></thead><tbody>{budgets.map(b => <tr key={b.id}><td>{b.hospital}<small>{b.externalObjectId}</small></td><td>{b.period}</td><td>{money(b.totalCents)}</td><td>{money(b.usedCents)}</td><td>{money(b.lockedCents)}</td><td>{money(available(b))}</td><td>{b.sourceSystem === 'demo' ? '演练快照' : 'BMP已核验'}<small>{b.evidence || '回执待同步'} · {new Date(b.sourceUpdatedAt).toLocaleString('zh-CN')}</small></td></tr>)}</tbody></table></div>{!budgets.length && <p className="rw-empty">暂无已核验预算快照。请由IT从BMP同步，不在本平台手工补录批准额度。</p>}</section>;
}

function ItPanel() {
  return <section className="rw-card rw-it"><h2>定位：BMP主系统的学术支持部业务工作台</h2><p>本平台不重建BMP。它补齐学术支持部的需求评估、专业协同、项目执行、资料索引、成果复盘和AI辅助；跨部门正式审批、预算、合同、付款仍回到BMP/ERP。</p><div className="rw-route-grid">{[['BMP主系统', '客户 / 联系人 / 销量 / 预算包 / 正式审批', '这些是公司级事实和唯一口径，本平台只读、引用或接收回执。'], ['学术支持平台', '需求评估 / 成本测算 / 项目协同 / 进展 / 成果', '项目责任快照、部门执行基线和专业资料由本平台维护。'], ['微盘 / NAS', '文件正文 / 在线文档 / 版本与权限', '文件留在受控资料库，本平台只存文件ID、路径、版本和业务关联。']].map(([key, chain, note]) => <article key={key}><h3>{key}</h3><strong>{chain}</strong><p>{note}</p></article>)}</div>
    <h3>科研流程怎么分</h3><p>A/B/C三类评估路线在本平台先把需求、医院端项目负责人和日常对接人、可行性、成本、风险、交付物及责任人说清；需要公司级授权时创建或关联BMP流程。只有BMP返回对象ID、流程实例ID和回执后，才显示“BMP已批准/已执行”。</p>
    <h3>本期可运行</h3><p>部门需求登记、医院关键人员项目快照、A/B/C动态评估、成本汇总与预测基线、七项执行基线、外部单据引用核验、节点计划/交付/验收、月度进展、资料索引、变更/等待/终止、中心子项目、查询与Excel草稿导入、历史版本及站内风险提醒。客户联系人与预算包页面均为只读。</p>
    <h3>当前尚未接通</h3><p>BMP的真实技术栈、OpenAPI、SSO、流程引擎接口、对象编号和回调规则尚未验证；现有适配器只是接口骨架，待对接事件默认不外发。因此当前部门状态不能冒充BMP状态。</p>
    <h3>IT会议需一次性确认</h3><ol><li>BMP账号、组织、角色、大区和团队映射，以及SSO/退出/会话失效方式。</li><li>客户、医院、联系人、销量、预算、历史科研项目的唯一ID、字段字典、合并停用规则和增量接口。</li><li>科研立项与管理现有流程的节点、必填、审批日志、流程实例ID和可扩展方式。</li><li>报价、订单、合同、预算、付款、报销、ERP与研发项目编号的对象关系和回执接口。</li><li>写入权限、幂等键、版本冲突、重试、回调签名、审计日志、测试环境及数据脱敏要求。</li><li>微盘/NAS文件ID、深链、权限继承、版本历史和失效校验接口。</li></ol>
    <h3>独立开发与同步约定</h3><p>业务模块独立开发但共享导航、身份和审计。对接以稳定HTTP/JSON契约、统一ID、状态、版本、幂等和回执为准，不要求两边使用相同编程语言。历史BMP数据先进入只读暂存与对照，不能直接赋成平台流程已完成。</p>
    <a href="/api/research/handoff">下载IT交付说明与接口约定</a>
  </section>;
}
