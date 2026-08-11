import { migrate as runMigrations } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './db';

/**
 * Applies the generated migrations in ../../../drizzle (see drizzle.config.ts).
 * The baseline migration uses `IF NOT EXISTS`, so it's a no-op against an
 * existing data/database.db written by the previous GORM-based server.
 */
export async function migrate(db: Db): Promise<void> {
  runMigrations(db, { migrationsFolder: './drizzle' });
  await addLegacyFileColumns(db);
}

/**
 * expires_at / delete_after_download predate migration tracking: some
 * deployments already have them (added by the old hand-rolled migrator on
 * boot), others don't. SQLite has no `ALTER TABLE ADD COLUMN IF NOT EXISTS`,
 * so a plain generated migration would crash on whichever side guessed
 * wrong — this tolerates both by ignoring "already exists".
 */
async function addLegacyFileColumns(db: Db): Promise<void> {
  for (const statement of [
    'ALTER TABLE file_records ADD COLUMN expires_at datetime',
    'ALTER TABLE file_records ADD COLUMN delete_after_download numeric DEFAULT false',
  ]) {
    try {
      await db.run(statement);
    } catch (err) {
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause : err;
      if (!(cause instanceof Error) || !cause.message.includes('duplicate column name')) throw err;
    }
  }
}
