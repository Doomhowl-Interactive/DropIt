import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { Db } from './db';
import * as schema from './schema';

import { migrate } from './migrate';

function emptyDb(): Db {
  return drizzle(new Database(':memory:'), { schema });
}

function columnNames(db: Db, table: string): string[] {
  return db.all<{ name: string }>(`PRAGMA table_info(${table})`).map((column) => column.name);
}

describe('migrate', () => {
  it('creates both tables from scratch', async () => {
    const db = emptyDb();
    await migrate(db);

    const tables = db
      .all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .map((row) => row.name);

    expect(tables).toContain('users');
    expect(tables).toContain('file_records');
  });

  it('creates the users indexes', async () => {
    const db = emptyDb();
    await migrate(db);

    const indexes = db
      .all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'index'`)
      .map((row) => row.name);

    expect(indexes).toContain('idx_users_username');
    expect(indexes).toContain('idx_users_deleted_at');
  });

  it('ends up with the legacy columns present exactly once', async () => {
    const db = emptyDb();
    await migrate(db);

    const columns = columnNames(db, 'file_records');
    expect(columns.filter((name) => name === 'expires_at')).toHaveLength(1);
    expect(columns.filter((name) => name === 'delete_after_download')).toHaveLength(1);
  });

  it('tolerates a database that predates migration tracking but already has the legacy columns', async () => {
    const db = emptyDb();
    db.run(`
      CREATE TABLE file_records (
        id text PRIMARY KEY NOT NULL,
        expires_at datetime,
        delete_after_download numeric DEFAULT false
      )
    `);

    await expect(migrate(db)).resolves.toBeUndefined();
    expect(columnNames(db, 'file_records')).toEqual(
      expect.arrayContaining(['expires_at', 'delete_after_download']),
    );
  });

  it('adds the legacy columns to a table that lacks them', async () => {
    const db = emptyDb();
    db.run(`CREATE TABLE file_records (id text PRIMARY KEY NOT NULL)`);

    await migrate(db);

    expect(columnNames(db, 'file_records')).toEqual(
      expect.arrayContaining(['expires_at', 'delete_after_download']),
    );
  });

  it('is idempotent when run twice', async () => {
    const db = emptyDb();
    await migrate(db);

    await expect(migrate(db)).resolves.toBeUndefined();
    expect(columnNames(db, 'file_records').filter((name) => name === 'expires_at')).toHaveLength(1);
  });

  it('surfaces an ALTER TABLE failure that is not a duplicate column', async () => {
    const db = emptyDb();
    await migrate(db);
    db.run('DROP TABLE file_records');

    await expect(migrate(db)).rejects.toThrow(/file_records/);
  });
});
