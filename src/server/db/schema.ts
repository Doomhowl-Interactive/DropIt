import { boolean, index, integer, pgTable, serial, text, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Dates are stored as free-form text rather than a Drizzle timestamp mode:
 * the table predates this app and also holds GORM-formatted strings
 * ("2026-08-11 00:39:09.044218258+02:00") that a strict mode can't parse.
 * See `fromDbDate` in ./db.ts for the read-side conversion.
 */
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
    deletedAt: text('deleted_at'),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_username').on(table.username),
    index('idx_users_deleted_at').on(table.deletedAt),
  ],
);

/**
 * Long-lived bearer tokens for the MCP endpoint. MCP clients run unattended and
 * cannot re-do a browser login, so they get their own credential rather than
 * the 24h session JWT — one can be revoked without logging anyone out.
 *
 * Only the sha-256 of the secret is stored; `prefix` exists purely so the admin
 * UI can tell two tokens apart after the plaintext is gone.
 */
export const mcpTokens = pgTable(
  'mcp_tokens',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    prefix: text('prefix').notNull(),
    userId: integer('user_id').notNull(),
    createdAt: text('created_at'),
    lastUsedAt: text('last_used_at'),
    expiresAt: text('expires_at'),
    revokedAt: text('revoked_at'),
  },
  (table) => [
    uniqueIndex('idx_mcp_tokens_token_hash').on(table.tokenHash),
    index('idx_mcp_tokens_revoked_at').on(table.revokedAt),
  ],
);

export const fileRecords = pgTable('file_records', {
  id: text('id').primaryKey(),
  deletionId: text('deletion_id'),
  viewId: text('view_id'),
  filename: text('filename'),
  path: text('path'),
  size: integer('size'),
  downloadCount: integer('download_count'),
  deleted: boolean('deleted'),
  createdAt: text('created_at'),
  expiresAt: text('expires_at'),
  deleteAfterDownload: boolean('delete_after_download').default(false),
});
