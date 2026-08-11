import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate as runMigrations } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Db } from '../db/db';
import * as schema from '../db/schema';

/**
 * An in-memory database with the real migrations applied, so tests exercise the
 * same schema production does rather than a hand-written approximation.
 */
export function testDb(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  runMigrations(db, { migrationsFolder: './drizzle' });
  return db;
}

/** A throwaway storage root, plus the cleanup that goes with it. */
export function testStorageDir(): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), 'dropit-test-'));
  return { path, cleanup: () => rmSync(path, { recursive: true, force: true }) };
}
