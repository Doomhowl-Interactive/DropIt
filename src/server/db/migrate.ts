import { migrate as runMigrations } from 'drizzle-orm/mysql2/migrator';
import type { Db } from './db';

/** Applies the generated migrations in ../../../drizzle (see drizzle.config.ts). */
export async function migrate(db: Db): Promise<void> {
  await runMigrations(db, { migrationsFolder: './drizzle' });
}