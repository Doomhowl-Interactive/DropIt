import { Router } from 'express';
import { config } from './config';
import { authMiddleware, requireRole } from './middleware/auth';
import { listTokenRows } from './mcp/tokens/view';
import { formatTimestamp, humanSize, param, requestOrigin } from './util';
import type { FileService } from './files/service';
import type { McpTokenService } from './mcp/tokens/service';
import type { RenderPage } from './render';
import type { AdminFileRow } from '../shared/page-context';

const PAGE_SIZE = 10;

/** The HTML pages, all rendered by Angular on the server. */
export function webRoutes(files: FileService, tokens: McpTokenService, render: RenderPage): Router {
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

  router.get('/admin/mcp', ...adminOnly, async (req, res) => {
    const endpoint = `${requestOrigin(req)}/mcp`;

    try {
      await render(req, res, {
        page: 'mcp-tokens',
        data: { tokens: await listTokenRows(tokens), endpoint },
      });
    } catch (err) {
      await render(
        req,
        res,
        { page: 'mcp-tokens', data: { tokens: [], endpoint, error: (err as Error).message } },
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
