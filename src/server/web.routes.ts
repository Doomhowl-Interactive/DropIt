import { Router } from 'express';
import { config } from './config';
import { authMiddleware, requireRole, type AuthDeps } from './middleware/auth';
import { requestOrigin } from './util';
import type { FileService } from './files/service';
import type { RenderPage } from './render';

/** The HTML pages, all rendered by Angular on the server. */
export function webRoutes(files: FileService, render: RenderPage, auth: AuthDeps = {}): Router {
  const router = Router();

  router.get('/', (req, res) => render(req, res, { page: 'index' }));

  router.get('/login', (req, res) => render(req, res, { page: 'login' }));

  router.get('/ping', (_req, res) => res.json({ message: 'hello' }));

  // Guards are attached per route: a `router.use(...)` here would also cover
  // every request that merely passes through on its way to the static files.
  const adminOnly = [authMiddleware(auth), requireRole('admin')];

  // Both dashboard pages load their own data through `httpResource`, so the
  // server only has to decide who is allowed in and hand over the shell.
  router.get('/dashboard', ...adminOnly, (req, res) => render(req, res, { page: 'dashboard' }));

  router.get('/dashboard/tokens', ...adminOnly, (req, res) =>
    render(req, res, { page: 'api-tokens', data: { endpoint: `${requestOrigin(req)}/mcp` } }),
  );

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
