import { fromBool, fromDbDate, toBool, toDbDate, type Db } from '../db/db';

export class FileNotFoundError extends Error {
  constructor() {
    super('file not found');
    this.name = 'FileNotFoundError';
  }
}

export interface FileRecord {
  id: string;
  deletionId: string;
  viewId: string;
  filename: string;
  /** Location on disk; never exposed over JSON. */
  path: string;
  size: number;
  downloadCount: number;
  deleted: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  deleteAfterDownload: boolean;
}

interface Row {
  id: string;
  deletion_id: string;
  view_id: string;
  filename: string;
  path: string;
  size: number | string;
  download_count: number | string;
  deleted: unknown;
  created_at: unknown;
  expires_at: unknown;
  delete_after_download: unknown;
}

function mapRow(row: Row): FileRecord {
  return {
    id: row.id,
    deletionId: row.deletion_id,
    viewId: row.view_id,
    filename: row.filename,
    path: row.path,
    size: Number(row.size ?? 0),
    downloadCount: Number(row.download_count ?? 0),
    deleted: toBool(row.deleted),
    createdAt: fromDbDate(row.created_at) ?? new Date(0),
    expiresAt: fromDbDate(row.expires_at),
    deleteAfterDownload: toBool(row.delete_after_download),
  };
}

const COLUMNS = `id, deletion_id, view_id, filename, path, size,
                 download_count, deleted, created_at, expires_at, delete_after_download`;

export class FileRepository {
  constructor(private readonly db: Db) {}

  async create(file: FileRecord): Promise<void> {
    await this.db.run(
      `INSERT INTO file_records (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        file.id,
        file.deletionId,
        file.viewId,
        file.filename,
        file.path,
        file.size,
        file.downloadCount,
        fromBool(file.deleted, this.db.dialect),
        toDbDate(file.createdAt, this.db.dialect),
        file.expiresAt ? toDbDate(file.expiresAt, this.db.dialect) : null,
        fromBool(file.deleteAfterDownload, this.db.dialect),
      ],
    );
  }

  async getAll(): Promise<FileRecord[]> {
    const rows = await this.db.all<Row>(`SELECT ${COLUMNS} FROM file_records`);
    return rows.map(mapRow);
  }

  async getById(id: string): Promise<FileRecord> {
    const row = await this.db.get<Row>(`SELECT ${COLUMNS} FROM file_records WHERE id = ?`, [id]);
    if (!row) throw new FileNotFoundError();
    return mapRow(row);
  }

  async getByDeletionId(deletionId: string): Promise<FileRecord> {
    const row = await this.db.get<Row>(
      `SELECT ${COLUMNS} FROM file_records WHERE deletion_id = ?`,
      [deletionId],
    );
    if (!row) throw new FileNotFoundError();
    return mapRow(row);
  }

  async getByViewId(viewId: string): Promise<FileRecord> {
    const row = await this.db.get<Row>(`SELECT ${COLUMNS} FROM file_records WHERE view_id = ?`, [
      viewId,
    ]);
    if (!row) throw new FileNotFoundError();
    return mapRow(row);
  }

  async getPaginated(
    limit: number,
    offset: number,
  ): Promise<{ files: FileRecord[]; total: number }> {
    const count = await this.db.get<{ n: number | string }>(
      'SELECT COUNT(*) AS n FROM file_records',
    );
    const rows = await this.db.all<Row>(
      `SELECT ${COLUMNS} FROM file_records ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return { files: rows.map(mapRow), total: Number(count?.n ?? 0) };
  }

  async incrementDownload(file: FileRecord): Promise<void> {
    file.downloadCount += 1;
    await this.db.run('UPDATE file_records SET download_count = ? WHERE id = ?', [
      file.downloadCount,
      file.id,
    ]);
  }

  /** Soft delete: the row stays, the file stops being served. */
  async markDeleted(file: FileRecord): Promise<void> {
    file.deleted = true;
    await this.db.run('UPDATE file_records SET deleted = ? WHERE id = ?', [
      fromBool(true, this.db.dialect),
      file.id,
    ]);
  }

  /** Hard delete: the row is removed from the database. */
  async delete(file: FileRecord): Promise<void> {
    await this.db.run('DELETE FROM file_records WHERE id = ?', [file.id]);
  }
}
