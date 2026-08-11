import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Dates are stored as free-form text rather than a Drizzle timestamp mode:
 * the table predates this app and also holds GORM-formatted strings
 * ("2026-08-11 00:39:09.044218258+02:00") that a strict mode can't parse.
 * See `fromDbDate` in ./db.ts for the read-side conversion.
 */
export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
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

export const fileRecords = sqliteTable('file_records', {
  id: text('id').primaryKey(),
  deletionId: text('deletion_id'),
  viewId: text('view_id'),
  filename: text('filename'),
  path: text('path'),
  size: integer('size'),
  downloadCount: integer('download_count'),
  deleted: integer('deleted', { mode: 'boolean' }),
  createdAt: text('created_at'),
  expiresAt: text('expires_at'),
  deleteAfterDownload: integer('delete_after_download', { mode: 'boolean' }).default(false),
});
