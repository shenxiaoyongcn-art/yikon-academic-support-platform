import type { ModuleSlug } from '@/lib/platform/catalog';

export type AiFinding = {
  id: string;
  level: 'critical' | 'warning' | 'opportunity' | 'info';
  title: string;
  metric: string;
  evidence: string;
};

export type AiEvidence = {
  source: string;
  records: number;
  note: string;
};

export type AiAnalysisResult = {
  module: ModuleSlug;
  title: string;
  generatedAt: string;
  dataState: 'ready' | 'insufficient';
  modelState: 'rules-only' | 'model-enhanced';
  modelLabel: string;
  summary: string;
  findings: AiFinding[];
  recommendations: string[];
  evidence: AiEvidence[];
  limitations: string[];
  reviewRequired: true;
};

export type WorkItemRow = {
  id: string;
  title: string;
  customerName: string | null;
  region: string | null;
  priority: string;
  status: string;
  stage: string;
  dueAt: number | null;
  payloadJson: string;
  updatedAt: number;
};

export type ProductAggregate = {
  productName: string;
  hospitalCount: number;
  salesQuantity: number;
  targetQuantity: number;
};

export type MedicalLabAggregate = {
  hospitalName: string;
  period: string;
  sampleCount: number;
  amplificationSuccessBp: number | null;
  positiveBp: number | null;
  negativeBp: number | null;
  mosaicBp: number | null;
};

export type ResearchAggregate = {
  hospitalName: string;
  projectCount: number;
  laborHours: number;
  totalCostCents: number;
  attributableRevenueCents: number;
  paperCount: number;
  patentCount: number;
};

export type AnalysisContext = {
  workItems: WorkItemRow[];
  products: ProductAggregate[];
  medicalLab: MedicalLabAggregate[];
  research: ResearchAggregate[];
};
