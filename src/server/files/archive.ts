import { PassThrough, pipeline, type Readable } from 'node:stream';
import { fromRandomAccessReaderPromise, RandomAccessReader, type Entry, type ZipFile } from 'yauzl';

import type { StoredObjectBody } from './storage';

export { isZipArchive } from '../../shared/archive';

/** Opens a slice of the stored zip; `range` is a raw `Range` header. */
export type RangeOpener = (range: string) => Promise<StoredObjectBody>;

/** An index this large is a dump, not a site: refuse rather than hold it in memory. */
const MAX_ENTRIES = 50_000;

/** The bytes are not a zip yauzl can read, or one too large to index. */
export class ArchiveError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ArchiveError';
  }
}

/** One file in an archive, as the dashboard lists it. */
export interface ArchiveFile {
  /** Full path inside the archive, `/`-separated. */
  path: string;
  size: number;
}

/** What sits directly inside a directory of a served archive. */
export interface DirectoryListing {
  directories: string[];
  files: ArchiveFile[];
}

/**
 * Feeds yauzl from storage rather than a file descriptor, so the same code
 * reads a zip on local disk and one in an S3 bucket: every read becomes a
 * ranged `FileStorage.open`.
 */
class StorageReader extends RandomAccessReader {
  constructor(private readonly openRange: RangeOpener) {
    super();
  }

  override _readStreamForRange(start: number, end: number): Readable {
    const out = new PassThrough();

    // yauzl's `end` is exclusive, an HTTP range's is not.
    this.openRange(`bytes=${start}-${end - 1}`).then(
      // Tearing down `out` (a visitor hanging up) must also abort the read.
      ({ body }) => pipeline(body, out, () => undefined),
      (err: Error) => out.destroy(err),
    );

    return out;
  }
}

/**
 * The central directory of one stored zip, read once and kept: serving a file
 * out of it afterwards costs two ranged reads — its local header, then its
 * bytes — instead of a pass over the whole archive.
 */
export class ZipIndex {
  /** Everything in the archive, for listings. */
  readonly files: ArchiveFile[];

  /**
   * Folder the served site starts in. Zipping a `dist` folder puts every entry
   * under `dist/`; serving that as `/dist/index.html` would be a nuisance, so
   * a single top-level folder is stepped into. `''` when there is none.
   */
  readonly root: string;

  /** Served files, keyed by their path below `root`. */
  private readonly served = new Map<string, Entry>();
  /** Every directory below `root`, as `docs/`, `docs/api/`, … */
  private readonly directories = new Set<string>();

  private constructor(
    private readonly zip: ZipFile,
    entries: Entry[],
  ) {
    this.root = commonRoot(entries.map((entry) => entry.fileName));
    this.files = entries
      .filter((entry) => !entry.fileName.endsWith('/'))
      .map((entry) => ({ path: entry.fileName, size: entry.uncompressedSize }));

    for (const entry of entries) {
      // Finder adds a `__MACOSX/` folder next to the one that was zipped.
      if (!entry.fileName.startsWith(this.root)) continue;

      const path = entry.fileName.slice(this.root.length);
      for (let slash = path.indexOf('/'); slash !== -1; slash = path.indexOf('/', slash + 1)) {
        this.directories.add(path.slice(0, slash + 1));
      }
      if (path && !path.endsWith('/')) this.served.set(path, entry);
    }
  }

  /** Reads the central directory of a zip of `totalSize` bytes. */
  static async read(openRange: RangeOpener, totalSize: number): Promise<ZipIndex> {
    let zip: ZipFile;
    try {
      // `autoClose: false` keeps the index usable once iteration is over;
      // there is nothing to close anyway, every read opens its own stream.
      zip = await fromRandomAccessReaderPromise(new StorageReader(openRange), totalSize, {
        autoClose: false,
      });
    } catch (err) {
      throw new ArchiveError(`not a readable zip: ${(err as Error).message}`, { cause: err });
    }

    if (zip.entryCount > MAX_ENTRIES) {
      throw new ArchiveError(
        `archive holds ${zip.entryCount} entries, over the ${MAX_ENTRIES} limit`,
      );
    }

    const entries: Entry[] = [];
    try {
      for await (const entry of zip.eachEntry()) entries.push(entry);
    } catch (err) {
      throw new ArchiveError(`corrupt zip: ${(err as Error).message}`, { cause: err });
    }

    return new ZipIndex(zip, entries);
  }

  /** The entry served at `path` (relative to `root`), if it is a file. */
  file(path: string): Entry | undefined {
    return this.served.get(path);
  }

  /** Whether `path` names a directory; `''` is the root. Trailing slash required. */
  isDirectory(path: string): boolean {
    return path === '' || this.directories.has(path);
  }

  /** The immediate contents of directory `dir` (`''` or ending in `/`). */
  list(dir: string): DirectoryListing {
    const directories = new Set<string>();
    const files: ArchiveFile[] = [];

    for (const [path, entry] of this.served) {
      if (!path.startsWith(dir)) continue;

      const rest = path.slice(dir.length);
      const slash = rest.indexOf('/');
      if (slash === -1) files.push({ path: rest, size: entry.uncompressedSize });
      else directories.add(rest.slice(0, slash + 1));
    }
    for (const path of this.directories) {
      const rest = path.slice(dir.length);
      if (path.startsWith(dir) && rest && rest.indexOf('/') === rest.length - 1) {
        directories.add(rest);
      }
    }

    return { directories: [...directories].sort(), files: files.sort(byPath) };
  }

  /** Streams an entry's uncompressed bytes. */
  open(entry: Entry): Promise<Readable> {
    return this.zip.openReadStreamPromise(entry);
  }
}

/** `dist/` when every entry (bar macOS metadata) sits inside `dist/`, else `''`. */
function commonRoot(names: string[]): string {
  const relevant = names.filter((name) => !name.startsWith('__MACOSX/'));
  const top = relevant[0]?.split('/')[0] ?? '';
  const root = `${top}/`;

  return top && relevant.every((name) => name.startsWith(root)) ? root : '';
}

function byPath(a: ArchiveFile, b: ArchiveFile): number {
  return a.path.localeCompare(b.path);
}
