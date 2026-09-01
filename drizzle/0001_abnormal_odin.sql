CREATE TABLE `medical_lab_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`hospital_id` text NOT NULL,
	`hospital_name` text NOT NULL,
	`period` text NOT NULL,
	`sample_count` integer DEFAULT 0 NOT NULL,
	`amplification_success_bp` integer,
	`positive_bp` integer,
	`negative_bp` integer,
	`mosaic_bp` integer,
	`source_updated_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_medical_lab_external` ON `medical_lab_metrics` (`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_medical_lab_hospital_period` ON `medical_lab_metrics` (`hospital_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_medical_lab_period` ON `medical_lab_metrics` (`period`);--> statement-breakpoint
CREATE TABLE `pgd_center_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`hospital_id` text NOT NULL,
	`hospital_name` text NOT NULL,
	`province` text NOT NULL,
	`stage` text NOT NULL,
	`period` text NOT NULL,
	`total_cycle_count` integer,
	`pgd_cycle_count` integer,
	`conversion_bp` integer,
	`data_owner_id` text,
	`source_updated_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`data_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pgd_center_external` ON `pgd_center_operations` (`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pgd_center_hospital_period` ON `pgd_center_operations` (`hospital_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_pgd_center_stage_period` ON `pgd_center_operations` (`stage`,`period`);--> statement-breakpoint
CREATE INDEX `idx_pgd_center_province` ON `pgd_center_operations` (`province`);--> statement-breakpoint
CREATE TABLE `research_economics` (
	`work_item_id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`hospital_name` text NOT NULL,
	`labor_hours` integer DEFAULT 0 NOT NULL,
	`sample_cost_cents` integer DEFAULT 0 NOT NULL,
	`external_cost_cents` integer DEFAULT 0 NOT NULL,
	`other_cost_cents` integer DEFAULT 0 NOT NULL,
	`attributable_revenue_cents` integer,
	`paper_count` integer DEFAULT 0 NOT NULL,
	`patent_count` integer DEFAULT 0 NOT NULL,
	`conversion_note` text,
	`calculated_at` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_research_economics_hospital` ON `research_economics` (`hospital_id`,`calculated_at`);--> statement-breakpoint
CREATE TABLE `sales_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`hospital_id` text NOT NULL,
	`hospital_name` text NOT NULL,
	`product_code` text NOT NULL,
	`product_name` text NOT NULL,
	`owner_id` text,
	`period` text NOT NULL,
	`sales_quantity` integer DEFAULT 0 NOT NULL,
	`target_quantity` integer,
	`revenue_cents` integer DEFAULT 0 NOT NULL,
	`source_updated_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sales_facts_external` ON `sales_facts` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_product_period` ON `sales_facts` (`product_code`,`period`);--> statement-breakpoint
CREATE INDEX `idx_sales_hospital_period` ON `sales_facts` (`hospital_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_sales_owner_period` ON `sales_facts` (`owner_id`,`period`);--> statement-breakpoint
PRAGMA optimize;
