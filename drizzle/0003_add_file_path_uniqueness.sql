ALTER TABLE `file_records` ADD `path_hash` binary(32) GENERATED ALWAYS AS ((unhex(sha2(`path`, 256)))) STORED;--> statement-breakpoint
ALTER TABLE `file_records` ADD CONSTRAINT `idx_file_records_path_hash` UNIQUE(`path_hash`);
