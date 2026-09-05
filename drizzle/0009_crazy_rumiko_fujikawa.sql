PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_medical_lab_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`hospital_id` text NOT NULL,
	`hospital_name` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`period` text NOT NULL,
	`sample_count` integer DEFAULT 0 NOT NULL,
	`amplification_success_bp` integer,
	`positive_bp` integer,
	`negative_bp` integer,
	`mosaic_bp` integer,
	`source_updated_at` integer,
	`source_system` text DEFAULT 'unverified' NOT NULL,
	`source_version` text,
	`synced_at` integer,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "medical_lab_verification" CHECK("__new_medical_lab_metrics"."verification_status" IN ('verified', 'unverified'))
);
--> statement-breakpoint
INSERT INTO `__new_medical_lab_metrics`("id", "external_id", "hospital_id", "hospital_name", "region", "period", "sample_count", "amplification_success_bp", "positive_bp", "negative_bp", "mosaic_bp", "source_updated_at", "source_system", "source_version", "synced_at", "verification_status", "updated_at") SELECT "id", "external_id", "hospital_id", "hospital_name", '', "period", "sample_count", "amplification_success_bp", "positive_bp", "negative_bp", "mosaic_bp", "source_updated_at", 'unverified', NULL, NULL, 'unverified', "updated_at" FROM `medical_lab_metrics`;--> statement-breakpoint
DROP TABLE `medical_lab_metrics`;--> statement-breakpoint
ALTER TABLE `__new_medical_lab_metrics` RENAME TO `medical_lab_metrics`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_medical_lab_external` ON `medical_lab_metrics` (`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_medical_lab_hospital_period` ON `medical_lab_metrics` (`hospital_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_medical_lab_period` ON `medical_lab_metrics` (`period`);--> statement-breakpoint
CREATE TABLE `__new_sales_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`hospital_id` text NOT NULL,
	`hospital_name` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`product_code` text NOT NULL,
	`product_name` text NOT NULL,
	`owner_id` text,
	`period` text NOT NULL,
	`sales_quantity` integer DEFAULT 0 NOT NULL,
	`target_quantity` integer,
	`revenue_cents` integer DEFAULT 0 NOT NULL,
	`source_updated_at` integer,
	`source_system` text DEFAULT 'unverified' NOT NULL,
	`source_version` text,
	`synced_at` integer,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sales_facts_verification" CHECK("__new_sales_facts"."verification_status" IN ('verified', 'unverified'))
);
--> statement-breakpoint
INSERT INTO `__new_sales_facts`("id", "external_id", "hospital_id", "hospital_name", "region", "product_code", "product_name", "owner_id", "period", "sales_quantity", "target_quantity", "revenue_cents", "source_updated_at", "source_system", "source_version", "synced_at", "verification_status", "updated_at") SELECT "id", "external_id", "hospital_id", "hospital_name", '', "product_code", "product_name", "owner_id", "period", "sales_quantity", "target_quantity", "revenue_cents", "source_updated_at", 'unverified', NULL, NULL, 'unverified', "updated_at" FROM `sales_facts`;--> statement-breakpoint
DROP TABLE `sales_facts`;--> statement-breakpoint
ALTER TABLE `__new_sales_facts` RENAME TO `sales_facts`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sales_facts_external` ON `sales_facts` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_product_period` ON `sales_facts` (`product_code`,`period`);--> statement-breakpoint
CREATE INDEX `idx_sales_hospital_period` ON `sales_facts` (`hospital_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_sales_owner_period` ON `sales_facts` (`owner_id`,`period`);
