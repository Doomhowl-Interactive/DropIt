import type { Db, Dialect } from './db';

/**
 * Creates the schema when missing. The SQLite DDL is byte-for-byte compatible
 * with what the previous GORM-based server produced, so an existing
 * data/database.db keeps working untouched.
 */
export async function migrate(db: Db): Promise<void> {
  for (const statement of schema(db.dialect)) {
    await db.exec(statement);
  }

  // Columns the admin console renders but that predate this schema.
  await addColumn(db, 'file_records', 'expires_at', {
    sqlite: 'datetime',
    postgres: 'timestamptz',
    mysql: 'datetime(3) NULL',
  });
  await addColumn(db, 'file_records', 'delete_after_download', {
    sqlite: 'numeric DEFAULT false',
    postgres: 'boolean DEFAULT false',
    mysql: 'tinyint(1) DEFAULT 0',
  });
}

function schema(dialect: Dialect): string[] {
  switch (dialect) {
    case 'sqlite':
      return [
        `CREATE TABLE IF NOT EXISTS \`users\` (
           \`id\` integer PRIMARY KEY AUTOINCREMENT,
           \`created_at\` datetime,
           \`updated_at\` datetime,
           \`deleted_at\` datetime,
           \`username\` text NOT NULL,
           \`password_hash\` text NOT NULL,
           \`role\` text NOT NULL,
           \`force_change_password\` numeric DEFAULT false)`,
        'CREATE UNIQUE INDEX IF NOT EXISTS `idx_users_username` ON `users`(`username`)',
        'CREATE INDEX IF NOT EXISTS `idx_users_deleted_at` ON `users`(`deleted_at`)',
        `CREATE TABLE IF NOT EXISTS \`file_records\` (
           \`id\` text,
           \`deletion_id\` text,
           \`view_id\` text,
           \`filename\` text,
           \`path\` text,
           \`size\` integer,
           \`download_count\` integer,
           \`deleted\` numeric,
           \`created_at\` datetime,
           PRIMARY KEY (\`id\`))`,
      ];
    case 'postgres':
      return [
        `CREATE TABLE IF NOT EXISTS users (
           id bigserial PRIMARY KEY,
           created_at timestamptz,
           updated_at timestamptz,
           deleted_at timestamptz,
           username text NOT NULL,
           password_hash text NOT NULL,
           role text NOT NULL,
           force_change_password boolean DEFAULT false)`,
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)',
        'CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)',
        `CREATE TABLE IF NOT EXISTS file_records (
           id text PRIMARY KEY,
           deletion_id text,
           view_id text,
           filename text,
           path text,
           size bigint,
           download_count bigint,
           deleted boolean,
           created_at timestamptz)`,
      ];
    case 'mysql':
      return [
        `CREATE TABLE IF NOT EXISTS users (
           id bigint AUTO_INCREMENT PRIMARY KEY,
           created_at datetime(3) NULL,
           updated_at datetime(3) NULL,
           deleted_at datetime(3) NULL,
           username varchar(191) NOT NULL,
           password_hash longtext NOT NULL,
           role longtext NOT NULL,
           force_change_password tinyint(1) DEFAULT 0,
           UNIQUE KEY idx_users_username (username),
           KEY idx_users_deleted_at (deleted_at))`,
        `CREATE TABLE IF NOT EXISTS file_records (
           id varchar(191) NOT NULL PRIMARY KEY,
           deletion_id longtext,
           view_id longtext,
           filename longtext,
           path longtext,
           size bigint,
           download_count bigint,
           deleted tinyint(1),
           created_at datetime(3) NULL)`,
      ];
  }
}

async function addColumn(
  db: Db,
  table: string,
  column: string,
  types: Record<Dialect, string>,
): Promise<void> {
  if (await hasColumn(db, table, column)) return;
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${types[db.dialect]}`);
}

async function hasColumn(db: Db, table: string, column: string): Promise<boolean> {
  if (db.dialect === 'sqlite') {
    const rows = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
    return rows.some((r) => r.name === column);
  }

  const scope =
    db.dialect === 'mysql' ? 'table_schema = DATABASE()' : 'table_schema = current_schema()';
  const row = await db.get<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE ${scope} AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  return Number(row?.n ?? 0) > 0;
}
