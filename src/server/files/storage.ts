import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync, readdirSync, statSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

/** One object already in the store, as reported by {@link FileStorage.list}. */
export interface StoredObject {
  /** Storage location, as it is written to `file_records.path`. */
  location: string;
  /** Bare object name, without the directory or key prefix. */
  name: string;
  size: number;
  modifiedAt: Date;
}

/** A readable object, plus everything needed to write the response headers. */
export interface StoredObjectBody {
  body: Readable;
  /** Bytes in `body` — the whole object, or just the requested range. */
  size: number;
  /** Size of the complete object, whether or not a range was served. */
  totalSize: number;
  /** `bytes a-b/total` when a range was served, otherwise absent. */
  contentRange?: string;
  contentType?: string;
  modifiedAt?: Date;
}

/**
 * Where uploaded bytes live. Records store the `location` string this hands
 * out and never interpret it themselves, so a filesystem path and an S3 object
 * key are equally valid — see `LocalFileStorage` and `S3FileStorage`.
 */
export interface FileStorage {
  /** Backend name, for logs and the dashboard. */
  readonly kind: string;

  /** Allocates an unused location for a new object named `filename`. */
  locationFor(filename: string): string;

  write(location: string, bytes: Buffer, contentType?: string): Promise<void>;

  /** Streams an upload in; returns the number of bytes actually stored. */
  writeStream(location: string, stream: Readable, contentType?: string): Promise<number>;

  read(location: string): Promise<Buffer>;

  /** Opens an object for serving; `range` is a raw `Range` request header. */
  open(location: string, range?: string): Promise<StoredObjectBody>;

  /** Deletes an object; missing objects are not an error. */
  remove(location: string): Promise<void>;

  /** Everything in the store, for orphan recovery. */
  list(): Promise<StoredObject[]>;

  /**
   * Absolute filesystem path of an object, when the backend has one. Lets the
   * HTTP layer hand local files to `res.sendFile` — which brings conditional
   * requests and range handling with it — and stream everything else.
   */
  filePath?(location: string): string;
}

/** Files on the local filesystem, under a single flat directory. */
export class LocalFileStorage implements FileStorage {
  readonly kind = 'local';

  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  locationFor(filename: string): string {
    return this.locationOf(randomUUID() + extname(filename));
  }

  private locationOf(name: string): string {
    return join(this.dir, name);
  }

  async write(location: string, bytes: Buffer): Promise<void> {
    await writeFile(location, bytes);
  }

  async writeStream(location: string, stream: Readable): Promise<number> {
    let size = 0;
    stream.on('data', (chunk: Buffer) => (size += chunk.length));
    await pipeline(stream, createWriteStream(location));
    return size;
  }

  read(location: string): Promise<Buffer> {
    return readFile(resolve(location));
  }

  async open(location: string, range?: string): Promise<StoredObjectBody> {
    const path = resolve(location);
    const totalSize = statSync(path).size;
    const modifiedAt = statSync(path).mtime;
    const parsed = parseRange(range, totalSize);

    if (!parsed) {
      return { body: createReadStream(path), size: totalSize, totalSize, modifiedAt };
    }

    return {
      body: createReadStream(path, { start: parsed.start, end: parsed.end }),
      size: parsed.end - parsed.start + 1,
      totalSize,
      contentRange: `bytes ${parsed.start}-${parsed.end}/${totalSize}`,
      modifiedAt,
    };
  }

  async remove(location: string): Promise<void> {
    await rm(location, { force: true });
  }

  async list(): Promise<StoredObject[]> {
    const entries = readdirSync(this.dir, { withFileTypes: true });
    const objects: StoredObject[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const location = join(this.dir, entry.name);
      const stats = statSync(location);
      objects.push({ location, name: entry.name, size: stats.size, modifiedAt: stats.mtime });
    }

    return objects;
  }

  filePath(location: string): string {
    return resolve(location);
  }
}

/**
 * Parses a single-range `Range` header. Multi-range requests, unsatisfiable
 * ranges and anything malformed come back as `null`, which means "serve the
 * whole object" — the same fallback a 200 response gives.
 */
export function parseRange(
  header: string | undefined,
  totalSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!match || totalSize === 0) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  // `bytes=-500` asks for the last 500 bytes.
  const start = rawStart ? Number(rawStart) : Math.max(totalSize - Number(rawEnd), 0);
  const end = rawStart
    ? Math.min(rawEnd ? Number(rawEnd) : totalSize - 1, totalSize - 1)
    : totalSize - 1;

  if (start > end || start >= totalSize) return null;
  return { start, end };
}
