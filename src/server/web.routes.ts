import { Router } from 'express';
import { config } from './config';
import { authMiddleware, requireRole } from './middleware/auth';
import { formatTimestamp, humanSize, param } from './util';
import type { FileService } from './files/service';
import type { RenderPage } from './render';
import type { AdminFileRow } from '../app/utils/page-context';

const PAGE_SIZE = 10;

/**
 * The origin the visitor actually used, so the share links on the "file ready"
 * page match what the browser would have built for itself.
 */
function requestOrigin(req: { protocol: string; get(name: string): string | undefined }): string {
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
  const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host') || '';
  return `${proto}://${host}`;
}

/** The HTML pages, all rendered by Angular on the server. */
export function webRoutes(files: FileService, render: RenderPage): Router {
  const router = Router();

  router.get('/', (req, res) => render(req, res, { page: 'index' }));

  router.get('/login', (req, res) => render(req, res, { page: 'login' }));

  router.get('/f/:id', async (req, res) => {
    try {
      const file = await files.getFileByViewId(param(req, 'id'));
      await render(req, res, {
        page: 'complete',
        data: {
          filename: file.filename,
          downloadId: file.id,
          deleteId: file.deletionId,
          origin: requestOrigin(req),
        },
      });
    } catch {
      await render(req, res, { page: 'file-not-found' }, 404);
    }
  });

  router.get('/ping', (_req, res) => res.json({ message: 'hello' }));

  // Guards are attached per route: a `router.use(...)` here would also cover
  // every request that merely passes through on its way to the static files.
  const adminOnly = [authMiddleware(), requireRole('admin')];

  router.get('/admin', ...adminOnly, async (req, res) => {
    const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? ''), 10) || 1);

    try {
      const { files: records, total } = await files.getPaginatedFiles(
        PAGE_SIZE,
        (page - 1) * PAGE_SIZE,
      );

      const rows: AdminFileRow[] = records.map((file) => ({
        id: file.id,
        filename: file.filename,
        size: humanSize(file.size),
        createdAt: formatTimestamp(file.createdAt),
        expiresAt: file.expiresAt ? formatTimestamp(file.expiresAt) : 'NEVER',
        downloadCount: file.downloadCount,
        deleteAfterDownload: file.deleteAfterDownload,
        deleted: file.deleted,
      }));

      await render(req, res, {
        page: 'admin',
        data: {
          files: rows,
          page,
          totalPages: Math.ceil(total / PAGE_SIZE),
        },
      });
    } catch (err) {
      await render(
        req,
        res,
        {
          page: 'admin',
          data: { files: [], page: 1, totalPages: 0, error: (err as Error).message },
        },
        500,
      );
    }
  });

  router.get('/logout', ...adminOnly, (_req, res) => {
    res.clearCookie('auth_token', {
      path: '/',
      domain: config.domain || undefined,
    });
    res.redirect(302, '/');
  });

  return router;
}
