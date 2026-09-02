export type ModuleSlug =
  | 'tender'
  | 'research'
  | 'aftersales'
  | 'events'
  | 'analytics'
  | 'pgd-review'
  | 'training'
  | 'pedigree';

export type PlatformModule = {
  slug: ModuleSlug;
  short: string;
  name: string;
  source: string;
  owner: string;
  objective: string;
  flow: string[];
  gates: string[];
  kpis: Array<{ label: string; value: string; note: string }>;
  columns: string[];
  rows: string[][];
  lifecycle?: Array<{ stage: string; count: string; note: string }>;
};

export type HomeModuleCard = {
  code: string;
  name: string;
  source: string;
  state: string;
  stateTone: string;
  desc: string;
  metric: string;
  metricLabel: string;
  tone: string;
};

export type MaintenanceModuleSlug = Exclude<ModuleSlug, 'pedigree'>;
export type WorkItemModule = 'tender' | 'research' | 'aftersales' | 'events' | 'analytics' | 'pgd_review' | 'training';
export type MaintenanceFieldType = 'text' | 'number' | 'date' | 'textarea' | 'select';

export type MaintenanceField = {
  key: string;
  label: string;
  type: MaintenanceFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  advanced?: boolean;
};

export type MaintenanceConfig = {
  slug: MaintenanceModuleSlug;
  dbModule: WorkItemModule;
  bmpModule: 'tender' | 'research' | 'aftersales' | 'events' | 'salesAnalytics' | 'pgdReview' | 'training';
  recordName: string;
  titleLabel: string;
  titlePlaceholder: string;
  customerLabel: string;
  stages: string[];
  defaultStatus: string;
  fields: MaintenanceField[];
};

export type ModuleDefinition = {
  platform: PlatformModule;
  home: HomeModuleCard;
  maintenance?: MaintenanceConfig;
};
