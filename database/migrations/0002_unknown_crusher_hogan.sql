PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_clientes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cpf` text,
	`rg` text,
	`birth_date` text,
	`mother_name` text,
	`gender` text,
	`nationality` text,
	`marital_status` text,
	`profession` text,
	`phone` text,
	`origin` text,
	`cep` text,
	`address` text,
	`neighborhood` text,
	`city` text,
	`state` text,
	`representative_name` text,
	`representative_cpf` text,
	`gov_password` text,
	`nis` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_clientes`("id", "name", "cpf", "rg", "birth_date", "mother_name", "gender", "nationality", "marital_status", "profession", "phone", "origin", "cep", "address", "neighborhood", "city", "state", "representative_name", "representative_cpf", "gov_password", "nis", "created_at") SELECT "id", "name", "cpf", "rg", "birth_date", "mother_name", "gender", "nationality", "marital_status", "profession", "phone", "origin", "cep", "address", "neighborhood", "city", "state", "representative_name", "representative_cpf", "gov_password", "nis", "created_at" FROM `clientes`;--> statement-breakpoint
DROP TABLE `clientes`;--> statement-breakpoint
ALTER TABLE `__new_clientes` RENAME TO `clientes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`role_id` text,
	`sector_id` text,
	`module` text NOT NULL,
	`action` text NOT NULL,
	`restricted_fields` text,
	`allowed` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_permissions`("id", "user_id", "role_id", "sector_id", "module", "action", "restricted_fields", "allowed", "created_at") SELECT "id", "user_id", "role_id", "sector_id", "module", "action", "restricted_fields", "allowed", "created_at" FROM `permissions`;--> statement-breakpoint
DROP TABLE `permissions`;--> statement-breakpoint
ALTER TABLE `__new_permissions` RENAME TO `permissions`;--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_user_module_action_idx` ON `permissions` (`user_id`,`module`,`action`);--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_role_module_action_idx` ON `permissions` (`role_id`,`module`,`action`);--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_sector_module_action_idx` ON `permissions` (`sector_id`,`module`,`action`);