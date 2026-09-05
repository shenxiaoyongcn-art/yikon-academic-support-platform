PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_research_budget_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`hospital` text NOT NULL,
	`period` text NOT NULL,
	`region` text NOT NULL,
	`total_cents` integer NOT NULL,
	`used_cents` integer DEFAULT 0 NOT NULL,
	`locked_cents` integer DEFAULT 0 NOT NULL,
	`platform_planned_cents` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`evidence` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "research_budget_nonnegative" CHECK("__new_research_budget_packages"."total_cents" >= 0 AND "__new_research_budget_packages"."used_cents" >= 0 AND "__new_research_budget_packages"."locked_cents" >= 0 AND "__new_research_budget_packages"."platform_planned_cents" >= 0 AND "__new_research_budget_packages"."total_cents" >= "__new_research_budget_packages"."used_cents" + "__new_research_budget_packages"."locked_cents" + "__new_research_budget_packages"."platform_planned_cents")
);
--> statement-breakpoint
INSERT INTO `__new_research_budget_packages`("id", "customer_id", "hospital", "period", "region", "total_cents", "used_cents", "locked_cents", "platform_planned_cents", "revision", "evidence", "updated_at") SELECT "id", "customer_id", "hospital", "period", "region", "total_cents", "used_cents", "locked_cents", 0, "revision", "evidence", "updated_at" FROM `research_budget_packages`;--> statement-breakpoint
DROP TABLE `research_budget_packages`;--> statement-breakpoint
ALTER TABLE `__new_research_budget_packages` RENAME TO `research_budget_packages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_research_budget_hospital_period` ON `research_budget_packages` (`customer_id`,`period`);
