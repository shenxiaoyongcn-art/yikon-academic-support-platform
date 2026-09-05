CREATE TABLE `research_contact_history` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`revision` integer NOT NULL,
	`actor` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `research_customer_contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_contact_history_revision` ON `research_contact_history` (`contact_id`,`revision`);--> statement-breakpoint
CREATE TABLE `research_customer_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`bmp_contact_id` text,
	`name` text NOT NULL,
	`department` text NOT NULL,
	`job_title` text NOT NULL,
	`professional_title` text DEFAULT '' NOT NULL,
	`research_background` text NOT NULL,
	`expertise_json` text DEFAULT '[]' NOT NULL,
	`work_email` text DEFAULT '' NOT NULL,
	`work_phone` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`evidence` text NOT NULL,
	`verified_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `research_customers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "research_contact_status" CHECK("research_customer_contacts"."status" IN ('active', 'inactive')),
	CONSTRAINT "research_contact_source" CHECK("research_customer_contacts"."source" IN ('manual', 'bmp_sync', 'it_import')),
	CONSTRAINT "research_contact_revision" CHECK("research_customer_contacts"."revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_contact_external` ON `research_customer_contacts` (`customer_id`,`source`,`bmp_contact_id`);--> statement-breakpoint
CREATE INDEX `idx_research_contact_customer_status` ON `research_customer_contacts` (`customer_id`,`status`);