import { desc, eq } from 'drizzle-orm';
import { fromDbDate, toDbDate, type Db } from '../db/db';
import { fileRecords } from '../db/schema';

export class FileNotFoundError extends Error {
  constructor() {
    super('file not found');
    this.name = 'FileNotFoundError';
  }
}

export class FilePathAlreadyRegisteredError extends Error {
  constructor(options?: ErrorOptions) {
    super('file path already registered', options);
    this.name = 'FilePathAlreadyRegisteredError';
  }
}

export interface FileRecord {
  id: string;
  filename: string;
  /** Location on disk; never exposed over JSON. */
  path: string;
  size: number;
  downloadCount: number;
  deleted: boolean;
  createdAt: Date;
}

type Row = typeof fileRecords.$inferSelect;

function mapRow(row: Row): FileRecord {
  return {
    id: row.id,
    filename: row.filename ?? '',
    path: row.path ?? '',
    size: row.size ?? 0,
    downloadCount: row.downloadCount ?? 0,
    deleted: row.deleted ?? false,
    createdAt: fromDbDate(row.createdAt) ?? new Date(0),
  };
}

export class FileRepository {
  constructor(private readonly db: Db) {}

  async create(file: FileRecord): Promise<void> {
    try {
      await this.db.insert(fileRecords).values({
        id: file.id,
        filename: file.filename,
        path: file.path,
        size: file.size,
        downloadCount: file.downloadCount,
        deleted: file.deleted,
        createdAt: toDbDate(file.createdAt),
      });
    } catch (error) {
      if (isDuplicatePathError(error)) {
        throw new FilePathAlreadyRegisteredError({ cause: error });
      }
      throw error;
    }
  }

  async getAll(): Promise<FileRecord[]> {
    const rows = await this.db.select().from(fileRecords);
    return rows.map(mapRow);
  }

  async getById(id: string): Promise<FileRecord> {
    const [row] = await this.db.select().from(fileRecords).where(eq(fileRecords.id, id));
    if (!row) {
      throw new FileNotFoundError();
    }
    return mapRow(row);
  }

  async getPaginated(
    limit: number,
    offset: number,
  ): Promise<{ files: FileRecord[]; total: number }> {
    const total = await this.db.$count(fileRecords);
    const rows = await this.db
      .select()
      .from(fileRecords)
      .orderBy(desc(fileRecords.createdAt))
      .limit(limit)
      .offset(offset);
    return { files: rows.map(mapRow), total };
  }

  async incrementDownload(file: FileRecord): Promise<void> {
    file.downloadCount += 1;
    await this.db
      .update(fileRecords)
      .set({ downloadCount: file.downloadCount })
      .where(eq(fileRecords.id, file.id));
  }

  /** Controls whether the row's file can be served. */
  async setActive(file: FileRecord, active: boolean): Promise<void> {
    file.deleted = !active;
    await this.db
      .update(fileRecords)
      .set({ deleted: !active })
      .where(eq(fileRecords.id, file.id));
  }

  /** Hard delete: the row is removed from the database. */
  async delete(file: FileRecord): Promise<void> {
    await this.db.delete(fileRecords).where(eq(fileRecords.id, file.id));
  }
}

function isDuplicatePathError(error: unknown): boolean {
  let current = error;

  while (current && typeof current === 'object') {
    const candidate = current as {
      cause?: unknown;
      code?: unknown;
      message?: unknown;
      sqlMessage?: unknown;
    };
    const message = `${candidate.message ?? ''} ${candidate.sqlMessage ?? ''}`;

    if (candidate.code === 'ER_DUP_ENTRY' && message.includes('idx_file_records_path_hash')) {
      return true;
    }
    current = candidate.cause;
  }

  return false;
}
