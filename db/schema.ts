import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Isolated research aggregate: does not overwrite legacy BMP/work_items records.
export const researchCasesV2 = sqliteTable('research_cases_v2', {
  id: text('id').primaryKey(), requestNo: text('request_no').notNull(), projectNo: text('project_no'),
  route: text('route').notNull(), stage: text('stage').notNull(), revision: integer('revision').notNull(),
  creatorEmail: text('creator_email').notNull(), team: text('team').notNull(), region: text('region').notNull(),
  dataJson: text('data_json').notNull(), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [uniqueIndex('uq_research_v2_request').on(t.requestNo), uniqueIndex('uq_research_v2_project').on(t.projectNo), index('idx_research_v2_stage').on(t.stage, t.updatedAt)]);

export const researchHistoryV2 = sqliteTable('research_history_v2', {
  id: text('id').primaryKey(), caseId: text('case_id').notNull().references(() => researchCasesV2.id), revision: integer('revision').notNull(),
  action: text('action').notNull(), actor: text('actor').notNull(), fromStage: text('from_stage').notNull(), toStage: text('to_stage').notNull(),
  note: text('note').notNull(), snapshotJson: text('snapshot_json').notNull(), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('uq_research_history_revision').on(t.caseId, t.revision)]);

export const researchBudgetPackages = sqliteTable('research_budget_packages', {
  id: text('id').primaryKey(), customerId: text('customer_id').notNull(), hospital: text('hospital').notNull(), period: text('period').notNull(), region: text('region').notNull(),
  totalCents: integer('total_cents').notNull(), usedCents: integer('used_cents').notNull().default(0), lockedCents: integer('locked_cents').notNull().default(0), legacyPlannedCents: integer('platform_planned_cents').notNull().default(0),
  revision: integer('revision').notNull().default(1), evidence: text('evidence').notNull(), sourceSystem: text('source_system').notNull().default('unverified'), externalObjectId: text('external_object_id'),
  sourceUpdatedAt: integer('source_updated_at'), syncedAt: integer('synced_at'), verificationStatus: text('verification_status').notNull().default('unverified'), updatedAt: integer('updated_at').notNull(),
}, t => [uniqueIndex('uq_research_budget_hospital_period').on(t.customerId, t.period), check('research_budget_nonnegative', sql`${t.totalCents} >= 0 AND ${t.usedCents} >= 0 AND ${t.lockedCents} >= 0 AND ${t.legacyPlannedCents} >= 0 AND ${t.totalCents} >= ${t.usedCents} + ${t.lockedCents} + ${t.legacyPlannedCents}`), check('research_budget_verification', sql`${t.verificationStatus} IN ('verified', 'unverified')`)]);

export const researchBudgetAudit = sqliteTable('research_budget_audit', {
  id: text('id').primaryKey(), budgetId: text('budget_id').notNull().references(() => researchBudgetPackages.id), caseId: text('case_id'), actor: text('actor').notNull(),
  totalDelta: integer('total_delta').notNull().default(0), usedDelta: integer('used_delta').notNull().default(0), lockedDelta: integer('locked_delta').notNull().default(0), legacyPlannedDelta: integer('platform_planned_delta').notNull().default(0),
  evidence: text('evidence').notNull(), createdAt: integer('created_at').notNull(),
});
export const researchCustomers = sqliteTable('research_customers', {
  id: text('id').primaryKey(), name: text('name').notNull(), region: text('region').notNull(), source: text('source').notNull(),
  externalObjectId: text('external_object_id'), sourceVersion: text('source_version'), sourceUpdatedAt: integer('source_updated_at'), syncedAt: integer('synced_at'),
  verificationStatus: text('verification_status').notNull().default('unverified'), updatedAt: integer('updated_at').notNull(),
}, t => [check('research_customer_verification', sql`${t.verificationStatus} IN ('verified', 'unverified')`)]);
export const researchCustomerContacts = sqliteTable('research_customer_contacts', {
  id: text('id').primaryKey(), customerId: text('customer_id').notNull().references(() => researchCustomers.id), bmpContactId: text('bmp_contact_id'),
  name: text('name').notNull(), department: text('department').notNull(), jobTitle: text('job_title').notNull(), professionalTitle: text('professional_title').notNull().default(''),
  researchBackground: text('research_background').notNull(), expertiseJson: text('expertise_json').notNull().default('[]'), workEmail: text('work_email').notNull().default(''), workPhone: text('work_phone').notNull().default(''),
  status: text('status').notNull().default('active'), source: text('source').notNull().default('manual'), evidence: text('evidence').notNull(), verifiedAt: integer('verified_at').notNull(),
  sourceVersion: text('source_version'), sourceUpdatedAt: integer('source_updated_at'), syncedAt: integer('synced_at'), verificationStatus: text('verification_status').notNull().default('unverified'),
  revision: integer('revision').notNull().default(1), updatedBy: text('updated_by').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [
  uniqueIndex('uq_research_contact_external').on(t.customerId, t.source, t.bmpContactId),
  index('idx_research_contact_customer_status').on(t.customerId, t.status),
  check('research_contact_status', sql`${t.status} IN ('active', 'inactive')`),
    check('research_contact_source', sql`${t.source} IN ('manual', 'bmp_sync', 'it_import')`),
    check('research_contact_verification', sql`${t.verificationStatus} IN ('verified', 'unverified')`),
  check('research_contact_revision', sql`${t.revision} >= 1`),
]);
export const researchContactHistory = sqliteTable('research_contact_history', {
  id: text('id').primaryKey(), contactId: text('contact_id').notNull().references(() => researchCustomerContacts.id), revision: integer('revision').notNull(),
  actor: text('actor').notNull(), snapshotJson: text('snapshot_json').notNull(), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('uq_research_contact_history_revision').on(t.contactId, t.revision)]);
export const researchCounters = sqliteTable('research_counters', { key: text('key').primaryKey(), value: integer('value').notNull() });
export const researchOutbox = sqliteTable('research_outbox', {
  id: text('id').primaryKey(), caseId: text('case_id').notNull().references(() => researchCasesV2.id), revision: integer('revision').notNull(), event: text('event').notNull(),
  status: text('status').notNull().default('pending_contract'), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('uq_research_outbox_version').on(t.caseId, t.revision)]);
export const platformSessions = sqliteTable('platform_sessions', { tokenHash: text('token_hash').primaryKey(), identityJson: text('identity_json').notNull(), expiresAt: integer('expires_at').notNull() });

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  department: text('department'),
  role: text('role', { enum: ['admin', 'director', 'manager', 'member', 'viewer'] }).notNull().default('member'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [uniqueIndex('uq_users_email').on(table.email)]);

export const integrations = sqliteTable('integrations', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['synology', 'bmp', 'medical_lab'] }).notNull(),
  displayName: text('display_name').notNull(),
  baseUrl: text('base_url').notNull(),
  state: text('state', { enum: ['ready', 'degraded', 'offline', 'not_configured'] }).notNull(),
  lastSuccessAt: integer('last_success_at', { mode: 'timestamp_ms' }),
  lastErrorCode: text('last_error_code'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [uniqueIndex('uq_integrations_provider').on(table.provider)]);

export const workItems = sqliteTable('work_items', {
  id: text('id').primaryKey(),
  externalId: text('external_id'),
  module: text('module', { enum: ['tender', 'research', 'aftersales', 'events', 'analytics', 'pgd_review', 'training'] }).notNull(),
  title: text('title').notNull(),
  customerId: text('customer_id'),
  customerName: text('customer_name'),
  region: text('region'),
  priority: text('priority', { enum: ['P0', 'P1', 'P2', 'P3'] }).notNull().default('P2'),
  status: text('status').notNull(),
  stage: text('stage').notNull(),
  ownerId: text('owner_id').references(() => users.id),
  dueAt: integer('due_at', { mode: 'timestamp_ms' }),
  sourceUpdatedAt: integer('source_updated_at', { mode: 'timestamp_ms' }),
  payloadJson: text('payload_json').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('uq_work_items_module_external').on(table.module, table.externalId),
  index('idx_work_items_module_status').on(table.module, table.status),
  index('idx_work_items_owner_due').on(table.ownerId, table.dueAt),
  index('idx_work_items_customer').on(table.customerId),
]);

// Frozen legacy shape retained only so old installations can be migrated/read during IT cutover.
// Runtime research writes and reads must use research_cases_v2; do not add new consumers here.
export const researchProjects = sqliteTable('research_projects', {
  workItemId: text('work_item_id').primaryKey().references(() => workItems.id),
  parentProjectId: text('parent_project_id'),
  businessNature: text('business_nature', { enum: ['customer_success', 'strategic_rnd', 'paid_transition'] }).notNull(),
  projectTag: text('project_tag'),
  deliveryMode: text('delivery_mode'),
  principalInvestigator: text('principal_investigator'),
  contractGate: integer('contract_gate', { mode: 'boolean' }).notNull().default(false),
  ethicsGate: integer('ethics_gate', { mode: 'boolean' }).notNull().default(false),
  complianceGate: integer('compliance_gate', { mode: 'boolean' }).notNull().default(false),
  nextMilestone: text('next_milestone'),
  plannedAt: integer('planned_at', { mode: 'timestamp_ms' }),
  actualAt: integer('actual_at', { mode: 'timestamp_ms' }),
}, (table) => [index('idx_research_parent').on(table.parentProjectId)]);

// Frozen legacy aggregate. It is not an accepted source for management analysis.
export const researchEconomics = sqliteTable('research_economics', {
  workItemId: text('work_item_id').primaryKey().references(() => workItems.id),
  hospitalId: text('hospital_id').notNull(),
  hospitalName: text('hospital_name').notNull(),
  laborHours: integer('labor_hours').notNull().default(0),
  sampleCostCents: integer('sample_cost_cents').notNull().default(0),
  externalCostCents: integer('external_cost_cents').notNull().default(0),
  otherCostCents: integer('other_cost_cents').notNull().default(0),
  attributableRevenueCents: integer('attributable_revenue_cents'),
  paperCount: integer('paper_count').notNull().default(0),
  patentCount: integer('patent_count').notNull().default(0),
  conversionNote: text('conversion_note'),
  calculatedAt: integer('calculated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('idx_research_economics_hospital').on(table.hospitalId, table.calculatedAt)]);

export const salesFacts = sqliteTable('sales_facts', {
  id: text('id').primaryKey(),
  externalId: text('external_id'),
  hospitalId: text('hospital_id').notNull(),
  hospitalName: text('hospital_name').notNull(),
  region: text('region').notNull().default(''),
  productCode: text('product_code').notNull(),
  productName: text('product_name').notNull(),
  ownerId: text('owner_id').references(() => users.id),
  period: text('period').notNull(),
  salesQuantity: integer('sales_quantity').notNull().default(0),
  targetQuantity: integer('target_quantity'),
  revenueCents: integer('revenue_cents').notNull().default(0),
  sourceUpdatedAt: integer('source_updated_at', { mode: 'timestamp_ms' }),
  sourceSystem: text('source_system').notNull().default('unverified'),
  sourceVersion: text('source_version'),
  syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  verificationStatus: text('verification_status').notNull().default('unverified'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('uq_sales_facts_external').on(table.externalId),
  index('idx_sales_product_period').on(table.productCode, table.period),
  index('idx_sales_hospital_period').on(table.hospitalId, table.period),
  index('idx_sales_owner_period').on(table.ownerId, table.period),
  check('sales_facts_verification', sql`${table.verificationStatus} IN ('verified', 'unverified')`),
]);

export const medicalLabMetrics = sqliteTable('medical_lab_metrics', {
  id: text('id').primaryKey(),
  externalId: text('external_id'),
  hospitalId: text('hospital_id').notNull(),
  hospitalName: text('hospital_name').notNull(),
  region: text('region').notNull().default(''),
  period: text('period').notNull(),
  sampleCount: integer('sample_count').notNull().default(0),
  amplificationSuccessBp: integer('amplification_success_bp'),
  positiveBp: integer('positive_bp'),
  negativeBp: integer('negative_bp'),
  mosaicBp: integer('mosaic_bp'),
  sourceUpdatedAt: integer('source_updated_at', { mode: 'timestamp_ms' }),
  sourceSystem: text('source_system').notNull().default('unverified'),
  sourceVersion: text('source_version'),
  syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  verificationStatus: text('verification_status').notNull().default('unverified'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('uq_medical_lab_external').on(table.externalId),
  uniqueIndex('uq_medical_lab_hospital_period').on(table.hospitalId, table.period),
  index('idx_medical_lab_period').on(table.period),
  check('medical_lab_verification', sql`${table.verificationStatus} IN ('verified', 'unverified')`),
]);

export const pgdCenterOperations = sqliteTable('pgd_center_operations', {
  id: text('id').primaryKey(),
  externalId: text('external_id'),
  hospitalId: text('hospital_id').notNull(),
  hospitalName: text('hospital_name').notNull(),
  province: text('province').notNull(),
  stage: text('stage').notNull(),
  period: text('period').notNull(),
  totalCycleCount: integer('total_cycle_count'),
  pgdCycleCount: integer('pgd_cycle_count'),
  conversionBp: integer('conversion_bp'),
  dataOwnerId: text('data_owner_id').references(() => users.id),
  sourceUpdatedAt: integer('source_updated_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('uq_pgd_center_external').on(table.externalId),
  uniqueIndex('uq_pgd_center_hospital_period').on(table.hospitalId, table.period),
  index('idx_pgd_center_stage_period').on(table.stage, table.period),
  index('idx_pgd_center_province').on(table.province),
]);

export const aftersalesTickets = sqliteTable('aftersales_tickets', {
  workItemId: text('work_item_id').primaryKey().references(() => workItems.id),
  severity: text('severity', { enum: ['P0', 'P1', 'P2', 'P3'] }).notNull(),
  category: text('category').notNull(),
  responsibleDepartment: text('responsible_department'),
  slaDueAt: integer('sla_due_at', { mode: 'timestamp_ms' }).notNull(),
  rootCause: text('root_cause'),
  capaId: text('capa_id'),
  customerConfirmedAt: integer('customer_confirmed_at', { mode: 'timestamp_ms' }),
}, (table) => [index('idx_aftersales_sla').on(table.slaDueAt, table.severity)]);

export const academicEvents = sqliteTable('academic_events', {
  workItemId: text('work_item_id').primaryKey().references(() => workItems.id),
  eventDate: integer('event_date', { mode: 'timestamp_ms' }).notNull(),
  eventType: text('event_type').notNull(),
  budgetCents: integer('budget_cents').notNull().default(0),
  decisionMakerCount: integer('decision_maker_count').notNull().default(0),
  qualifiedLeadCount: integer('qualified_lead_count').notNull().default(0),
  crmOpportunityCount: integer('crm_opportunity_count').notNull().default(0),
  convertedRevenueCents: integer('converted_revenue_cents').notNull().default(0),
}, (table) => [index('idx_events_date').on(table.eventDate)]);

export const qualificationProjects = sqliteTable('qualification_projects', {
  workItemId: text('work_item_id').primaryKey().references(() => workItems.id),
  completenessPercent: integer('completeness_percent').notNull().default(0),
  criticalGapCount: integer('critical_gap_count').notNull().default(0),
  reviewStage: text('review_stage').notNull(),
  plannedReviewAt: integer('planned_review_at', { mode: 'timestamp_ms' }),
  versionLabel: text('version_label'),
}, (table) => [index('idx_qualification_stage').on(table.reviewStage, table.plannedReviewAt)]);

export const pgdReviewExperts = sqliteTable('pgd_review_experts', {
  id: text('id').primaryKey(),
  externalId: text('external_id'),
  name: text('name').notNull(),
  organization: text('organization'),
  department: text('department'),
  professionalTitle: text('professional_title'),
  province: text('province'),
  city: text('city'),
  specialties: text('specialties').notNull().default(''),
  reviewStages: text('review_stages').notNull().default(''),
  sessionCount: integer('session_count').notNull().default(0),
  lastReviewAt: integer('last_review_at', { mode: 'timestamp_ms' }),
  reviewHistoryJson: text('review_history_json').notNull().default('[]'),
  importedById: text('imported_by_id').references(() => users.id),
  source: text('source').notNull().default('excel'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('uq_pgd_experts_external').on(table.externalId),
  index('idx_pgd_experts_name_org').on(table.name, table.organization),
  index('idx_pgd_experts_province').on(table.province),
]);

export const trainingEnrollments = sqliteTable('training_enrollments', {
  id: text('id').primaryKey(),
  workItemId: text('work_item_id').notNull().references(() => workItems.id),
  learnerExternalId: text('learner_external_id').notNull(),
  learningPath: text('learning_path').notNull(),
  progressPercent: integer('progress_percent').notNull().default(0),
  examScore: integer('exam_score'),
  certifiedAt: integer('certified_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('uq_training_work_learner').on(table.workItemId, table.learnerExternalId),
  index('idx_training_path_progress').on(table.learningPath, table.progressPercent),
]);

export const evidenceDocuments = sqliteTable('evidence_documents', {
  id: text('id').primaryKey(),
  synologyPath: text('synology_path').notNull(),
  fileName: text('file_name').notNull(),
  category: text('category').notNull(),
  productLine: text('product_line'),
  effectiveFrom: integer('effective_from', { mode: 'timestamp_ms' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  checksum: text('checksum'),
  indexedAt: integer('indexed_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('uq_evidence_path').on(table.synologyPath),
  index('idx_evidence_category_product').on(table.category, table.productLine),
  index('idx_evidence_expiry').on(table.expiresAt),
]);

export const syncRuns = sqliteTable('sync_runs', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['synology', 'bmp', 'medical_lab'] }).notNull(),
  module: text('module').notNull(),
  status: text('status', { enum: ['running', 'succeeded', 'failed', 'partial'] }).notNull(),
  cursor: text('cursor'),
  recordsRead: integer('records_read').notNull().default(0),
  recordsWritten: integer('records_written').notNull().default(0),
  errorSummary: text('error_summary'),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
}, (table) => [index('idx_sync_provider_started').on(table.provider, table.startedAt)]);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').references(() => users.id),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  result: text('result', { enum: ['success', 'denied', 'failed'] }).notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('idx_audit_actor_created').on(table.actorId, table.createdAt)]);
