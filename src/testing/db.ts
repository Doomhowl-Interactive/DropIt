import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { Db } from '../server/db/db';
import * as schema from '../server/db/schema';

/**
 * An in-memory Postgres (via PGlite) database with the production schema
 * applied, for tests that want to exercise real Drizzle queries rather than a
 * hand-written fake.
 *
 * The statements mirror the migrations in drizzle/; `migrate()` is covered
 * separately in src/server/db/migrate.spec.ts.
 */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite();

  await client.exec(`
    CREATE TABLE file_records (
      id text PRIMARY KEY NOT NULL,
      deletion_id text,
      view_id text,
      filename text,
      path text,
      size integer,
      download_count integer,
      deleted boolean,
      created_at text,
      expires_at text,
      delete_after_download boolean DEFAULT false
    );
    CREATE TABLE users (
      id serial PRIMARY KEY NOT NULL,
      created_at text,
      updated_at text,
      deleted_at text,
      username text NOT NULL,
      password_hash text NOT NULL,
      role text NOT NULL
    );
    CREATE UNIQUE INDEX idx_users_username ON users (username);
    CREATE INDEX idx_users_deleted_at ON users (deleted_at);
    CREATE TABLE mcp_tokens (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      token_hash text NOT NULL,
      prefix text NOT NULL,
      user_id integer NOT NULL,
      created_at text,
      last_used_at text,
      expires_at text,
      revoked_at text
    );
    CREATE UNIQUE INDEX idx_mcp_tokens_token_hash ON mcp_tokens (token_hash);
    CREATE INDEX idx_mcp_tokens_revoked_at ON mcp_tokens (revoked_at);
  `);

  return drizzle(client, { schema }) as unknown as Db;
}
