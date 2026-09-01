import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
  provider: text('provider', { enum: ['synology', 'bmp'] }).notNull(),
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
  module: text('module', { enum: ['tender', 'research', 'aftersales', 'events', 'pgd_review', 'training'] }).notNull(),
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
  provider: text('provider', { enum: ['synology', 'bmp'] }).notNull(),
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
