import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DRIZZLE_DIR = join(process.cwd(), 'drizzle');
const migrationFiles = readdirSync(DRIZZLE_DIR)
  .filter((name) => /^[0-9]+_.+\.sql$/.test(name))
  .sort();

/**
 * The migrations in drizzle/ are generated for MySQL/TiDB, so they cannot be
 * executed against the in-memory PGlite test harness. Until an in-memory MySQL
 * engine is available, verify the generated artifact stays consistent with the
 * schema instead of running it.
 */
const allSql = migrationFiles.map((file) => readFileSync(join(DRIZZLE_DIR, file), 'utf8')).join('\n');

describe('migrate', () => {
  it('keeps a migration folder for drizzle to apply', () => {
    expect(migrationFiles.length).toBeGreaterThan(0);
  });

  it('creates all three tables from scratch', () => {
    expect(allSql).toContain('CREATE TABLE `users`');
    expect(allSql).toContain('CREATE TABLE `file_records`');
    expect(allSql).toContain('CREATE TABLE `api_tokens`');
  });

  it('creates the users and api_tokens indexes', () => {
    expect(allSql).toContain('`idx_users_username` UNIQUE');
    expect(allSql).toContain('`idx_users_deleted_at`');
    expect(allSql).toContain('`idx_api_tokens_token_hash` UNIQUE');
    expect(allSql).toContain('`idx_api_tokens_revoked_at`');
  });

  it('creates the file_records columns', () => {
    expect(allSql).toContain('`expires_at`');
    expect(allSql).toContain('`delete_after_download` boolean DEFAULT false');
  });
});