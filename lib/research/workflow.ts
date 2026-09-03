import { available, cents, costKeys, defaultPolicy, isDate, isEmail, localDay, totalCost, WorkflowError, type Actor, type Budget, type Case, type Command, type Context, type Data, type Policy, type Role, type Stage } from './model.ts';
import { demandFields, routeStages, steps, templates } from './definition.ts';

const terminal: Stage[] = ['closed', 'terminated', 'archived'];
const editableDemand: Stage[] = ['draft', 'returned', 'reserve'];
export function visible(c: Case, a: Actor) {
  if (a.demo) return true;
  if (!a.roles.length) return false;
  if (c.creatorEmail === a.email || c.data.managerEmail === a.email || c.data.sponsorEmail === a.email || c.data.acceptorEmail === a.email || c.milestones.some(m => m.owner === a.email || m.acceptor === a.email)) return true;
  if (a.team && a.team === c.team) return true;
  return a.roles.some(r => r !== 'applicant') && (a.regions.includes('*') || Boolean(c.region && a.regions.includes(c.region)));
}
export function hasRole(a: Actor, r: Role) { return a.roles.includes(r); }
export function isManager(c: Case, a: Actor) { return visible(c, a) && (hasRole(a, 'pmo') || c.data.managerEmail === a.email); }
export function canAct(c: Case, a: Actor) {
  if (!visible(c, a)) return false;
  if (editableDemand.includes(c.stage)) return c.creatorEmail === a.email || (a.demo && hasRole(a, 'applicant'));
  if (c.stage === 'sponsor') return hasRole(a, 'sponsor') && (a.demo || c.data.sponsorEmail === a.email);
  if (c.stage === 'acceptance') return a.demo ? hasRole(a, 'pmo') : c.data.acceptorEmail === a.email;
  if (['launch', 'execution', 'waiting', 'paused', 'commitment'].includes(c.stage)) return isManager(c, a);
  return hasRole(a, steps[c.stage].role);
}
export function canSeeMoney(c: Case, a: Actor) { return visible(c, a) && a.roles.some(r => ['budget', 'finance', 'regional', 'marketing', 'executive'].includes(r)); }
export function canSeeTechnical(c: Case, a: Actor) { return visible(c, a) && (a.roles.some(r => ['pmo', 'technical', 'analyst', 'product', 'sponsor', 'department', 'quality'].includes(r)) || c.data.managerEmail === a.email); }
export function redact(c: Case, a: Actor): Case {
  const result = structuredClone(c);
  // The API redacts fields before serializing, including historical snapshots and exports.
  const moneyKeys = [...costKeys, 'testCostBasis', 'analysisBasis', 'serviceBasis', 'budgetId', 'budgetNote', 'fundingSource', 'resourceSource', 'actualCost', 'revenue', 'priceIntent', 'commercialOpinion', 'paymentEvidence', 'quoteEvidence'];
  const technicalKeys = ['technicalPlan', 'strategicGoal', 'sponsorOpinion', 'departmentOpinion', 'complianceOpinion', 'reportBoundary', 'complianceEvidence', 'ethicsEvidence', 'planEvidence', 'resourceEvidence', 'demandEvidence'];
  if (!canSeeMoney(c, a)) {
    for (const key of moneyKeys) delete result.data[key];
    result.reservedCents = 0; result.budgetId = null;
    // Authors can see the cost fields for their current professional assessment, not other departments' costs.
    if (canAct(c, a)) for (const field of steps[c.stage].fields) if (c.data[field.key] !== undefined) result.data[field.key] = c.data[field.key];
    result.documents = result.documents.map(d => ({ ...d, amount: '', ...(d.kind === 'resource' || d.kind === 'summary' ? {} : { evidence: '', reference: '', note: '', reviewNote: '' }) }));
  }
  if (!canSeeTechnical(c, a)) {
    for (const key of technicalKeys) delete result.data[key];
    if (c.route === 'B') for (const key of ['background', 'expectedOutput', 'scope', 'sampleCommitment', 'deliverables']) delete result.data[key];
    result.milestones = result.milestones.map(m => ({ ...m, evidence: '', standard: '专业验收标准按权限显示' }));
    result.documents = result.documents.map(d => ['resource', 'summary'].includes(d.kind) ? { ...d, evidence: '', note: '', reviewNote: '' } : d);
  }
  result.centers = result.centers.map(x => ({ ...x, ethics: canSeeTechnical(c, a) ? x.ethics : '', contract: canSeeMoney(c, a) ? x.contract : '' }));
  result.decisions = result.decisions.map(d => ({ ...d, note: canReadStep(c, a, d.stage) ? d.note : '该节点专业意见按权限显示' }));
  if (!canSeeMoney(c, a) || !canSeeTechnical(c, a)) delete result.lastReason;
  return result;
}
export function canReadStep(c: Case, a: Actor, stage: Stage) {
  if (['budget', 'budget_ready', 'marketing', 'commerce', 'settlement', 'exception'].includes(stage)) return canSeeMoney(c, a);
  if (['technical', 'analysis', 'product', 'sponsor', 'department', 'compliance', 'costing'].includes(stage)) return canSeeTechnical(c, a);
  return visible(c, a);
}

export function newCase(id: string, requestNo: string, actor: Actor, now: number, data: Data = {}, route: Case['route'] = 'A'): Case {
  const clean = cleanData(data, demandFields.map(f => f.key));
  return { id, requestNo, projectNo: null, route, stage: 'draft', revision: 1, baseline: 0, creatorId: actor.id, creatorEmail: actor.email, team: actor.team, region: clean.region || '', data: { channel: '月度计划', ...clean }, decisions: [], milestones: [], centers: [], documents: [], reservedCents: 0, budgetId: null, createdAt: now, updatedAt: now, stageEnteredAt: now, pausedMs: 0 };
}
export function cleanData(input: Data, keys: string[]): Data {
  const output: Data = {};
  for (const key of keys) if (key in input) {
    if (typeof input[key] !== 'string' || input[key].length > 5000) throw new WorkflowError('字段格式或长度不正确。');
    output[key] = input[key].trim();
  }
  return output;
}
function requireText(d: Data, keys: string[], message: string) { if (keys.some(k => !d[k]?.trim())) throw new WorkflowError(message); }
function requireFuture(value: string, now: number, label: string) { if (!isDate(value) || value < localDay(now)) throw new WorkflowError(`${label}必须是今天或之后的有效日期。`); }
function validateFields(c: Case) {
  for (const field of steps[c.stage].fields) {
    const value = c.data[field.key] || '';
    if (field.required && !value) throw new WorkflowError(`请填写“${field.label}”。`);
    if (!value) continue;
    if (field.type === 'select' && !field.options?.includes(value)) throw new WorkflowError(`${field.label}不在允许选项中。`);
    if (field.type === 'email' && !isEmail(value)) throw new WorkflowError(`${field.label}需要有效邮箱。`);
    if (field.type === 'date' && !isDate(value)) throw new WorkflowError(`${field.label}不是有效日期。`);
    if (field.type === 'number') cents(value);
  }
}
function validateDemand(c: Case) {
  validateFields(c);
  const d = c.data;
  if (d.channel === '月度计划' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.targetMonth || '')) throw new WorkflowError('月度计划必须选择目标月份。');
  if (d.channel === '紧急插单') {
    requireText(d, ['urgentReason', 'cannotWait', 'customerDeadline'], '紧急插单必须说明原因、客户时限和不能等待月度批次的原因。');
    if (!isDate(d.customerDeadline)) throw new WorkflowError('请填写有效的客户答复截止日。');
  }
  if (c.route !== 'B') requireText(d, ['customerId', 'hospital', 'clinicalDepartment', 'region'], '客户相关项目须关联CRM医院、科室及所属大区。');
  if (!/^\d+$/.test(d.centerCount)) throw new WorkflowError('中心数必须为非负整数。');
  if (c.route === 'B') {
    requireText(d, ['sponsorEmail', 'strategicGoal'], 'B类必须明确产品/研发Sponsor和战略目标，不允许PMO代替。');
    if (!isEmail(d.sponsorEmail)) throw new WorkflowError('Sponsor邮箱不正确。');
  }
  if (c.route === 'C') requireText(d, ['productGap', 'priceIntent'], 'C类必须说明产品缺口与收费意向。');
}
function needException(c: Case, policy: Policy) {
  return c.data.highRisk === '是' || (policy.authorizationCents !== null && totalCost(c.data) > policy.authorizationCents) || (c.data.overBudget === '是' && policy.authorizationCents === null);
}
function budgetMatch(c: Case, b?: Budget): Budget {
  if (!b || b.id !== c.data.budgetId || b.customerId !== c.data.customerId || b.region !== c.region) throw new WorkflowError('预算包不存在，或医院 / 大区不匹配。');
  return b;
}
function validateMilestones(c: Case) {
  if (!c.milestones.length) throw new WorkflowError('必须制定节点计划。');
  for (const m of c.milestones) {
    if (!m.name || !isDate(m.plannedDate) || !isEmail(m.owner) || !isEmail(m.acceptor) || !m.standard) throw new WorkflowError('每个节点必须有计划日期、负责人、验收人和验收标准。');
    if (m.plannedDate > c.data.deadline) throw new WorkflowError('节点计划日不得晚于项目最终完成日。');
  }
}
function validateGate(c: Case, ctx: Context) {
  validateFields(c);
  const d = c.data;
  switch (c.stage) {
    case 'intake': {
      if (!['A', 'B', 'C'].includes(d.route)) throw new WorkflowError('未判定项目性质不得进入评估。');
      if (c.projectNo && d.route !== c.route) throw new WorkflowError('已有正式编号不能直接改业务性质，请终止旧项目后新建关联需求。');
      c.route = d.route as Case['route'];
      validateDemand({ ...c, stage: 'draft' }); break;
    }
    case 'technical':
      if (c.route === 'C' && !c.decisions.some(s => s.stage === 'product')) throw new WorkflowError('产品/市场未通过，研发不可提交可实现性。');
      if (d.feasibility === '不可行') throw new WorkflowError('不可行项目不得继续，请退回、储备或拒绝。');
      if (c.route === 'C' && d.customerPaid !== '是') throw new WorkflowError('C类必须是真实收费需求。');
      break;
    case 'costing': totalCost(d); d.exceptionRequired = needException(c, ctx.policy) ? '是' : '否'; break;
    case 'budget': {
      const b = budgetMatch(c, ctx.budget);
      if (c.budgetId && c.budgetId !== b.id) throw new WorkflowError('已有预算占用不能换预算包，请先与商务核对。');
      d.overBudget = available(b) + c.reservedCents < totalCost(d) ? '是' : '否';
      d.exceptionRequired = needException(c, ctx.policy) ? '是' : '否';
      break;
    }
    case 'marketing': requireFuture(d.approvalUntil, ctx.now, '批准有效期'); break;
    case 'exception': requireFuture(d.exceptionUntil, ctx.now, '例外有效期'); break;
    case 'product': requireFuture(d.transitionUntil, ctx.now, '过渡通路失效日'); break;
    case 'budget_ready': {
      const b = budgetMatch(c, ctx.budget);
      if (available(b) + c.reservedCents < totalCost(d)) throw new WorkflowError('可用预算不足。请先落实经批准的增补额度，不能透支或越过预算锁定。', 409);
      c.budgetId = b.id; c.reservedCents = totalCost(d); break;
    }
    case 'commitment':
      if (c.route === 'A' && (c.reservedCents !== totalCost(d) || !c.budgetId)) throw new WorkflowError('A类预算未足额锁定，不得立项。');
      requireFuture(d.deadline, ctx.now, '最终完成日');
      if (c.route === 'C' && d.deadline > d.transitionUntil) throw new WorkflowError('C类交付日期不得超过过渡通路失效日。');
      if (!c.projectNo && !ctx.projectNo) throw new WorkflowError('正式项目编号尚未分配。');
      c.projectNo ||= ctx.projectNo!; c.baseline += 1; c.changePending = false;
      if (!c.milestones.length) c.milestones = templates[c.route].map((name, i) => ({ id: `M${i + 1}`, name, owner: d.managerEmail, acceptor: d.acceptorEmail, plannedDate: '', standard: '', evidence: '', overdueReason: '', correction: '' }));
      break;
    case 'launch':
      if (c.route === 'A' && c.reservedCents !== totalCost(d)) throw new WorkflowError('预算锁定不完整。');
      if (c.route === 'C' || d.customerPaid === '是') requireText(d, ['quoteEvidence', 'contractEvidence', 'paymentEvidence'], '收费交付须先落实报价、合同及支付/授信条件。');
      if (d.externalContract === '是') requireText(d, ['contractEvidence'], '外部合同未落实。');
      if (d.humanSamples === '是') requireText(d, ['ethicsEvidence', 'complianceEvidence'], '涉及人体样本须关联伦理及合规批准依据。');
      if (c.route === 'C' || d.highRisk === '是') requireText(d, ['complianceEvidence'], '合规与报告用途批准依据未落实。');
      if (['第三方外包', '联合承接'].includes(d.deliveryMode)) requireText(d, ['outsourcingEvidence'], '须明确外包 / 联合承接协议与责任范围。');
      if ((c.route === 'C' || d.customerPaid === '是' || d.externalContract === '是') && !c.documents.some(x => x.kind === 'contract' && x.status === 'approved')) throw new WorkflowError('适用合同 / 协议须先提交关联记录并经商务审核。');
      validateMilestones(c); break;
    case 'execution':
      if (!c.milestones.length || c.milestones.some(m => !m.acceptedAt)) throw new WorkflowError('所有关键节点必须提交交付物并经指定验收人确认，才能申请最终验收。');
      break;
    case 'settlement':
      if (c.route === 'A' && cents(d.actualCost) > c.reservedCents) throw new WorkflowError('实际成本超过批准占用，须先发起预算变更复审，不能直接核销。');
      if (c.route === 'B' && d.customerPaid !== '是' && cents(d.revenue) > 0) throw new WorkflowError('无收费交付的战略研发不能记客户收入。');
      c.reservedCents = 0; break;
  }
}

export function transition(original: Case, command: Command, ctx: Context): Case {
  if (!visible(original, ctx.actor)) throw new WorkflowError('无权查看或处理此项目。', 403);
  if (original.revision !== command.expectedRevision) throw new WorkflowError('记录已更新，请刷新后重试，避免覆盖其他人的审批。', 409);
  if (terminal.includes(original.stage) && command.action !== 'archive') throw new WorkflowError('结题 / 终止 / 归档记录不可覆盖。', 409);
  const c = structuredClone(original);
  const a = ctx.actor, now = ctx.now;
  const note = (command.note || '').trim().slice(0, 2000);
  const requireReason = () => { if (!note) throw new WorkflowError('请填写操作原因 / 审批意见。'); };
  const requireManager = () => { if (!isManager(c, a)) throw new WorkflowError('仅项目经理或学术PMO可操作。', 403); };
  const advanceTo = (stage: Stage) => { c.stage = stage; c.stageEnteredAt = now; if (stage === 'technical') c.evaluationDueAt = addWorkdays(now, c.data.channel === '紧急插单' ? ctx.policy.urgentEvaluationWorkdays : ctx.policy.evaluationWorkdays); };
  const expired = c.route === 'C' && c.data.transitionUntil && c.data.transitionUntil < localDay(now);
  if (expired && !['save', 'change', 'terminate', 'pause', 'submit_document', 'review_document'].includes(command.action) && ['launch', 'execution', 'waiting', 'paused'].includes(c.stage)) throw new WorkflowError('C类临时通路已到期，必须发起变更复审或转产 / 退出，不能继续执行。');

  if (['save', 'advance', 'resubmit'].includes(command.action)) {
    if (!canAct(c, a)) throw new WorkflowError(`当前节点由${steps[c.stage].role === 'sponsor' ? '指定Sponsor' : steps[c.stage].name + '对应角色'}处理。`, 403);
    const keys = steps[c.stage].fields.map(f => f.key);
    c.data = { ...c.data, ...cleanData(command.data || {}, keys) };
    if (editableDemand.includes(c.stage)) c.region = c.data.region || '';
    if (command.milestones !== undefined) {
      if (c.stage !== 'launch') throw new WorkflowError('节点计划已锁定，调整请走变更。');
      if (command.milestones.length > 30) throw new WorkflowError('单项目最多30个节点。');
      if (c.milestones.some(old => !command.milestones!.some(m => m.id === old.id))) throw new WorkflowError('标准节点和历史节点不可删除。');
      if (new Set(command.milestones.map(m => m.id)).size !== command.milestones.length) throw new WorkflowError('节点编号重复。');
      c.milestones = command.milestones.map(m => {
        const old = c.milestones.find(x => x.id === m.id);
        if (old?.acceptedAt) return old;
        return { id: String(m.id).slice(0, 80), name: String(m.name).slice(0, 200), owner: String(m.owner).toLowerCase(), acceptor: String(m.acceptor).toLowerCase(), plannedDate: String(m.plannedDate), standard: String(m.standard).slice(0, 2000), evidence: '', overdueReason: '', correction: '' };
      });
    }
    if (command.centers !== undefined) {
      if (c.stage !== 'launch') throw new WorkflowError('中心计划调整须先走变更。');
      if (command.centers.length > 100 || new Set(command.centers.map(x => x.customerId)).size !== command.centers.length) throw new WorkflowError('中心数超限或医院编号重复。');
      c.centers = command.centers.map(x => {
        if (!x.customerId || !x.name || !isEmail(x.owner) || !Number.isSafeInteger(x.sampleCount) || x.sampleCount < 0) throw new WorkflowError('中心需有医院编号、名称、责任人及有效样本数量。');
        return { id: x.customerId, customerId: x.customerId, name: x.name.slice(0, 200), owner: x.owner, status: String(x.status).slice(0, 80), ethics: String(x.ethics).slice(0, 500), contract: String(x.contract).slice(0, 500), sampleCount: x.sampleCount };
      });
    }
    if (command.action !== 'save') {
      if (editableDemand.includes(c.stage)) {
        validateDemand({ ...c, stage: 'draft' });
        c.decisions = []; c.data.route = c.route; advanceTo('intake');
      } else {
        if (c.decisions.some(d => d.validUntil && d.validUntil < localDay(now)) && !['execution', 'acceptance', 'settlement'].includes(c.stage)) throw new WorkflowError('前序批准已过有效期，请退回重新审批。');
        validateGate(c, ctx);
        c.decisions.push({ stage: original.stage, by: a.email, role: steps[original.stage].role, at: now, note: note || `${steps[original.stage].name}已确认；专业字段按权限查看。`, validUntil: original.stage === 'marketing' ? c.data.approvalUntil : original.stage === 'exception' ? c.data.exceptionUntil : undefined, batchId: command.batchId });
        const chain = routeStages(c);
        const next = original.stage === 'settlement' && c.terminationPending ? 'terminated' : chain[chain.indexOf(original.stage) + 1];
        if (!next) throw new WorkflowError('当前状态没有可执行的下一步。');
        if (next === 'commitment' && c.route === 'A') {
          const b = budgetMatch(c, ctx.budget);
          if (available(b) + c.reservedCents < totalCost(c.data)) throw new WorkflowError('可用预算不足，审批和占用均未保存；请核对预算或按超预算路径复审。', 409);
          c.budgetId = b.id; c.reservedCents = totalCost(c.data);
        }
        advanceTo(next);
      }
    }
  } else if (['return', 'reject', 'reserve'].includes(command.action)) {
    if (!canAct(c, a) || ['draft', 'execution', 'waiting', 'paused', 'settlement'].includes(c.stage)) throw new WorkflowError('当前状态不可退回 / 拒绝 / 储备。', 403);
    requireReason();
    if (c.stage === 'acceptance' && command.action === 'return') { advanceTo('execution'); }
    else {
      if (c.projectNo && command.action === 'return') throw new WorkflowError('已立项项目的范围与计划调整须发起变更，不能通过退回需求绕过合同及基线复核。');
      if (c.projectNo && command.action !== 'return') throw new WorkflowError('已立项项目须走终止与核销，不能直接拒绝释放预算。');
      if (!c.projectNo) c.reservedCents = 0;
      if (command.action === 'reject') advanceTo('terminated');
      else {
        const followup = cleanData(command.data || {}, ['supplementBy', 'nextOwner']);
        if (!isDate(followup.supplementBy || '') || !isEmail(followup.nextOwner || '')) throw new WorkflowError('退回 / 储备须填写补充截止日与下一步责任人邮箱。');
        c.data = { ...c.data, ...followup }; advanceTo(command.action === 'reserve' ? 'reserve' : 'returned');
      }
    }
  } else if (command.action === 'pause') {
    requireManager(); requireReason();
    if (!['execution', 'launch'].includes(c.stage)) throw new WorkflowError('仅待启动或执行中的项目可暂停。');
    const d = command.data || {};
    requireText(d, ['waitOwner', 'resumeCondition'], '必须填写等待责任人和恢复条件。');
    c.resumeStage = c.stage; c.pausedAt = now; c.waitReason = note; c.waitOwner = d.waitOwner.slice(0, 200); c.resumeCondition = d.resumeCondition.slice(0, 2000);
    advanceTo(d.waiting === '是' ? 'waiting' : 'paused');
  } else if (command.action === 'resume') {
    requireManager(); requireReason();
    if (!['waiting', 'paused'].includes(c.stage) || !c.resumeStage) throw new WorkflowError('项目未暂停。');
    c.pausedMs += now - (c.pausedAt || now); c.pausedAt = undefined; advanceTo(c.resumeStage); c.resumeStage = undefined;
  } else if (command.action === 'change') {
    requireManager(); requireReason();
    if (!c.projectNo || !['launch', 'execution', 'waiting', 'paused', 'acceptance', 'settlement'].includes(c.stage)) throw new WorkflowError('仅已立项的在途项目可发起变更。');
    if (c.pausedAt) { c.pausedMs += now - c.pausedAt; c.pausedAt = undefined; }
    c.changePending = true; c.decisions = []; c.data.changeReason = note;
    c.documents = c.documents.map(d => ({ ...d, status: 'returned', reviewNote: '项目基线变更，适用单据须重新提交核验。' }));
    c.milestones = c.milestones.map(m => ({ ...m, evidence: '', submittedAt: undefined, acceptedAt: undefined, decision: undefined }));
    for (const field of [...steps.launch.fields, ...steps.acceptance.fields]) delete c.data[field.key];
    // Preserve budget reservation and prior baseline in immutable history while re-assessing.
    c.data = { ...c.data, ...cleanData(command.data || {}, demandFields.map(f => f.key).filter(k => !['customerId', 'hospital', 'region', 'sponsorEmail'].includes(k))) };
    c.data.route = c.route; advanceTo('intake');
  } else if (command.action === 'submit_milestone' || command.action === 'accept_milestone') {
    if (c.stage !== 'execution') throw new WorkflowError('当前项目未在执行中。');
    const m = c.milestones.find(m => m.id === command.milestoneId);
    if (!m || m.acceptedAt) throw new WorkflowError('节点不存在或已验收。');
    if (command.action === 'submit_milestone') {
      if (!(a.demo ? hasRole(a, 'technical') : m.owner === a.email)) throw new WorkflowError('只有本节点负责人可以提交交付物。', 403);
      const d = command.data || {}; requireText(d, ['evidence'], '必须关联交付物链接或受控云盘路径。');
      if (localDay(now - c.pausedMs) > m.plannedDate) requireText(d, ['overdueReason', 'correction'], '逾期节点须填写原因和纠偏措施。');
      m.evidence = d.evidence.slice(0, 2000); m.overdueReason = (d.overdueReason || '').slice(0, 2000); m.correction = (d.correction || '').slice(0, 2000); m.submittedAt = now;
    } else {
      if (!(a.demo ? hasRole(a, 'pmo') || (c.route === 'B' && m.name.includes('产品决策') && hasRole(a, 'sponsor')) : m.acceptor === a.email)) throw new WorkflowError('只有指定验收人可以确认交付。', 403);
      if (!m.submittedAt || !m.evidence) throw new WorkflowError('尚未提交交付物，不能验收。');
      requireReason();
      if (c.route === 'B' && m.name.includes('产品决策') && !hasRole(a, 'sponsor')) throw new WorkflowError('B类产品阶段决策须由Sponsor确认。', 403);
      m.acceptedAt = now; m.decision = note;
    }
  } else if (command.action === 'submit_document') {
    if (!visible(c, a) || !(isManager(c, a) || c.creatorEmail === a.email || a.roles.some(r => ['finance', 'budget', 'technical'].includes(r)))) throw new WorkflowError('无权提交该项目的关联申请。', 403);
    if (!c.projectNo) throw new WorkflowError('立项后才能创建合同、付款、资源或核销申请。');
    const d = command.data || {};
    if (!['contract', 'payment', 'resource', 'expense', 'summary'].includes(d.kind)) throw new WorkflowError('未知申请类别。');
    requireText(d, ['title', 'evidence', 'note'], '关联申请需填写名称、资料路径及申请说明。');
    if (d.amount) cents(d.amount);
    if (['payment', 'expense'].includes(d.kind) && !d.amount) throw new WorkflowError('付款 / 费用核销必须填写金额。');
    c.documents.push({ id: crypto.randomUUID(), kind: d.kind as Case['documents'][number]['kind'], title: d.title.slice(0, 200), status: 'submitted', applicant: a.email, createdAt: now, amount: d.amount || '', reference: (d.reference || '').slice(0, 200), evidence: d.evidence.slice(0, 2000), note: d.note.slice(0, 2000) });
  } else if (command.action === 'review_document') {
    const d = command.data || {}, document = c.documents.find(x => x.id === d.documentId);
    if (!document || document.status !== 'submitted') throw new WorkflowError('该申请不存在或已处理。');
    const role: Role = document.kind === 'resource' ? 'technical' : document.kind === 'summary' ? 'pmo' : 'finance';
    if (!hasRole(a, role)) throw new WorkflowError('无此类申请的审核权限。', 403);
    requireReason();
    if (!['approved', 'returned'].includes(d.decision)) throw new WorkflowError('请选择同意或退回。');
    document.status = d.decision as 'approved' | 'returned'; document.reviewer = a.email; document.reviewedAt = now; document.reviewNote = note;
  } else if (command.action === 'terminate') {
    requireManager(); requireReason();
    if (!c.projectNo) { c.reservedCents = 0; advanceTo('terminated'); }
    else { c.terminationPending = true; advanceTo('settlement'); }
  } else if (command.action === 'archive') {
    requireManager(); if (!['closed', 'terminated'].includes(c.stage)) throw new WorkflowError('仅结题或终止项目可以归档。'); advanceTo('archived');
  } else { throw new WorkflowError('不支持的流程操作。'); }
  c.revision += 1; c.updatedAt = now; if (note) c.lastReason = note;
  return c;
}

export function batchEligible(c: Case, b?: Budget) {
  return c.stage === 'marketing' && c.route === 'A' && c.data.channel === '月度计划' && c.data.majorCommitment !== '是' && c.data.highRisk !== '是' && c.data.overBudget !== '是' && c.data.exceptionRequired !== '是' && Boolean(b && available(b) + c.reservedCents >= totalCost(c.data));
}
export function addWorkdays(now: number, days: number) {
  const d = new Date(now + 8 * 3600_000);
  for (let i = 0; i < days; ) { d.setUTCDate(d.getUTCDate() + 1); if (![0, 6].includes(d.getUTCDay())) i++; }
  return d.getTime() - 8 * 3600_000;
}
export function alerts(c: Case, now = Date.now(), policy: Policy = defaultPolicy): string[] {
  const result: string[] = [];
  if (terminal.includes(c.stage)) return result;
  if (c.stage === 'intake' && now - c.stageEnteredAt > (c.data.channel === '紧急插单' ? policy.urgentIntakeHours : policy.monthlyIntakeHours) * 3600_000) result.push('完整性核验超目标时效');
  if (['technical', 'analysis', 'costing'].includes(c.stage) && c.evaluationDueAt && now > c.evaluationDueAt) result.push('专业评估超目标时效');
  if (['returned', 'reserve'].includes(c.stage) && c.data.supplementBy < localDay(now)) result.push('补充 / 复审已到期');
  if (c.stage === 'waiting' && c.pausedAt) {
    const days = Math.floor((now - c.pausedAt) / 86400_000);
    for (const threshold of [30, 60, 90]) if (days >= threshold) result.push(`等待客户已满${threshold}天：${threshold === 90 ? '需决定继续、暂停或终止' : '需跟进客户'}`);
  }
  if (c.route === 'C' && c.data.transitionUntil && c.data.transitionUntil < localDay(now)) result.push(`临时通路已到期，转产 / 退出负责人：${c.data.exitOwner || '待指定'}`);
  if (c.stage === 'execution') for (const m of c.milestones) if (!m.acceptedAt && m.plannedDate < localDay(now - c.pausedMs)) result.push(`节点逾期：${m.name}`);
  return result;
}
