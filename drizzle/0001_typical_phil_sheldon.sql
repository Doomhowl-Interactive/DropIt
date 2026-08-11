CREATE TABLE `mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text,
	`last_used_at` text,
	`expires_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mcp_tokens_token_hash` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_mcp_tokens_revoked_at` ON `mcp_tokens` (`revoked_at`);