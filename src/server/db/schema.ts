import {
  boolean,
  index,
  int,
  mysqlTable,
  serial,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * Dates are stored as free-form text rather than a Drizzle timestamp mode:
 * the table predates this app and also holds GORM-formatted strings
 * ("2026-08-11 00:39:09.044218258+02:00") that a strict mode can't parse.
 * See `fromDbDate` in ./db.ts for the read-side conversion.
 *
 * Indexed string columns use varchar: MySQL rejects TEXT in PRIMARY KEY /
 * UNIQUE / INDEX without an explicit prefix length (ER_BLOB_KEY_WITHOUT_LENGTH).
 */
export const users = mysqlTable(
  'users',
  {
    id: serial('id').primaryKey(),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
    deletedAt: varchar('deleted_at', { length: 64 }),
    username: varchar('username', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 32 }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_username').on(table.username),
    index('idx_users_deleted_at').on(table.deletedAt),
  ],
);

/**
 * Long-lived bearer API tokens. Agents and scripts cannot re-do a browser login,
 * so they get their own credential rather than the 24h session JWT — one can be
 * revoked without logging anyone out. Accepted on normal /api routes and /mcp.
 *
 * Only the sha-256 of the secret is stored; `prefix` exists purely so the admin
 * UI can tell two tokens apart after the plaintext is gone.
 */
export const apiTokens = mysqlTable(
  'api_tokens',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    prefix: varchar('prefix', { length: 32 }).notNull(),
    userId: int('user_id').notNull(),
    createdAt: text('created_at'),
    lastUsedAt: text('last_used_at'),
    expiresAt: text('expires_at'),
    revokedAt: varchar('revoked_at', { length: 64 }),
  },
  (table) => [
    uniqueIndex('idx_api_tokens_token_hash').on(table.tokenHash),
    index('idx_api_tokens_revoked_at').on(table.revokedAt),
  ],
);

export const fileRecords = mysqlTable('file_records', {
  id: varchar('id', { length: 64 }).primaryKey(),
  deletionId: varchar('deletion_id', { length: 64 }),
  viewId: varchar('view_id', { length: 64 }),
  filename: text('filename'),
  path: text('path'),
  size: int('size'),
  downloadCount: int('download_count'),
  deleted: boolean('deleted'),
  createdAt: text('created_at'),
  expiresAt: text('expires_at'),
  deleteAfterDownload: boolean('delete_after_download').default(false),
});
