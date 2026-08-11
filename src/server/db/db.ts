import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export async function connect(): Promise<Db> {
  const filePath = config.databaseUrl || './data/database.db';
  mkdirSync(dirname(filePath), { recursive: true });

  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return drizzle(sqlite, { schema });
}

export function toDbDate(date: Date): string {
  return date.toISOString();
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
