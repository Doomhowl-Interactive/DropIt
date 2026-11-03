ALTER TABLE `file_records` MODIFY COLUMN `expires_at` varchar(64);--> statement-breakpoint
CREATE INDEX `idx_file_records_expires_at` ON `file_records` (`expires_at`);