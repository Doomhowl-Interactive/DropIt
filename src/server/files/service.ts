import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { FileNotFoundError, FileRepository, type FileRecord } from './repository';
import type { ImportFileRecord } from '../../shared/types';

export interface UploadedFile {
  /** Directory name under the storage root; doubles as the record id. */
  folderId: string;
  originalName: string;
  /** Path on disk, relative to the process working directory. */
  path: string;
  size: number;
  expiresAt?: Date | null;
  deleteAfterDownload?: boolean;
}

export class FileService {
  constructor(
    private readonly repo: FileRepository,
    private readonly storageDir: string,
  ) {
    mkdirSync(storageDir, { recursive: true });
  }

  /** Directory an in-flight upload should stream into. */
  createUploadFolder(): { folderId: string; folderPath: string } {
    const folderId = randomUUID();
    const folderPath = join(this.storageDir, folderId);
    mkdirSync(folderPath, { recursive: true });
    return { folderId, folderPath };
  }

  async registerUpload(upload: UploadedFile): Promise<FileRecord> {
    const record: FileRecord = {
      id: upload.folderId,
      deletionId: randomUUID(),
      viewId: randomUUID(),
      filename: upload.originalName,
      path: upload.path,
      size: upload.size,
      downloadCount: 0,
      deleted: false,
      createdAt: new Date(),
      expiresAt: upload.expiresAt ?? null,
      deleteAfterDownload: upload.deleteAfterDownload ?? false,
    };

    await this.repo.create(record);
    return record;
  }

  /** Resolves a downloadable file and books the hit, or throws. */
  async downloadFile(id: string): Promise<FileRecord> {
    const file = await this.repo.getById(id);

    if (file.deleted) throw new FileNotFoundError();
    if (file.expiresAt && file.expiresAt.getTime() <= Date.now()) {
      throw new FileNotFoundError();
    }

    await this.repo.incrementDownload(file);

    if (file.deleteAfterDownload) {
      await this.repo.markDeleted(file);
    }

    return file;
  }

  async deleteFileById(id: string): Promise<FileRecord> {
    const file = await this.repo.getById(id);
    if (file.deleted) throw new FileNotFoundError();

    await this.repo.markDeleted(file);
    return file;
  }

  async deleteFileByDeletionId(deletionId: string): Promise<FileRecord> {
    const file = await this.repo.getByDeletionId(deletionId);
    if (file.deleted) throw new FileNotFoundError();

    await this.repo.markDeleted(file);
    return file;
  }

  /** Removes the bytes from disk *and* the row from the database. */
  async forceDelete(id: string): Promise<FileRecord> {
    const file = await this.repo.getById(id);

    rmSync(join(this.storageDir, file.id), { recursive: true, force: true });
    await this.repo.delete(file);

    return file;
  }

  getPaginatedFiles(limit: number, offset: number) {
    return this.repo.getPaginated(limit, offset);
  }

  getFileById(id: string) {
    return this.repo.getById(id);
  }

  getFileByDeletionId(deletionId: string) {
    return this.repo.getByDeletionId(deletionId);
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
        deletionId: incoming.deletion_id,
        viewId: randomUUID(),
        filename: incoming.filename,
        path: this.buildPath(incoming.id, incoming.filename),
        size: Number(incoming.size ?? 0),
        downloadCount: Number(incoming.download_count ?? 0),
        deleted: Boolean(incoming.deleted),
        createdAt: incoming.created_at ? new Date(incoming.created_at) : new Date(),
        expiresAt: incoming.expires_at ? new Date(incoming.expires_at) : null,
        deleteAfterDownload: Boolean(incoming.delete_after_download),
      });
    }
  }

  private buildPath(id: string, filename: string): string {
    return join(this.storageDir, id, filename);
  }
}

export { FileNotFoundError };
export type { FileRecord };
export type { ImportFileRecord };
