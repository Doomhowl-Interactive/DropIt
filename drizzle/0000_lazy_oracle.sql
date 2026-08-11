CREATE TABLE "file_records" (
	"id" text PRIMARY KEY NOT NULL,
	"deletion_id" text,
	"view_id" text,
	"filename" text,
	"path" text,
	"size" integer,
	"download_count" integer,
	"deleted" boolean,
	"created_at" text,
	"expires_at" text,
	"delete_after_download" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "mcp_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" text,
	"last_used_at" text,
	"expires_at" text,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" text,
	"updated_at" text,
	"deleted_at" text,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mcp_tokens_token_hash" ON "mcp_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_mcp_tokens_revoked_at" ON "mcp_tokens" USING btree ("revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_deleted_at" ON "users" USING btree ("deleted_at");