CREATE TABLE `platform_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`identity_json` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `research_budget_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_id` text NOT NULL,
	`case_id` text,
	`actor` text NOT NULL,
	`total_delta` integer DEFAULT 0 NOT NULL,
	`used_delta` integer DEFAULT 0 NOT NULL,
	`locked_delta` integer DEFAULT 0 NOT NULL,
	`evidence` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`budget_id`) REFERENCES `research_budget_packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `research_budget_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`hospital` text NOT NULL,
	`period` text NOT NULL,
	`region` text NOT NULL,
	`total_cents` integer NOT NULL,
	`used_cents` integer DEFAULT 0 NOT NULL,
	`locked_cents` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`evidence` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "research_budget_nonnegative" CHECK("research_budget_packages"."total_cents" >= 0 AND "research_budget_packages"."used_cents" >= 0 AND "research_budget_packages"."locked_cents" >= 0 AND "research_budget_packages"."total_cents" >= "research_budget_packages"."used_cents" + "research_budget_packages"."locked_cents")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_budget_hospital_period` ON `research_budget_packages` (`customer_id`,`period`);--> statement-breakpoint
CREATE TABLE `research_cases_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`request_no` text NOT NULL,
	`project_no` text,
	`route` text NOT NULL,
	`stage` text NOT NULL,
	`revision` integer NOT NULL,
	`creator_email` text NOT NULL,
	`team` text NOT NULL,
	`region` text NOT NULL,
	`data_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_v2_request` ON `research_cases_v2` (`request_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_v2_project` ON `research_cases_v2` (`project_no`);--> statement-breakpoint
CREATE INDEX `idx_research_v2_stage` ON `research_cases_v2` (`stage`,`updated_at`);--> statement-breakpoint
CREATE TABLE `research_counters` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `research_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL,
	`source` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `research_history_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`revision` integer NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`from_stage` text NOT NULL,
	`to_stage` text NOT NULL,
	`note` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `research_cases_v2`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_history_revision` ON `research_history_v2` (`case_id`,`revision`);--> statement-breakpoint
CREATE TABLE `research_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`revision` integer NOT NULL,
	`event` text NOT NULL,
	`status` text DEFAULT 'pending_contract' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `research_cases_v2`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_outbox_version` ON `research_outbox` (`case_id`,`revision`);