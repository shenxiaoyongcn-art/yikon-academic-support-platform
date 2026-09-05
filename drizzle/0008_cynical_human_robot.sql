PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_research_customer_contacts` (
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
	`source_version` text,
	`source_updated_at` integer,
	`synced_at` integer,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `research_customers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "research_contact_status" CHECK("__new_research_customer_contacts"."status" IN ('active', 'inactive')),
	CONSTRAINT "research_contact_source" CHECK("__new_research_customer_contacts"."source" IN ('manual', 'bmp_sync', 'it_import')),
	CONSTRAINT "research_contact_verification" CHECK("__new_research_customer_contacts"."verification_status" IN ('verified', 'unverified')),
	CONSTRAINT "research_contact_revision" CHECK("__new_research_customer_contacts"."revision" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_research_customer_contacts`("id", "customer_id", "bmp_contact_id", "name", "department", "job_title", "professional_title", "research_background", "expertise_json", "work_email", "work_phone", "status", "source", "evidence", "verified_at", "source_version", "source_updated_at", "synced_at", "verification_status", "revision", "updated_by", "updated_at") SELECT "id", "customer_id", "bmp_contact_id", "name", "department", "job_title", "professional_title", "research_background", "expertise_json", "work_email", "work_phone", "status", "source", "evidence", "verified_at", NULL, NULL, NULL, 'unverified', "revision", "updated_by", "updated_at" FROM `research_customer_contacts`;--> statement-breakpoint
DROP TABLE `research_customer_contacts`;--> statement-breakpoint
ALTER TABLE `__new_research_customer_contacts` RENAME TO `research_customer_contacts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_contact_external` ON `research_customer_contacts` (`customer_id`,`source`,`bmp_contact_id`);--> statement-breakpoint
CREATE INDEX `idx_research_contact_customer_status` ON `research_customer_contacts` (`customer_id`,`status`);--> statement-breakpoint
CREATE TABLE `__new_research_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL,
	`source` text NOT NULL,
	`external_object_id` text,
	`source_version` text,
	`source_updated_at` integer,
	`synced_at` integer,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "research_customer_verification" CHECK("__new_research_customers"."verification_status" IN ('verified', 'unverified'))
);
--> statement-breakpoint
INSERT INTO `__new_research_customers`("id", "name", "region", "source", "external_object_id", "source_version", "source_updated_at", "synced_at", "verification_status", "updated_at") SELECT "id", "name", "region", "source", NULL, NULL, NULL, NULL, 'unverified', "updated_at" FROM `research_customers`;--> statement-breakpoint
DROP TABLE `research_customers`;--> statement-breakpoint
ALTER TABLE `__new_research_customers` RENAME TO `research_customers`;
