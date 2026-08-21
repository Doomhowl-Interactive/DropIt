import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FileNotFoundError, FileRepository, type FileRecord } from './repository';
import type { ImportFileRecord } from '../../shared/types';

export interface UploadedFile {
  /** Unique upload id; doubles as the record id. */
  folderId: string;
  originalName: string;
  /** Path on disk, relative to the process working directory. */
  path: string;
  size: number;
}

export class FileService {
  constructor(
    private readonly repo: FileRepository,
    private readonly storageDir: string,
  ) {
    mkdirSync(storageDir, { recursive: true });
  }

  /** Allocates an upload id and returns the storage root as its destination. */
  createUploadFolder(): { folderId: string; folderPath: string } {
    const folderId = randomUUID();
    return { folderId, folderPath: this.storageDir };
  }

  async registerUpload(upload: UploadedFile): Promise<FileRecord> {
    const record: FileRecord = {
      id: upload.folderId,
      viewId: randomUUID(),
      filename: upload.originalName,
      path: upload.path,
      size: upload.size,
      downloadCount: 0,
      deleted: false,
      createdAt: new Date(),
    };

    await this.repo.create(record);
    return record;
  }

  /** Resolves a downloadable file and books the hit, or throws. */
  async downloadFile(id: string): Promise<FileRecord> {
    const file = await this.repo.getById(id);

    if (file.deleted) throw new FileNotFoundError();

    await this.repo.incrementDownload(file);

    return file;
  }

  async deleteFileById(id: string): Promise<FileRecord> {
    const file = await this.repo.getById(id);
    if (file.deleted) throw new FileNotFoundError();

    await this.repo.markDeleted(file);
    return file;
  }

  /** Removes the bytes from disk *and* the row from the database. */
  async forceDelete(id: string): Promise<FileRecord> {
    const file = await this.repo.getById(id);

    rmSync(file.path, { force: true });
    await this.repo.delete(file);

    return file;
  }

  getPaginatedFiles(limit: number, offset: number) {
    return this.repo.getPaginated(limit, offset);
  }

  getFileById(id: string) {
    return this.repo.getById(id);
  }

  getFileByViewId(viewId: string) {
    return this.repo.getByViewId(viewId);
  }

  getAllFiles() {
    return this.repo.getAll();
  }

  async importFiles(records: ImportFileRecord[]): Promise<void> {
    for (const incoming of records) {
      const existing = await this.repo.getById(incoming.id).catch(() => null);
      if (existing) continue;

      await this.repo.create({
        id: incoming.id,
        viewId: randomUUID(),
        filename: incoming.filename,
        path: this.buildPath(incoming.filename),
        size: Number(incoming.size ?? 0),
        downloadCount: Number(incoming.download_count ?? 0),
        deleted: Boolean(incoming.deleted),
        createdAt: incoming.created_at ? new Date(incoming.created_at) : new Date(),
      });
    }
  }

  /**
   * Registers files that have bytes on disk but no database row — leftovers of
   * an interrupted upload. Returns how many orphans were picked up.
   */
  async addOrphans(): Promise<number> {
    const entries = readdirSync(this.storageDir, { withFileTypes: true });
    let added = 0;

    for (const entry of entries) {
      console.log(`Checking if orphan: ${entry.name}`);

      if (!entry.isFile()) {
        continue;
      }

      if (await this.repo.getByIdOrNull(entry.name).catch((e) => console.error(e))) {
        console.log(`Skipping ${entry.name} because it already exists in the database`);
        continue;
      }

      const path = join(this.storageDir, entry.name);
      const stats = statSync(path);

      await this.repo.create({
        id: entry.name,
        viewId: randomUUID(),
        filename: entry.name,
        path,
        size: stats.size,
        downloadCount: 0,
        deleted: false,
        createdAt: stats.mtime,
      });
      added += 1;
    }

    return added;
  }

  private buildPath(filename: string): string {
    return join(this.storageDir, filename);
  }
}

export { FileNotFoundError };
export type { FileRecord };
export type { ImportFileRecord };
