CREATE TABLE `api_tokens` (
	`id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`user_id` int NOT NULL,
	`created_at` text,
	`last_used_at` text,
	`expires_at` text,
	`revoked_at` text,
	CONSTRAINT `api_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_api_tokens_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `file_records` (
	`id` text NOT NULL,
	`deletion_id` text,
	`view_id` text,
	`filename` text,
	`path` text,
	`size` int,
	`download_count` int,
	`deleted` boolean,
	`created_at` text,
	`expires_at` text,
	`delete_after_download` boolean DEFAULT false,
	CONSTRAINT `file_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_users_username` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE INDEX `idx_api_tokens_revoked_at` ON `api_tokens` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `idx_users_deleted_at` ON `users` (`deleted_at`);