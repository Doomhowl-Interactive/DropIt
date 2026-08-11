import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { describe, expect, it } from 'vitest';
import type { Db } from './db';
import * as schema from './schema';

import { migrate } from './migrate';

function emptyDb(): Db {
  return drizzle(new PGlite(), { schema }) as unknown as Db;
}

async function tableNames(db: Db): Promise<string[]> {
  const result = await db.execute<{ table_name: string }>(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  return result.rows.map((row) => row.table_name);
}

async function indexNames(db: Db): Promise<string[]> {
  const result = await db.execute<{ indexname: string }>(
    sql`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
  );
  return result.rows.map((row) => row.indexname);
}

async function columnNames(db: Db, table: string): Promise<string[]> {
  const result = await db.execute<{ column_name: string }>(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${table}`,
  );
  return result.rows.map((row) => row.column_name);
}

describe('migrate', () => {
  it('creates all three tables from scratch', async () => {
    const db = emptyDb();
    await migrate(db);

    const tables = await tableNames(db);
    expect(tables).toEqual(expect.arrayContaining(['users', 'file_records', 'api_tokens']));
  });

  it('creates the users and api_tokens indexes', async () => {
    const db = emptyDb();
    await migrate(db);

    const indexes = await indexNames(db);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'idx_users_username',
        'idx_users_deleted_at',
        'idx_api_tokens_token_hash',
        'idx_api_tokens_revoked_at',
      ]),
    );
  });

  it('creates the file_records columns', async () => {
    const db = emptyDb();
    await migrate(db);

    const columns = await columnNames(db, 'file_records');
    expect(columns).toEqual(expect.arrayContaining(['expires_at', 'delete_after_download']));
  });

  it('is idempotent when run twice', async () => {
    const db = emptyDb();
    await migrate(db);

    await expect(migrate(db)).resolves.toBeUndefined();
  });
});
