ALTER TABLE `api_tokens` DROP COLUMN `expires_at`;--> statement-breakpoint
ALTER TABLE `file_records` DROP COLUMN `deletion_id`;--> statement-breakpoint
ALTER TABLE `file_records` DROP COLUMN `expires_at`;--> statement-breakpoint
ALTER TABLE `file_records` DROP COLUMN `delete_after_download`;