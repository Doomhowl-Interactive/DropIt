import { Router } from 'express';
import { config } from './config';
import { authMiddleware, requireRole, type AuthDeps } from './middleware/auth';
import { listTokenRows } from './tokens/view';
import { formatTimestamp, humanSize, requestOrigin } from './util';
import type { FileService } from './files/service';
import type { ApiTokenService } from './tokens/service';
import type { RenderPage } from './render';
import type { DashboardFileRow } from '../shared/types';

const PAGE_SIZE = 10;

/** The HTML pages, all rendered by Angular on the server. */
export function webRoutes(
  files: FileService,
  tokens: ApiTokenService,
  render: RenderPage,
  auth: AuthDeps = {},
): Router {
  const router = Router();

  router.get('/', (req, res) => render(req, res, { page: 'index' }));

  router.get('/login', (req, res) => render(req, res, { page: 'login' }));

  router.get('/ping', (_req, res) => res.json({ message: 'hello' }));

  // Guards are attached per route: a `router.use(...)` here would also cover
  // every request that merely passes through on its way to the static files.
  const adminOnly = [authMiddleware(auth), requireRole('admin')];

  router.get('/dashboard', ...adminOnly, async (req, res) => {
    const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? ''), 10) || 1);

    try {
      const { files: records, total } = await files.getPaginatedFiles(
        PAGE_SIZE,
        (page - 1) * PAGE_SIZE,
      );

      const rows: DashboardFileRow[] = records.map((file) => ({
        id: file.id,
        filename: file.filename,
        size: humanSize(file.size),
        createdAt: formatTimestamp(file.createdAt),
        downloadCount: file.downloadCount,
        deleted: file.deleted,
      }));

      await render(req, res, {
        page: 'dashboard',
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
          page: 'dashboard',
          data: { files: [], page: 1, totalPages: 0, error: (err as Error).message },
        },
        500,
      );
    }
  });

  router.get('/dashboard/tokens', ...adminOnly, async (req, res) => {
    const endpoint = `${requestOrigin(req)}/mcp`;

    try {
      await render(req, res, {
        page: 'api-tokens',
        data: { tokens: await listTokenRows(tokens), endpoint },
      });
    } catch (err) {
      await render(
        req,
        res,
        { page: 'api-tokens', data: { tokens: [], endpoint, error: (err as Error).message } },
        500,
      );
    }
  });

  router.get('/dashboard/password', ...adminOnly, (req, res) => {
    render(req, res, { page: 'change-password' });
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
