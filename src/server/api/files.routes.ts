import { Router, type Request, type Response } from 'express';
import { pipeline } from 'node:stream/promises';
import multer from 'multer';
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  type AuthDeps,
} from '../middleware/auth';
import { param, safeFilename } from '../util';
import type { FileService } from '../files/service';
import type { FileRecord } from '../files/repository';
import type { RenderPage } from '../render';
import { guessMimeType } from '../mcp/content';
import { isNotFoundError } from '../files/storage';
import {
  FileActiveRequestSchema,
  FileActiveResponseSchema,
  FileDeleteResponseSchema,
  FileExportResponseSchema,
  OrphansResponseSchema,
  UploadResponseSchema,
  type FileExportRecord,
} from '../../shared/types';

/** Maps a stored record to the shape the JSON API is willing to expose — the on-disk `path` never leaves the server. */
function toExportRecord(file: FileRecord): FileExportRecord {
  return {
    id: file.id,
    filename: file.filename,
    size: file.size,
    downloadCount: file.downloadCount,
    deleted: file.deleted,
    createdAt: file.createdAt.toISOString(),
  };
}

/**
 * Content types a browser executes in the origin it loaded them from. Uploads
 * are served back from this application's own origin, and `/view/:id` needs no
 * token, so these are handed over as downloads rather than rendered in place.
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

function isPreviewable(contentType: string): boolean {
  const essence = contentType.split(';')[0].trim().toLowerCase();
  if (ACTIVE_TYPES.has(essence)) return false;

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
      // resolve names such as `.htm` to a type we just decided not to inline.
      setContentHeaders(res, record, guessMimeType(record.filename));
      res.sendFile(localPath, (err) => {
        if (err && !res.headersSent) {
          // The disposition above described the file, not this page.
          res.removeHeader('Content-Disposition');
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

  router.get('/view/:id', optionalAuthMiddleware(auth), download);

  router.post(
    '/upload',
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

      try {
        const record = await files.registerUpload({
          id,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
        });

        res.json(
          UploadResponseSchema.parse({
            id: record.id,
            filename: record.filename,
            size: record.size,
          }),
        );
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  const dashboard = Router();
  dashboard.use(authMiddleware(auth), requireRole('admin'));

  dashboard.get('/', async (_req, res) => {
    try {
      const records = await files.getAllFiles();
      res.json(FileExportResponseSchema.parse(records.map(toExportRecord)));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  dashboard.post('/orphans', async (_req, res) => {
    try {
      const added = await files.addOrphans();
      res.json(OrphansResponseSchema.parse({ added }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  dashboard.post('/delete/fr/:id', async (req, res) => {
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

  dashboard.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const parsed = FileActiveRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'active must be a boolean' });
      return;
    }

    try {
      await files.setFileActive(id, parsed.data.active);
      res.json(FileActiveResponseSchema.parse({ id, active: parsed.data.active }));
    } catch {
      res.status(404).json({ error: 'file not found' });
    }
  });

  router.use('/dashboard', dashboard);
  return router;
}
