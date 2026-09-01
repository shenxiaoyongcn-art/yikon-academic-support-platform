CREATE TABLE `academic_events` (
	`work_item_id` text PRIMARY KEY NOT NULL,
	`event_date` integer NOT NULL,
	`event_type` text NOT NULL,
	`budget_cents` integer DEFAULT 0 NOT NULL,
	`decision_maker_count` integer DEFAULT 0 NOT NULL,
	`qualified_lead_count` integer DEFAULT 0 NOT NULL,
	`crm_opportunity_count` integer DEFAULT 0 NOT NULL,
	`converted_revenue_cents` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_date` ON `academic_events` (`event_date`);--> statement-breakpoint
CREATE TABLE `aftersales_tickets` (
	`work_item_id` text PRIMARY KEY NOT NULL,
	`severity` text NOT NULL,
	`category` text NOT NULL,
	`responsible_department` text,
	`sla_due_at` integer NOT NULL,
	`root_cause` text,
	`capa_id` text,
	`customer_confirmed_at` integer,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_aftersales_sla` ON `aftersales_tickets` (`sla_due_at`,`severity`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`result` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_actor_created` ON `audit_logs` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `evidence_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`synology_path` text NOT NULL,
	`file_name` text NOT NULL,
	`category` text NOT NULL,
	`product_line` text,
	`effective_from` integer,
	`expires_at` integer,
	`checksum` text,
	`indexed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_evidence_path` ON `evidence_documents` (`synology_path`);--> statement-breakpoint
CREATE INDEX `idx_evidence_category_product` ON `evidence_documents` (`category`,`product_line`);--> statement-breakpoint
CREATE INDEX `idx_evidence_expiry` ON `evidence_documents` (`expires_at`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`base_url` text NOT NULL,
	`state` text NOT NULL,
	`last_success_at` integer,
	`last_error_code` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_integrations_provider` ON `integrations` (`provider`);--> statement-breakpoint
CREATE TABLE `qualification_projects` (
	`work_item_id` text PRIMARY KEY NOT NULL,
	`completeness_percent` integer DEFAULT 0 NOT NULL,
	`critical_gap_count` integer DEFAULT 0 NOT NULL,
	`review_stage` text NOT NULL,
	`planned_review_at` integer,
	`version_label` text,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_qualification_stage` ON `qualification_projects` (`review_stage`,`planned_review_at`);--> statement-breakpoint
CREATE TABLE `research_projects` (
	`work_item_id` text PRIMARY KEY NOT NULL,
	`parent_project_id` text,
	`business_nature` text NOT NULL,
	`project_tag` text,
	`delivery_mode` text,
	`principal_investigator` text,
	`contract_gate` integer DEFAULT false NOT NULL,
	`ethics_gate` integer DEFAULT false NOT NULL,
	`compliance_gate` integer DEFAULT false NOT NULL,
	`next_milestone` text,
	`planned_at` integer,
	`actual_at` integer,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_research_parent` ON `research_projects` (`parent_project_id`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`module` text NOT NULL,
	`status` text NOT NULL,
	`cursor` text,
	`records_read` integer DEFAULT 0 NOT NULL,
	`records_written` integer DEFAULT 0 NOT NULL,
	`error_summary` text,
	`started_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_sync_provider_started` ON `sync_runs` (`provider`,`started_at`);--> statement-breakpoint
CREATE TABLE `training_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`learner_external_id` text NOT NULL,
	`learning_path` text NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`exam_score` integer,
	`certified_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_training_work_learner` ON `training_enrollments` (`work_item_id`,`learner_external_id`);--> statement-breakpoint
CREATE INDEX `idx_training_path_progress` ON `training_enrollments` (`learning_path`,`progress_percent`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`department` text,
	`role` text DEFAULT 'member' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`module` text NOT NULL,
	`title` text NOT NULL,
	`customer_id` text,
	`customer_name` text,
	`region` text,
	`priority` text DEFAULT 'P2' NOT NULL,
	`status` text NOT NULL,
	`stage` text NOT NULL,
	`owner_id` text,
	`due_at` integer,
	`source_updated_at` integer,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_work_items_module_external` ON `work_items` (`module`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_work_items_module_status` ON `work_items` (`module`,`status`);--> statement-breakpoint
CREATE INDEX `idx_work_items_owner_due` ON `work_items` (`owner_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_work_items_customer` ON `work_items` (`customer_id`);