import test from 'node:test';
import assert from 'node:assert/strict';
import { demoActor, demoBudgets, demoData, demoPolicy } from './demo.ts';
import { steps } from './definition.ts';
import { alerts, batchEligible, canAct, newCase, redact, transition, visible } from './workflow.ts';
import { cents, isDate, type Case, type Command, type Data, type Role, type Route } from './model.ts';

const now = Date.now();
function fresh(route: Route = 'A') { return newCase(`case-${route}`, `REQ-${route}`, demoActor('applicant'), now, demoData(route), route); }
function apply(c: Case, action: Command['action'] = 'advance', data = demoData(c.route), role: Role = steps[c.stage].role, extra: Partial<Command> = {}) {
  return transition(c, { action, data, expectedRevision: c.revision, ...extra }, { actor: demoActor(role), now: now + c.revision * 1000, policy: demoPolicy, budget: { ...demoBudgets[0], lockedCents: c.reservedCents }, projectNo: `YKSR-${c.route}-TEST` });
}
function reach(stage: Case['stage'], route: Route = 'A') {
  let c = fresh(route); let count = 0;
  while (c.stage !== stage) { if (++count > 30) throw new Error(`Unable to reach ${stage} from ${c.stage}`); c = apply(c); }
  return c;
}
function launch(route: Route = 'A') {
  let c = reach('launch', route);
  if (route === 'C') {
    c = apply(c, 'submit_document', { kind: 'contract', title: '测试合同', evidence: '/test/contract', note: '合同已签订' }, 'pmo');
    c = apply(c, 'review_document', { documentId: c.documents[0].id, decision: 'approved' }, 'finance', { note: '财务核对通过' });
  }
  return apply(c, 'advance', demoData(route), 'pmo', { milestones: c.milestones.map(m => ({ ...m, plannedDate: c.data.deadline, standard: '数据完整', owner: 'technical@example.test', acceptor: route === 'B' && m.name.includes('产品决策') ? 'sponsor@example.test' : 'pmo@example.test' })) });
}

test('金额按分处理，不接受负值、未知值和非数字', () => { assert.equal(cents('0.29'), 29); assert.equal(cents('123.4'), 12340); for (const invalid of ['', '-1', 'NaN', '2.001', '1e8']) assert.throws(() => cents(invalid)); });
test('无效日期不会异常绕过校验', () => { assert.equal(isDate('2026-02-30'), false); assert.equal(isDate('2026-99-88'), false); assert.equal(isDate('2028-02-29'), true); });
test('需求不直接生成正式编号', () => { const c = apply(fresh()); assert.equal(c.stage, 'intake'); assert.equal(c.projectNo, null); });
test('紧急需求缺原因不可提交', () => { const c = fresh(); assert.throws(() => apply(c, 'advance', { ...c.data, channel: '紧急插单', urgentReason: '', cannotWait: '' }), /紧急/); });
test('月度需求缺月份不可提交', () => assert.throws(() => apply(fresh(), 'advance', { ...demoData(), targetMonth: '' }), /月份/));
test('B类缺Sponsor不得进入流程', () => assert.throws(() => apply(fresh('B'), 'advance', { ...demoData('B'), sponsorEmail: '' }), /Sponsor/));
test('C类严格产品先于研发', () => { const c = reach('technical', 'C'); assert.ok(c.decisions.some(d => d.stage === 'product')); assert.ok(c.decisions.some(d => d.stage === 'c_region')); assert.throws(() => apply({ ...c, decisions: c.decisions.filter(d => d.stage !== 'product') }), /产品/); });
test('非技术角色不能提交研发判断', () => assert.throws(() => apply(reach('technical'), 'advance', demoData(), 'pmo'), /对应角色/));
test('不可行结论不能继续审批', () => assert.throws(() => apply(reach('technical'), 'advance', { ...demoData(), feasibility: '不可行' }), /不可行/));
test('成本未知不能假补零', () => assert.throws(() => apply(reach('costing'), 'advance', { ...demoData(), paperCost: '' }), /论文/));
test('预算包医院必须匹配', () => { const c = reach('budget'); assert.throws(() => transition(c, { action: 'advance', data: demoData(), expectedRevision: c.revision }, { actor: demoActor('budget'), now, policy: demoPolicy, budget: { ...demoBudgets[0], customerId: 'OTHER' } }), /不匹配/); });
test('额度不足不得锁定或透支', () => { const c = reach('marketing'); assert.throws(() => transition(c, { action: 'advance', data: demoData(), expectedRevision: c.revision }, { actor: demoActor('marketing'), now, policy: demoPolicy, budget: { ...demoBudgets[0], totalCents: 100 } }), /预算不足/); });
test('A类七项承诺前必须锁预算', () => { const c = reach('commitment'); assert.equal(c.reservedCents, 1200000); assert.equal(c.projectNo, null); assert.throws(() => apply({ ...c, reservedCents: 0 }), /足额锁定/); });
test('任一立项承诺缺失都不能编号', () => { const c = reach('commitment'); for (const key of ['scope', 'sampleCommitment', 'executionDepartment', 'fundingSource', 'deliverables', 'deadline', 'managerEmail']) assert.throws(() => apply(c, 'advance', { ...demoData(), [key]: '' })); });
test('Sponsor必须匹配指定账号且PMO不能代批', () => { const c = reach('sponsor', 'B'); assert.throws(() => apply(c, 'advance', demoData('B'), 'pmo'), /指定Sponsor/); const actor = { ...demoActor('sponsor'), demo: false, email: 'other@example.test' }; assert.equal(canAct(c, actor), false); });
test('B类内部项目不强制营销大区审批', () => { const c = reach('commitment', 'B'); assert.equal(c.decisions.some(d => d.stage === 'marketing' || d.stage === 'b_marketing' || d.stage === 'b_region'), false); });
test('重大B类项目触发大区和营销会签', () => { let c = reach('technical', 'B'); c = apply(c, 'advance', { ...demoData('B'), customerResources: '是', majorCommitment: '是' }); while (c.stage !== 'b_region') c = apply(c); assert.equal(apply(c).stage, 'b_marketing'); });
test('月度预算内A类才能批量审批', () => { const c = reach('marketing'); assert.equal(batchEligible(c, demoBudgets[0]), true); for (const patch of [{ channel: '紧急插单' }, { majorCommitment: '是' }, { overBudget: '是' }, { highRisk: '是' }] as Data[]) assert.equal(batchEligible({ ...c, data: { ...c.data, ...patch } }, demoBudgets[0]), false); });
test('不能在审批请求夹带修改他人专业意见或成本', () => { const c = reach('marketing'), n = apply(c, 'save', { ...demoData(), testCost: '1', feasibility: '不可行' }); assert.equal(n.data.testCost, c.data.testCost); assert.equal(n.data.feasibility, c.data.feasibility); });
test('过期批准不得启动', () => { const c = reach('launch'); c.decisions[0].validUntil = '2020-01-01'; assert.throws(() => apply(c), /有效期/); });
test('缺少节点计划不能启动', () => assert.throws(() => apply(reach('launch')), /节点/));
test('收费合同须有审核记录，不能只填一串编号', () => { const c = reach('launch', 'C'); assert.throws(() => apply(c, 'advance', demoData('C'), 'pmo', { milestones: c.milestones.map(m => ({ ...m, plannedDate: c.data.deadline, standard: '已确认' })) }), /合同/); });
test('节点不能在未启动时交付', () => assert.throws(() => apply(reach('launch'), 'submit_milestone', { evidence: '/test' }, 'technical', { milestoneId: 'M1' }), /未在执行/));
test('没有交付不能验收，没有验收不能结题', () => { const c = launch(); assert.throws(() => apply(c), /关键节点/); assert.throws(() => apply(c, 'accept_milestone', {}, 'pmo', { milestoneId: 'M1', note: '同意' }), /尚未提交/); });
test('节点负责人和验收人分别校验', () => { const c = launch(); assert.throws(() => apply(c, 'submit_milestone', { evidence: '/test' }, 'finance', { milestoneId: 'M1' }), /负责人/); });
test('逾期交付需要原因与纠偏措施', () => { const c = launch(); c.milestones[0].plannedDate = '2020-01-01'; assert.throws(() => apply(c, 'submit_milestone', { evidence: '/test' }, 'technical', { milestoneId: 'M1' }), /逾期/); });
test('等待客户暂停计时且显示30/60/90天提醒', () => { let c = launch(); c = apply(c, 'pause', { waiting: '是', waitOwner: '客户负责人', resumeCondition: '收到样本' }, 'pmo', { note: '等待补样' }); assert.equal(c.stage, 'waiting'); assert.equal(alerts(c, c.pausedAt! + 91 * 86400_000).filter(s => s.includes('等待客户')).length, 3); const n = transition(c, { action: 'resume', note: '样本已收到', expectedRevision: c.revision }, { actor: demoActor('pmo'), now: c.pausedAt! + 1000, policy: demoPolicy }); assert.equal(n.pausedMs, 1000); assert.equal(n.stage, 'execution'); });
test('C通路到期阻止继续操作并保留变更出口', () => { const c = launch('C'); c.data.transitionUntil = '2020-01-01'; assert.throws(() => apply(c, 'submit_milestone', { evidence: '/test' }, 'technical', { milestoneId: 'M1' }), /到期/); assert.equal(apply(c, 'change', {}, 'pmo', { note: '申请到期复审' }).stage, 'intake'); });
test('变更保留编号及占用，旧对象不可被覆盖', () => { const c = launch(), copy = JSON.stringify(c), next = apply(c, 'change', { sampleQuantity: '50' }, 'pmo', { note: '追加样本' }); assert.equal(JSON.stringify(c), copy); assert.equal(next.reservedCents, c.reservedCents); assert.equal(next.projectNo, c.projectNo); assert.equal(next.stage, 'intake'); assert.equal(next.decisions.length, 0); assert.equal(next.baseline, c.baseline); });
test('并发版本冲突不能覆盖审批', () => { const c = fresh(); assert.throws(() => transition(c, { action: 'advance', expectedRevision: 0, data: demoData() }, { actor: demoActor('applicant'), now, policy: demoPolicy }), /已更新/); });
test('已立项后不能靠退回需求绕过正式变更', () => { const c = reach('launch'); assert.throws(() => apply(c, 'return', {}, 'pmo', { note: '要求变更范围' }), /变更/); });
test('多中心按医院编号防重，标准节点不可被删除', () => { const c = reach('launch'), center = { id: 'site1', customerId: 'H1', name: '演练医院', owner: 'pmo@example.test', status: '待启动', ethics: '', contract: '', sampleCount: 10 }; assert.throws(() => apply(c, 'save', demoData(), 'pmo', { centers: [center, { ...center, id: 'site2' }] }), /重复/); assert.throws(() => apply(c, 'save', demoData(), 'pmo', { milestones: [] }), /不可删除/); });
test('已执行项目终止先核销，不自动释放已发生费用', () => { const c = launch(), next = apply(c, 'terminate', {}, 'pmo', { note: '客户取消' }); assert.equal(next.stage, 'settlement'); assert.equal(next.reservedCents, c.reservedCents); const done = apply(next, 'advance', demoData(), 'finance'); assert.equal(done.stage, 'terminated'); assert.equal(done.reservedCents, 0); });
test('实际成本超批准预算必须变更', () => { const c = apply(launch(), 'terminate', {}, 'pmo', { note: '终止' }); assert.throws(() => apply(c, 'advance', { ...demoData(), actualCost: '999999' }, 'finance'), /超过/); });
test('销售看不到内部成本和战略方案，包括单据金额', () => { const c = launch('B'); const actor = { ...demoActor('applicant'), demo: false }; c.creatorEmail = actor.email; c.documents.push({ id: 'x', title: '内部采购', status: 'approved', kind: 'payment', amount: '30000', applicant: 'finance@example.test', createdAt: now, reference: 'SECRET', evidence: '/internal', note: '成本30000' }); const safe = redact(c, actor); assert.equal(safe.data.testCost, undefined); assert.equal(safe.data.strategicGoal, undefined); assert.equal(safe.documents[0].amount, ''); assert.equal(safe.documents[0].reference, ''); });
test('外部账号和跨区域账号不具有项目读取权限', () => { const c = fresh(); assert.equal(visible(c, { ...demoActor('applicant'), email: 'unknown@example.test', id: 'unknown', team: 'other', demo: false, regions: [], roles: [] }), false); assert.equal(visible(c, { ...demoActor('regional'), email: 'other@example.test', team: 'other', demo: false, regions: ['另一大区'] }), false); });
test('审批角色不能从客户端数据自行提权', () => assert.throws(() => apply(reach('technical'), 'save', { role: 'technical', testCost: '0' }, 'applicant'), /对应角色/));
test('关联付款审核有独立权限，原单据留存', () => { let c = launch(); c = apply(c, 'submit_document', { kind: 'payment', title: '外协付款申请', amount: '1000', evidence: '/evidence', note: '用途' }, 'pmo'); const id = c.documents[0].id; assert.throws(() => apply(c, 'review_document', { documentId: id, decision: 'approved' }, 'pmo', { note: '同意' }), /权限/); c = apply(c, 'review_document', { documentId: id, decision: 'approved' }, 'finance', { note: '已审核，中台不执行支付' }); assert.equal(c.documents[0].status, 'approved'); });
for (const route of ['A', 'B', 'C'] as Route[]) test(`${route}类全程可走到结题并归档`, () => {
  let c = launch(route);
  for (const m of c.milestones) {
    c = apply(c, 'submit_milestone', { evidence: '/test/deliverable' }, 'technical', { milestoneId: m.id });
    c = apply(c, 'accept_milestone', {}, route === 'B' && m.name.includes('产品决策') ? 'sponsor' : 'pmo', { milestoneId: m.id, note: '验收通过，继续推进' });
  }
  c = apply(c); assert.equal(c.stage, 'acceptance'); c = apply(c); assert.equal(c.stage, 'settlement'); c = apply(c); assert.equal(c.stage, 'closed'); assert.equal(c.reservedCents, 0);
  assert.throws(() => apply(c, 'save'), /不可覆盖/); c = apply(c, 'archive', {}, 'pmo'); assert.equal(c.stage, 'archived');
});
