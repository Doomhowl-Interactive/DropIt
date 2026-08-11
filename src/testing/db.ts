import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { Db } from '../server/db/db';
import * as schema from '../server/db/schema';

/**
 * An in-memory database with the production schema applied, for tests that
 * want to exercise real Drizzle queries rather than a hand-written fake.
 *
 * The statements mirror drizzle/0000_cute_naoko.sql; `migrate()` is covered
 * separately in src/server/db/migrate.spec.ts.
 */
export function createTestDb(): Db {
  const sqlite = new Database(':memory:');

  sqlite.exec(`
    CREATE TABLE file_records (
      id text PRIMARY KEY NOT NULL,
      deletion_id text,
      view_id text,
      filename text,
      path text,
      size integer,
      download_count integer,
      deleted integer,
      created_at text,
      expires_at text,
      delete_after_download integer DEFAULT false
    );
    CREATE TABLE users (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      created_at text,
      updated_at text,
      deleted_at text,
      username text NOT NULL,
      password_hash text NOT NULL,
      role text NOT NULL
    );
    CREATE UNIQUE INDEX idx_users_username ON users (username);
    CREATE INDEX idx_users_deleted_at ON users (deleted_at);
  `);

  return drizzle(sqlite, { schema });
}
