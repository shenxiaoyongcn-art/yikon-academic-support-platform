CREATE TABLE `pgd_review_experts` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`name` text NOT NULL,
	`organization` text,
	`department` text,
	`professional_title` text,
	`province` text,
	`city` text,
	`specialties` text DEFAULT '' NOT NULL,
	`review_stages` text DEFAULT '' NOT NULL,
	`session_count` integer DEFAULT 0 NOT NULL,
	`last_review_at` integer,
	`review_history_json` text DEFAULT '[]' NOT NULL,
	`imported_by_id` text,
	`source` text DEFAULT 'excel' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`imported_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pgd_experts_external` ON `pgd_review_experts` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_pgd_experts_name_org` ON `pgd_review_experts` (`name`,`organization`);--> statement-breakpoint
CREATE INDEX `idx_pgd_experts_province` ON `pgd_review_experts` (`province`);--> statement-breakpoint
PRAGMA optimize;
