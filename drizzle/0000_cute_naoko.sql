CREATE TABLE IF NOT EXISTS `file_records` (
	`id` text PRIMARY KEY NOT NULL,
	`deletion_id` text,
	`view_id` text,
	`filename` text,
	`path` text,
	`size` integer,
	`download_count` integer,
	`deleted` integer,
	`created_at` text,
	`expires_at` text,
	`delete_after_download` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_users_username` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_users_deleted_at` ON `users` (`deleted_at`);
