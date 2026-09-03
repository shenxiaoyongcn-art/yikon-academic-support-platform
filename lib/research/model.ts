export const routeNames = { A: '客户科研 / 公司投入', B: '课题研究 / 战略研发', C: '临床收费 / 过渡生产' } as const;
export type Route = keyof typeof routeNames;
export const roleNames = { applicant: '需求发起人', pmo: '学术PMO', technical: '研发 / 执行', analyst: '分析人员', budget: '商务预算管理员', regional: '大区负责人', marketing: '营销负责人', sponsor: '产品 / 研发Sponsor', department: '产品 / 研发部门负责人', product: '产品 / 市场', quality: '质量 / 法规 / 医学', finance: '商务 / 财务', executive: '授权外例外审批人' } as const;
export type Role = keyof typeof roleNames;
export type Actor = { id: string; email: string; name: string; roles: Role[]; regions: string[]; team: string; demo?: boolean };
export type Field = { key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'date' | 'month' | 'email' | 'select'; options?: string[]; required?: boolean; hint?: string; routes?: Route[] };
export type Data = Record<string, string>;
export type Stage = 'draft' | 'intake' | 'c_region' | 'product' | 'technical' | 'analysis' | 'costing' | 'budget' | 'region' | 'marketing' | 'sponsor' | 'department' | 'b_region' | 'b_marketing' | 'commerce' | 'compliance' | 'exception' | 'budget_ready' | 'commitment' | 'launch' | 'execution' | 'waiting' | 'paused' | 'acceptance' | 'settlement' | 'closed' | 'terminated' | 'archived' | 'returned' | 'reserve';
export type Step = { name: string; role: Role; help: string; fields: Field[] };
export type Decision = { stage: Stage; by: string; role: Role; at: number; note: string; validUntil?: string; batchId?: string };
export type Milestone = { id: string; name: string; owner: string; acceptor: string; plannedDate: string; evidence: string; standard: string; submittedAt?: number; acceptedAt?: number; overdueReason: string; correction: string; decision?: string };
export type Center = { id: string; customerId: string; name: string; owner: string; status: string; ethics: string; contract: string; sampleCount: number };
export type DocumentKind = 'contract' | 'payment' | 'resource' | 'expense' | 'summary';
export type LinkedDocument = { id: string; kind: DocumentKind; title: string; status: 'submitted' | 'approved' | 'returned'; applicant: string; createdAt: number; amount: string; reference: string; evidence: string; note: string; reviewer?: string; reviewedAt?: number; reviewNote?: string };
export type Case = {
  id: string; requestNo: string; projectNo: string | null; route: Route; stage: Stage; revision: number; baseline: number;
  creatorId: string; creatorEmail: string; team: string; region: string; data: Data; decisions: Decision[];
  milestones: Milestone[]; centers: Center[]; documents: LinkedDocument[]; reservedCents: number; budgetId: string | null;
  createdAt: number; updatedAt: number; stageEnteredAt: number; evaluationDueAt?: number;
  resumeStage?: Stage; pausedAt?: number; pausedMs: number; waitReason?: string; waitOwner?: string; resumeCondition?: string;
  changePending?: boolean; terminationPending?: boolean; lastReason?: string;
};
export type Budget = { id: string; customerId: string; hospital: string; period: string; region: string; totalCents: number; usedCents: number; lockedCents: number; revision: number; evidence: string };
export type Policy = { authorizationCents: number | null; urgentIntakeHours: number; monthlyIntakeHours: number; evaluationWorkdays: number; urgentEvaluationWorkdays: number };
export const defaultPolicy: Policy = { authorizationCents: null, urgentIntakeHours: 4, monthlyIntakeHours: 4, evaluationWorkdays: 2, urgentEvaluationWorkdays: 1 };
export type History = { id: string; revision: number; action: string; from: Stage; to: Stage; actor: string; at: number; note: string; baseline: number };
export type Command = { action: 'save' | 'advance' | 'return' | 'reject' | 'reserve' | 'resubmit' | 'pause' | 'resume' | 'change' | 'submit_milestone' | 'accept_milestone' | 'terminate' | 'archive' | 'submit_document' | 'review_document'; expectedRevision: number; data?: Data; note?: string; milestoneId?: string; milestones?: Milestone[]; centers?: Center[]; batchId?: string };
export type Context = { actor: Actor; now: number; policy: Policy; budget?: Budget; projectNo?: string };
export class WorkflowError extends Error { status: number; constructor(message: string, status = 422) { super(message); this.status = status; } }
export const costKeys = ['testCost', 'analysisCost', 'paperCost', 'patentCost', 'outsourcingCost', 'otherCost'] as const;
export function cents(value: string | undefined): number {
  if (!value || !/^\d{1,10}(\.\d{1,2})?$/.test(value)) throw new WorkflowError('金额必须填写非负数，最多两位小数；未知金额请先核验，不能留空或补零。');
  const [whole, decimal = ''] = value.split('.');
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}
export function totalCost(d: Data) { return costKeys.reduce((sum, key) => sum + cents(d[key]), 0); }
export function money(value: number) { return (value / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }); }
export function available(b: Budget) { return b.totalCents - b.usedCents - b.lockedCents; }
export function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function isDate(value: string) { const d = new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value; }
export function localDay(now: number) { return new Date(now + 8 * 3600_000).toISOString().slice(0, 10); }
