ALTER TABLE "mcp_tokens" RENAME TO "api_tokens";--> statement-breakpoint
ALTER INDEX "idx_mcp_tokens_token_hash" RENAME TO "idx_api_tokens_token_hash";--> statement-breakpoint
ALTER INDEX "idx_mcp_tokens_revoked_at" RENAME TO "idx_api_tokens_revoked_at";
