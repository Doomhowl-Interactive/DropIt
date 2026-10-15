import { Router, type Request, type Response } from 'express';
import { pipeline } from 'node:stream/promises';
import multer from 'multer';
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  type AuthDeps,
} from '../middleware/auth';
import { param, parseBody, requestOrigin, safeFilename } from '../util';
import { NotHostableError, type FileService } from '../files/service';
import { FileNotFoundError, type FileRecord } from '../files/repository';
import { ArchiveError, isZipArchive } from '../files/archive';
import type { RenderPage } from '../render';
import { guessMimeType } from '../mcp/content';
import { isNotFoundError } from '../files/storage';
import { siteUrl } from '../sites/host';
import {
  ArchiveEntriesResponseSchema,
  FileDeleteResponseSchema,
  FileExportResponseSchema,
  FileUpdateRequestSchema,
  FileUpdateResponseSchema,
  OrphansResponseSchema,
  UploadResponseSchema,
  type FileExportRecord,
} from '../../shared/types';

/** Maps a stored record to the shape the JSON API is willing to expose — the on-disk `path` never leaves the server. */
function toExportRecord(file: FileRecord, origin: string): FileExportRecord {
  return {
    id: file.id,
    filename: file.filename,
    size: file.size,
    downloadCount: file.downloadCount,
    deleted: file.deleted,
    createdAt: file.createdAt.toISOString(),
    archive: isZipArchive(file.filename),
    hosted: file.hosted,
    siteUrl: siteUrl(file, origin),
  };
}

/**
 * Reads a multipart checkbox: absent or `false`/`0`/`off` is false, and
 * `true`/`1`/`on` (what an HTML checkbox sends) is true. Anything else is
 * `undefined`, a malformed request.
 */
function parseFlag(value: unknown): boolean | undefined {
  if (value === undefined) return false;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'on'].includes(normalized)) return true;
  if (['false', '0', 'off', ''].includes(normalized)) return false;
  return undefined;
}

/**
 * Content types a browser executes in the origin it loaded them from. Uploads
 * are served back from this application's own origin, and `/view/:id` needs no
 * token, so these are only rendered in place inside a CSP sandbox: the document
 * gets an opaque origin, which keeps its scripts away from the app's storage and
 * its requests from carrying the (SameSite=strict) auth cookie.
 */
const ACTIVE_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/xml',
  'application/xml',
]);

/** MIME types supported by the preview policy adapted from `isPreviewableMime()`. */
const PREVIEWABLE_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
] as const;

/** Archive suffixes are authoritative even when storage has stale or incorrect MIME metadata. */
const ARCHIVE_SUFFIXES = [
  '.7z',
  '.apk',
  '.bz2',
  '.cab',
  '.gz',
  '.iso',
  '.jar',
  '.rar',
  '.tar',
  '.tgz',
  '.war',
  '.xz',
  '.zip',
  '.zst',
] as const;

function isArchive(filename: string): boolean {
  const normalized = filename.trim().toLowerCase();
  return ARCHIVE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

/** Locks an active document into an opaque origin; scripts may run, but not as us. */
const SANDBOX_POLICY = 'sandbox allow-scripts';

function mimeEssence(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

function isPreviewable(contentType: string): boolean {
  const essence = mimeEssence(contentType);
  if (ACTIVE_TYPES.has(essence)) return true;

  return PREVIEWABLE_MIME_PREFIXES.some((entry) =>
    entry.endsWith('/') ? essence.startsWith(entry) : essence === entry,
  );
}

/** Names the response and decides whether the browser may render it in place. */
function setContentHeaders(res: Response, record: FileRecord, contentType: string): void {
  const disposition =
    !isArchive(record.filename) && isPreviewable(contentType) ? 'inline' : 'attachment';

  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${safeFilename(record.filename)}"`,
  );
  // Sandbox active types whatever the disposition: an `attachment` header is
  // only advice, and the browser may still end up rendering the document.
  if (ACTIVE_TYPES.has(mimeEssence(contentType))) {
    res.setHeader('Content-Security-Policy', SANDBOX_POLICY);
  }
  res.type(contentType);
}

interface UploadRequest extends Request {
  uploadId?: string;
}

export function fileRoutes(files: FileService, render: RenderPage, auth: AuthDeps = {}): Router {
  const router = Router();

  /**
   * Streams the upload straight into whichever backend is configured, rather
   * than to a fixed directory: `FileService` hands out the location and multer
   * only reports back what it stored.
   */
  const storage: multer.StorageEngine = {
    _handleFile(req, file, cb) {
      let target: { id: string; path: string };
      try {
        target = files.createUploadTarget(file.originalname);
      } catch (err) {
        cb(err as Error);
        return;
      }

      (req as UploadRequest).uploadId = target.id;

      files
        // The content type follows from the name we store, never from the
        // `mimetype` multer lifted out of the request: that is the uploader's
        // word for it, and it comes back out again on a public, same-origin URL.
        .writeUploadStream(target.path, file.stream, guessMimeType(file.originalname))
        .then((size) => cb(null, { path: target.path, size }))
        .catch((err: Error) => {
          // multer only hands `_removeFile` the files it already stored, so
          // without this a stream that dies partway leaves its bytes behind.
          void files
            .removeUpload(target.path)
            .catch(() => undefined)
            .then(() => cb(err));
        });
    },

    _removeFile(_req, file, cb) {
      files.removeUpload(file.path).then(
        () => cb(null),
        (err: Error) => cb(err),
      );
    },
  };

  const upload = multer({ storage, defParamCharset: 'utf8' });

  /**
   * Streams a stored file for preview or download, or shows the "file not found" page.
   *
   * Local files go through `res.sendFile`, which brings conditional requests
   * and range handling with it; remote objects are streamed, with the client's
   * `Range` header passed on to the store.
   */
  const serve = async (record: FileRecord, req: Request, res: Response): Promise<void> => {
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const localPath = files.filePath(record);
    if (localPath) {
      // Type the response before handing it over: left to itself `sendFile`
      // consults a far broader mime table than `guessMimeType`, and would
      // resolve names such as `.htm` to a type we would serve unsandboxed.
      setContentHeaders(res, record, guessMimeType(record.filename));
      res.sendFile(localPath, (err) => {
        if (err && !res.headersSent) {
          // The disposition and sandbox above described the file, not this page.
          res.removeHeader('Content-Disposition');
          res.removeHeader('Content-Security-Policy');
          void render(req, res, { page: 'file-not-found' }, 404);
        }
      });
      return;
    }

    let object;
    try {
      object = await files.openFile(record, req.headers.range);
    } catch (err) {
      // Only a missing object is the visitor's 404. A store that is unreachable
      // or refusing our credentials is our failure, and reporting it as a
      // successfully rendered page would hide the outage from every caller.
      if (!isNotFoundError(err)) {
        res.status(502).json({ error: 'storage unavailable' });
        return;
      }

      await render(req, res, { page: 'file-not-found' }, 404);
      return;
    }

    // A recognized filename is more reliable than legacy object metadata:
    // older uploads may claim `text/plain` even when their gzip signature and
    // `.tar.gz` suffix identify an archive. Unknown names still get to use
    // metadata supplied by the storage backend.
    const inferredContentType = guessMimeType(record.filename);
    const contentType =
      inferredContentType === 'application/octet-stream'
        ? (object.contentType ?? inferredContentType)
        : inferredContentType;
    setContentHeaders(res, record, contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(object.size));
    if (object.modifiedAt) res.setHeader('Last-Modified', object.modifiedAt.toUTCString());
    if (object.contentRange) {
      res.setHeader('Content-Range', object.contentRange);
      res.status(206);
    }

    // pipeline destroys both streams when either side closes or errors,
    // unlike `pipe` which leaves the source dangling on a client disconnect.
    await pipeline(object.body, res);
  };

  const download = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = param(req, 'id');
      const record =
        req.auth?.role === 'admin' ? await files.getFileById(id) : await files.downloadFile(id);
      await serve(record, req, res);
    } catch {
      await render(req, res, { page: 'file-not-found' }, 404);
    }
  };

  router.post(
    '/',
    authMiddleware(auth),
    requireRole('admin'),
    upload.single('file'),
    async (req: Request, res: Response) => {
      const file = req.file;
      const id = (req as UploadRequest).uploadId;

      if (!file || !id) {
        res.status(400).json({ error: 'missing file' });
        return;
      }

      const hosted = parseFlag(req.body?.hosted);
      if (hosted === undefined) {
        await files.removeUpload(file.path).catch(() => undefined);
        res.status(400).json({ error: 'hosted must be true or false' });
        return;
      }

      try {
        const record = await files.registerUpload({
          id,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          hosted,
        });

        res.json(
          UploadResponseSchema.parse({
            id: record.id,
            filename: record.filename,
            size: record.size,
            hosted: record.hosted,
            siteUrl: siteUrl(record, requestOrigin(req)),
          }),
        );
      } catch (err) {
        if (err instanceof NotHostableError) {
          await files.removeUpload(file.path).catch(() => undefined);
          res.status(400).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  router.get('/', authMiddleware(auth), requireRole('admin'), async (req, res) => {
    try {
      const origin = requestOrigin(req);
      const records = await files.getAllFiles();
      res.json(
        FileExportResponseSchema.parse(records.map((record) => toExportRecord(record, origin))),
      );
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post('/orphans', authMiddleware(auth), requireRole('admin'), async (_req, res) => {
    try {
      const added = await files.addOrphans();
      res.json(OrphansResponseSchema.parse({ added }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.delete('/:id', authMiddleware(auth), requireRole('admin'), async (req, res) => {
    const id = param(req, 'id');

    try {
      await files.getFileById(id);
    } catch {
      res.status(404).json({ error: 'file not found' });
      return;
    }

    try {
      await files.forceDelete(id);
      res.json(FileDeleteResponseSchema.parse({ id, deleted: true }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.patch('/:id', authMiddleware(auth), requireRole('admin'), async (req, res) => {
    const id = param(req, 'id');
    const body = parseBody(
      res,
      FileUpdateRequestSchema,
      req.body,
      'expected a boolean active and/or hosted',
    );
    if (!body) return;

    try {
      const record = await files.updateFile(id, body);
      res.json(
        FileUpdateResponseSchema.parse({
          id,
          active: !record.deleted,
          hosted: record.hosted,
          siteUrl: siteUrl(record, requestOrigin(req)),
        }),
      );
    } catch (err) {
      if (err instanceof FileNotFoundError) {
        res.status(404).json({ error: 'file not found' });
      } else if (err instanceof NotHostableError) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  router.get('/:id/entries', authMiddleware(auth), requireRole('admin'), async (req, res) => {
    let record: FileRecord;
    try {
      record = await files.getFileById(param(req, 'id'));
    } catch {
      res.status(404).json({ error: 'file not found' });
      return;
    }

    if (!isZipArchive(record.filename)) {
      res.status(400).json({ error: 'not a zip archive' });
      return;
    }

    try {
      const index = await files.archive(record);
      res.json(ArchiveEntriesResponseSchema.parse({ root: index.root, entries: index.files }));
    } catch (err) {
      if (err instanceof ArchiveError) {
        res.status(422).json({ error: err.message });
      } else if (isNotFoundError(err)) {
        res.status(404).json({ error: 'file missing from storage' });
      } else {
        res.status(502).json({ error: 'storage unavailable' });
      }
    }
  });

  router.get('/:id', optionalAuthMiddleware(auth), download);
  return router;
}
