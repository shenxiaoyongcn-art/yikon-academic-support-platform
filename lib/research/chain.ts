import type { Case, DocumentKind, Stage } from './model.ts';
export type ChainNode = { key: string; name: string; count: number; state: 'done' | 'current' | 'pending' | 'optional'; kind?: DocumentKind };
export const documentNames: Record<DocumentKind, string> = { contract: '合同 / 协议', payment: '付款 / 预付款', resource: '样本 / 物料与资源', expense: '费用核销', summary: '验收总结' };
export function businessChain(c: Case): ChainNode[] {
  const preliminary: Stage[] = ['draft', 'intake', 'c_region', 'product', 'technical', 'analysis', 'costing', 'budget', 'region', 'marketing', 'sponsor', 'department', 'b_region', 'b_marketing', 'commerce', 'compliance', 'exception', 'budget_ready', 'returned', 'reserve'];
  const linked = (kind: DocumentKind, applicable = true): ChainNode => {
    const docs = c.documents.filter(d => d.kind === kind);
    return { key: kind, name: documentNames[kind], kind, count: docs.length, state: docs.some(d => d.status === 'submitted') ? 'current' : docs.some(d => d.status === 'approved') ? 'done' : applicable ? 'pending' : 'optional' };
  };
  const contractApplicable = c.route === 'C' || c.data.customerPaid === '是' || c.data.externalContract === '是' || ['第三方外包', '联合承接'].includes(c.data.deliveryMode);
  const final = ['closed', 'archived'].includes(c.stage) || c.decisions.some(d => d.stage === 'settlement');
  return [
    { key: 'demand', name: '需求与评估', count: 1, state: preliminary.includes(c.stage) ? 'current' : 'done' },
    { key: 'project', name: '科研立项', count: c.projectNo ? 1 : 0, state: c.stage === 'commitment' ? 'current' : c.projectNo ? 'done' : 'pending' },
    linked('contract', contractApplicable),
    { ...linked('payment', c.route === 'C' || c.data.externalContract === '是'), name: c.route === 'A' ? '预算占用 / 付款' : '付款 / 支付条件', count: c.documents.filter(d => d.kind === 'payment').length + (c.reservedCents > 0 || c.decisions.some(d => d.stage === 'budget_ready') ? 1 : 0), state: c.reservedCents > 0 ? 'done' : linked('payment', c.route === 'C').state },
    linked('resource', true),
    { key: 'execution', name: '项目执行', count: c.milestones.length, state: ['execution', 'waiting', 'paused'].includes(c.stage) ? 'current' : ['acceptance', 'settlement', 'closed', 'archived'].includes(c.stage) ? 'done' : 'pending' },
    { ...linked('expense'), state: c.stage === 'settlement' ? 'current' : final ? 'done' : linked('expense').state, count: c.documents.filter(d => d.kind === 'expense').length + (final ? 1 : 0) },
    { ...linked('summary'), state: c.stage === 'acceptance' ? 'current' : final ? 'done' : linked('summary').state, count: c.documents.filter(d => d.kind === 'summary').length + (c.data.acceptanceEvidence ? 1 : 0) },
  ];
}
