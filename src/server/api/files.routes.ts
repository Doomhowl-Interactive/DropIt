import { Router, type Request, type Response } from 'express';
import { pipeline } from 'node:stream/promises';
import multer from 'multer';
import { authMiddleware, requireRole, type AuthDeps } from '../middleware/auth';
import { param, parseBody, safeFilename } from '../util';
import type { FileService } from '../files/service';
import type { FileRecord } from '../files/repository';
import type { RenderPage } from '../render';
import { guessMimeType } from '../mcp/content';
import {
  FileDeleteResponseSchema,
  FileExportResponseSchema,
  ImportRequestSchema,
  ImportResponseSchema,
  OrphansResponseSchema,
  UploadResponseSchema,
  type FileExportRecord,
} from '../../shared/types';

/** Maps a stored record to the shape the JSON API is willing to expose — the on-disk `path` never leaves the server. */
function toExportRecord(file: FileRecord): FileExportRecord {
  return {
    id: file.id,
    viewId: file.viewId,
    filename: file.filename,
    size: file.size,
    downloadCount: file.downloadCount,
    deleted: file.deleted,
    createdAt: file.createdAt.toISOString(),
  };
}

interface UploadRequest extends Request {
  uploadFolderId?: string;
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
      let target: { folderId: string; path: string };
      try {
        target = files.createUploadTarget(file.originalname);
      } catch (err) {
        cb(err as Error);
        return;
      }

      (req as UploadRequest).uploadFolderId = target.folderId;

      files
        .writeUploadStream(target.path, file.stream, file.mimetype)
        .then((size) => cb(null, { path: target.path, size }))
        .catch((err: Error) => cb(err));
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
   * Streams a stored file inline, or shows the "file not found" page.
   *
   * Local files go through `res.sendFile`, which brings conditional requests
   * and range handling with it; remote objects are streamed, with the client's
   * `Range` header passed on to the store.
   */
  const serve = async (record: FileRecord, req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename(record.filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const localPath = files.filePath(record);
    if (localPath) {
      res.sendFile(localPath, (err) => {
        if (err && !res.headersSent) {
          void render(req, res, { page: 'file-not-found' }, 200);
        }
      });
      return;
    }

    let object;
    try {
      object = await files.openFile(record, req.headers.range);
    } catch {
      await render(req, res, { page: 'file-not-found' }, 200);
      return;
    }

    // Prefer the content type the store recorded for the object; fall back to
    // the stored filename when the backend doesn't track one (local files).
    res.type(object.contentType ?? guessMimeType(record.filename));
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
      const record = await files.downloadFile(param(req, 'id'));
      await serve(record, req, res);
    } catch {
      await render(req, res, { page: 'file-not-found' }, 200);
    }
  };

  router.get('/view/:id', download);

  router.post(
    '/upload',
    authMiddleware(auth),
    requireRole('admin'),
    upload.single('file'),
    async (req: Request, res: Response) => {
      const file = req.file;
      const folderId = (req as UploadRequest).uploadFolderId;

      if (!file || !folderId) {
        res.status(400).json({ error: 'missing file' });
        return;
      }

      try {
        const record = await files.registerUpload({
          folderId,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
        });

        res.json(
          UploadResponseSchema.parse({
            id: record.id,
            filename: record.filename,
            size: record.size,
            view_key: record.viewId,
          }),
        );
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  const dashboard = Router();
  dashboard.use(authMiddleware(auth), requireRole('admin'));

  const listAll = async (_req: Request, res: Response): Promise<void> => {
    try {
      const records = await files.getAllFiles();
      res.json(FileExportResponseSchema.parse(records.map(toExportRecord)));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  dashboard.get('/', listAll);
  dashboard.get('/export', listAll);

  dashboard.post('/import', async (req, res) => {
    const records = parseBody(res, ImportRequestSchema, req.body, 'invalid JSON');
    if (!records) return;

    try {
      await files.importFiles(records);
      res.json(ImportResponseSchema.parse({ imported: records.length }));
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

  dashboard.post('/delete/:id', async (req, res) => {
    const id = param(req, 'id');

    try {
      await files.deleteFileById(id);
      res.json(FileDeleteResponseSchema.parse({ id, deleted: true }));
    } catch {
      res.status(404).json({ error: 'file not found' });
    }
  });

  const dashboardServe = async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await files.getFileById(param(req, 'id'));
      await serve(record, req, res);
    } catch {
      res.status(404).json({ error: 'file not found' });
    }
  };

  dashboard.get('/download/:id', dashboardServe);
  dashboard.get('/:id', dashboardServe);

  router.use('/dashboard', dashboard);
  return router;
}
