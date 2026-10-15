import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { config } from '../config';
import {
  FileNotFoundError,
  FilePathAlreadyRegisteredError,
  FileRepository,
  type FileRecord,
} from './repository';
import { LocalFileStorage, type FileStorage, type StoredObjectBody } from './storage';
import { ArchiveError, isZipArchive, ZipIndex } from './archive';

/** How many zip indexes stay in memory; each costs roughly its central directory. */
const ARCHIVE_CACHE_SIZE = 32;

/** Raised when a file is asked to be hosted that cannot be. */
export class NotHostableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotHostableError';
  }
}

export interface UploadedFile {
  /** UUIDv4 used as the file's sole public identifier. */
  id: string;
  originalName: string;
  /** Storage location the bytes were written to. */
  path: string;
  size: number;
  /** Serve the archive's contents at its site host; zip archives only. */
  hosted?: boolean;
}

export class FileService {
  private readonly storage: FileStorage;

  /** Recently read zip indexes by storage location, least recently used first. */
  private readonly archives = new Map<string, Promise<ZipIndex>>();

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
  createUploadTarget(originalName: string): { id: string; path: string } {
    return { id: randomUUID(), path: this.storage.locationFor(originalName) };
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
    assertHostable(upload.originalName, upload.hosted);

    const record: FileRecord = {
      id: upload.id,
      filename: upload.originalName,
      path: upload.path,
      size: upload.size,
      downloadCount: 0,
      deleted: false,
      hosted: upload.hosted ?? false,
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
    hosted = false,
  ): Promise<FileRecord> {
    assertHostable(originalName, hosted);
    const { id, path } = this.createUploadTarget(originalName);

    try {
      await this.storage.write(path, bytes, contentType);
      return await this.registerUpload({ id, originalName, path, size: bytes.length, hosted });
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

  /**
   * Enables or disables a file, and starts or stops hosting a zip's contents.
   * Whether the file can be hosted is settled before anything is written.
   */
  async updateFile(
    id: string,
    changes: { active?: boolean; hosted?: boolean },
  ): Promise<FileRecord> {
    const file = await this.repo.getById(id);
    assertHostable(file.filename, changes.hosted);

    if (changes.hosted !== undefined) await this.repo.setHosted(file, changes.hosted);
    if (changes.active !== undefined) await this.repo.setActive(file, changes.active);
    return file;
  }

  /**
   * The entry index of a stored zip. Indexes are kept for the next request: a
   * hosted site asks for one file at a time, and re-reading the central
   * directory for each of them would multiply every page load.
   */
  archive(record: FileRecord): Promise<ZipIndex> {
    const key = record.path;
    let index = this.archives.get(key);

    if (index) {
      // Re-inserted below, so the map's insertion order doubles as recency.
      this.archives.delete(key);
    } else {
      index = this.readArchive(record);
      // A failure is not remembered: the next request simply tries again.
      index.catch(() => {
        if (this.archives.get(key) === index) this.archives.delete(key);
      });
    }

    this.archives.set(key, index);
    for (const oldest of this.archives.keys()) {
      if (this.archives.size <= ARCHIVE_CACHE_SIZE) break;
      this.archives.delete(oldest);
    }

    return index;
  }

  private async readArchive(record: FileRecord): Promise<ZipIndex> {
    if (!isZipArchive(record.filename)) throw new ArchiveError('not a zip archive');
    if (record.size === 0) throw new ArchiveError('empty file');

    // Asking for the first byte is the cheapest way to learn the real size —
    // and to find out the object is gone before yauzl does.
    const probe = await this.storage.open(record.path, 'bytes=0-0');
    probe.body.destroy();

    return ZipIndex.read((range) => this.storage.open(record.path, range), probe.totalSize);
  }

  /** Removes the bytes from storage *and* the row from the database. */
  async forceDelete(id: string): Promise<FileRecord> {
    const file = await this.repo.getById(id);

    this.archives.delete(file.path);
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

  getAllFiles() {
    return this.repo.getAll();
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

      try {
        await this.repo.create({
          id: randomUUID(),
          filename: object.name,
          path: object.location,
          size: object.size,
          downloadCount: 0,
          deleted: false,
          hosted: false,
          createdAt: object.modifiedAt,
        });
      } catch (error) {
        if (error instanceof FilePathAlreadyRegisteredError) {
          registered.add(object.location);
          continue;
        }
        throw error;
      }
      registered.add(object.location);
      added += 1;
    }

    return added;
  }
}

function assertHostable(filename: string, hosted: boolean | undefined): void {
  if (!hosted) return;

  if (!isZipArchive(filename)) throw new NotHostableError('only zip archives can be hosted');
  if (!config.sitesHost) {
    throw new NotHostableError('archive hosting is off: set SITES_HOST to turn it on');
  }
}

export { FileNotFoundError };
export type { FileRecord };
