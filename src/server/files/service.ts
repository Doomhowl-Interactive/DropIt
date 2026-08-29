import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { FileNotFoundError, FileRepository, type FileRecord } from './repository';
import { LocalFileStorage, type FileStorage, type StoredObjectBody } from './storage';
import type { ImportFileRecord } from '../../shared/types';

export interface UploadedFile {
  /** Unique upload id; doubles as the record id. */
  folderId: string;
  originalName: string;
  /** Storage location the bytes were written to. */
  path: string;
  size: number;
}

export class FileService {
  private readonly storage: FileStorage;

  /**
   * Takes a storage backend, or a directory as a shorthand for local storage.
   */
  constructor(
    private readonly repo: FileRepository,
    storage: FileStorage | string,
  ) {
    this.storage = typeof storage === 'string' ? new LocalFileStorage(storage) : storage;
  }

  /** Which backend the uploads are going to, for logs and diagnostics. */
  get storageKind(): string {
    return this.storage.kind;
  }

  /**
   * Allocates an upload id and a storage location for it. The location is
   * opaque — a filesystem path for local storage, an object key for S3 — and
   * is handed straight back to `registerUpload`.
   */
  createUploadTarget(originalName: string): { folderId: string; path: string } {
    return { folderId: randomUUID(), path: this.storage.locationFor(originalName) };
  }

  /** Streams an upload into storage; returns the bytes actually stored. */
  writeUploadStream(path: string, stream: Readable, contentType?: string): Promise<number> {
    return this.storage.writeStream(path, stream, contentType);
  }

  /** Drops a half-finished upload's bytes; used when a request is aborted. */
  removeUpload(path: string): Promise<void> {
    return this.storage.remove(path);
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

  /**
   * Writes bytes to storage and registers them in one go. Nothing is left
   * behind in the store when the record cannot be written.
   */
  async storeUpload(
    originalName: string,
    bytes: Buffer,
    contentType?: string,
  ): Promise<FileRecord> {
    const { folderId, path } = this.createUploadTarget(originalName);

    try {
      await this.storage.write(path, bytes, contentType);
      return await this.registerUpload({ folderId, originalName, path, size: bytes.length });
    } catch (err) {
      await this.storage.remove(path).catch(() => undefined);
      throw err;
    }
  }

  /** Opens a record's bytes for serving; `range` is a raw `Range` header. */
  openFile(record: FileRecord, range?: string): Promise<StoredObjectBody> {
    return this.storage.open(record.path, range);
  }

  readFileBytes(record: FileRecord): Promise<Buffer> {
    return this.storage.read(record.path);
  }

  /**
   * Filesystem path of a record's bytes, when the backend has one — remote
   * stores return `undefined` and have to be streamed instead.
   */
  filePath(record: FileRecord): string | undefined {
    return this.storage.filePath?.(record.path);
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

  /** Removes the bytes from storage *and* the row from the database. */
  async forceDelete(id: string): Promise<FileRecord> {
    const file = await this.repo.getById(id);

    await this.storage.remove(file.path);
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
        path: this.storage.locationOf(incoming.filename),
        size: Number(incoming.size ?? 0),
        downloadCount: Number(incoming.download_count ?? 0),
        deleted: Boolean(incoming.deleted),
        createdAt: incoming.created_at ? new Date(incoming.created_at) : new Date(),
      });
    }
  }

  /**
   * Registers objects that are in storage but have no database row — leftovers
   * of an interrupted upload. Returns how many orphans were picked up.
   */
  async addOrphans(): Promise<number> {
    const objects = await this.storage.list();

    // An object is recognised by *where its bytes live*, not by its name: an
    // upload is stored under a random name that has nothing to do with the
    // record id, so matching on the name would re-register every file here.
    const registered = new Set((await this.repo.getAll()).map((file) => file.path));
    let added = 0;

    for (const object of objects) {
      console.log(`Checking if orphan: ${object.name}`);

      if (registered.has(object.location)) {
        console.log(`Skipping ${object.name} because it already exists in the database`);
        continue;
      }

      // The name doubles as the record id, so a name that is already taken
      // would fail the insert.
      if (await this.repo.getByIdOrNull(object.name).catch((e) => console.error(e))) {
        console.log(`Skipping ${object.name} because that id is already taken`);
        continue;
      }

      await this.repo.create({
        id: object.name,
        viewId: randomUUID(),
        filename: object.name,
        path: object.location,
        size: object.size,
        downloadCount: 0,
        deleted: false,
        createdAt: object.modifiedAt,
      });
      registered.add(object.location);
      added += 1;
    }

    return added;
  }
}

export { FileNotFoundError };
export type { FileRecord };
export type { ImportFileRecord };
