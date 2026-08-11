import { randomUUID } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { authMiddleware, requireRole } from '../middleware/auth';
import { param, safeFilename } from '../util';
import type { FileService } from '../files/service';
import type { FileRecord } from '../files/repository';
import type { RenderPage } from '../render';

interface UploadRequest extends Request {
  uploadFolderId?: string;
}

export function fileRoutes(files: FileService, render: RenderPage): Router {
  const router = Router();

  const storage = multer.diskStorage({
    destination(req, _file, cb) {
      try {
        const { folderId, folderPath } = files.createUploadFolder();
        (req as UploadRequest).uploadFolderId = folderId;
        cb(null, folderPath);
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename(_req, file, cb) {
      cb(null, randomUUID() + extname(file.originalname));
    },
  });

  const upload = multer({ storage, defParamCharset: 'utf8' });

  /** Streams a stored file inline, or shows the "file not found" page. */
  const serve = (record: FileRecord, req: Request, res: Response): void => {
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename(record.filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(resolve(record.path), (err) => {
      if (err && !res.headersSent) {
        void render(req, res, { page: 'file-not-found' }, 200);
      }
    });
  };

  const download = async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await files.downloadFile(param(req, 'id'));
      serve(record, req, res);
    } catch {
      await render(req, res, { page: 'file-not-found' }, 200);
    }
  };

  router.get('/download/:id', download);
  router.get('/view/:id', download);

  router.post(
    '/upload',
    authMiddleware(),
    requireRole('admin'),
    upload.single('file'),
    async (req: Request, res: Response) => {
      const file = req.file;
      const folderId = (req as UploadRequest).uploadFolderId;

      if (!file || !folderId) {
        res.status(400).json({ error: 'missing file' });
        return;
      }

      const duration = Number(req.body?.['duration'] ?? -1);
      const expiresAt =
        Number.isFinite(duration) && duration > 0 ? new Date(Date.now() + duration * 1000) : null;

      try {
        const record = await files.registerUpload({
          folderId,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          expiresAt,
        });

        res.json({
          id: record.id,
          deletion_id: record.deletionId,
          filename: record.filename,
          size: record.size,
          view_key: record.viewId,
        });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  // Public-facing deletion link: renders a page rather than JSON.
  router.get(
    '/delete/:del_id',
    authMiddleware(),
    requireRole('admin'),
    async (req: Request, res: Response) => {
      try {
        await files.deleteFileByDeletionId(param(req, 'del_id'));
        await render(req, res, { page: 'deleted' }, 200);
      } catch {
        await render(req, res, { page: 'file-not-found' }, 200);
      }
    },
  );

  const dashboard = Router();
  dashboard.use(authMiddleware(), requireRole('admin'));

  dashboard.get('/', async (_req, res) => {
    try {
      res.json(await files.getAllFiles());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  dashboard.get('/export', async (_req, res) => {
    try {
      res.json(await files.getAllFiles());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  dashboard.post('/import', async (req, res) => {
    if (!Array.isArray(req.body)) {
      res.status(400).json({ error: 'invalid JSON' });
      return;
    }
    try {
      await files.importFiles(req.body);
      res.json({ imported: req.body.length });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  dashboard.post('/delete/fr/:id', async (req, res) => {
    try {
      await files.getFileById(param(req, 'id'));
    } catch {
      res.status(404).json({ error: 'file not found' });
      return;
    }

    try {
      await files.forceDelete(param(req, 'id'));
      res.redirect(303, '/dashboard');
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  dashboard.post('/delete/:id', async (req, res) => {
    try {
      await files.deleteFileById(param(req, 'id'));
      res.redirect(303, '/dashboard');
    } catch {
      res.status(404).json({ error: 'file not found' });
    }
  });

  const dashboardServe = async (req: Request, res: Response): Promise<void> => {
    try {
      const record = await files.getFileById(param(req, 'id'));
      serve(record, req, res);
    } catch {
      res.status(404).json({ error: 'file not found' });
    }
  };

  dashboard.get('/download/:id', dashboardServe);
  dashboard.get('/:id', dashboardServe);

  router.use('/dashboard', dashboard);
  return router;
}
