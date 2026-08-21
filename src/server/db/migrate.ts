import { migrate as runMigrations } from 'drizzle-orm/mysql2/migrator';
import type { Db } from './db';

/**
 * Drizzle wraps driver errors in a `DrizzleQueryError` whose message is only
 * "Failed query: …", leaving the actual SQL error on `cause`. Unwrap it so a
 * failed migration says *why* it failed instead of dumping a bare query.
 */
function reason(error: unknown): string {
  if (error instanceof Error) {
    const cause = 'cause' in error ? (error as Error & { cause?: unknown }).cause : undefined;
    if (cause instanceof Error) return cause.message;
    return error.message;
  }
  return String(error);
}

/** Applies the generated migrations in ../../../drizzle (see drizzle.config.ts). */
export async function migrate(db: Db): Promise<void> {
  try {
    await runMigrations(db, { migrationsFolder: './drizzle' });
  } catch (error) {
    throw new Error(`Migration failed: ${reason(error)}`, { cause: error });
  }
}