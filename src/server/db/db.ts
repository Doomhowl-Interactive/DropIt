import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config';

export type Dialect = 'sqlite' | 'postgres' | 'mysql';

/**
 * Tiny database facade. SQL is written with `?` placeholders (SQLite/MySQL
 * style); the Postgres driver rewrites them to `$1..$n`.
 */
export interface Db {
  readonly dialect: Dialect;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export async function connect(): Promise<Db> {
  const type = config.dbType;
  let dsn = config.databaseUrl;

  switch (type) {
    case 'sqlite':
      return connectSqlite(dsn || './data/database.db');
    case 'postgres':
      if (!dsn) throw new Error('DATABASE_URL is required for postgres');
      return connectPostgres(dsn);
    case 'mysql':
      if (!dsn) throw new Error('DATABASE_URL is required for mysql');
      return connectMysql(dsn);
    default:
      throw new Error(`unsupported DB_TYPE: ${type}`);
  }
}

async function connectSqlite(filePath: string): Promise<Db> {
  // node:sqlite is built into Node (>=22.5), so no native module to compile.
  const { DatabaseSync } = await import('node:sqlite');
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  return {
    dialect: 'sqlite',
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).get(...(params as never[])) as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      db.prepare(sql).run(...(params as never[]));
    },
    async exec(sql: string) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
  };
}

/** Rewrites `?` placeholders into Postgres' `$1..$n` form. */
function toPgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function connectPostgres(dsn: string): Promise<Db> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: dsn });

  return {
    dialect: 'postgres',
    async all<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(toPgSql(sql), params as never[]);
      return res.rows as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(toPgSql(sql), params as never[]);
      return res.rows[0] as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      await pool.query(toPgSql(sql), params as never[]);
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

async function connectMysql(dsn: string): Promise<Db> {
  const mysql = await import('mysql2/promise');
  const pool = mysql.createPool(dsn);

  return {
    dialect: 'mysql',
    async all<T>(sql: string, params: unknown[] = []) {
      const [rows] = await pool.query(sql, params as never[]);
      return rows as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const [rows] = await pool.query(sql, params as never[]);
      return (rows as T[])[0];
    },
    async run(sql: string, params: unknown[] = []) {
      await pool.query(sql, params as never[]);
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

/** SQLite/MySQL hand back 0/1 for booleans, Postgres hands back real booleans. */
export function toBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't';
}

export function fromBool(value: boolean, dialect: Dialect): unknown {
  return dialect === 'postgres' ? value : value ? 1 : 0;
}

export function toDbDate(date: Date, dialect: Dialect): unknown {
  return dialect === 'sqlite' ? date.toISOString() : date;
}

/**
 * Accepts ISO strings, native driver `Date`s and the layout GORM used to write
 * into SQLite ("2026-08-11 00:39:09.044218258+02:00").
 */
export function fromDbDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value !== 'string') return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  // "YYYY-MM-DD HH:MM:SS[.fraction][offset]" -> ISO
  const normalized = value
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
