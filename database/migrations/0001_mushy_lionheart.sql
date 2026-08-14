CREATE TABLE `client_custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`field_name` text NOT NULL,
	`field_type` text NOT NULL,
	`options` text,
	`required` integer DEFAULT false,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_custom_fields_field_name_unique` ON `client_custom_fields` (`field_name`);--> statement-breakpoint
CREATE TABLE `client_custom_values` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`field_id` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`client_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `client_custom_fields`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cpf_cnpj` text NOT NULL,
	`rg` text,
	`birth_date` text,
	`mother_name` text,
	`nit_pis` text,
	`phone` text,
	`email` text,
	`address` text,
	`status` text DEFAULT 'Ativo' NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clientes_cpf_cnpj_unique` ON `clientes` (`cpf_cnpj`);