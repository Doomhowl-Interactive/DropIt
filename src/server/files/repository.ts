import { desc, eq } from 'drizzle-orm';
import { fromDbDate, toDbDate, type Db } from '../db/db';
import { fileRecords } from '../db/schema';

export class FileNotFoundError extends Error {
  constructor() {
    super('file not found');
    this.name = 'FileNotFoundError';
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
    await this.db.insert(fileRecords).values({
      id: file.id,
      filename: file.filename,
      path: file.path,
      size: file.size,
      downloadCount: file.downloadCount,
      deleted: file.deleted,
      createdAt: toDbDate(file.createdAt),
    });
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

  async getByIdOrNull(id: string): Promise<FileRecord | null> {
    const [row] = await this.db.select().from(fileRecords).where(eq(fileRecords.id, id));
    if (!row) {
      return null;
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

  /** Soft delete: the row stays, the file stops being served. */
  async markDeleted(file: FileRecord): Promise<void> {
    file.deleted = true;
    await this.db.update(fileRecords).set({ deleted: true }).where(eq(fileRecords.id, file.id));
  }

  /** Hard delete: the row is removed from the database. */
  async delete(file: FileRecord): Promise<void> {
    await this.db.delete(fileRecords).where(eq(fileRecords.id, file.id));
  }
}
