import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule } from '@angular/ssr/node';
import cookieParser from 'cookie-parser';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';

import { authRoutes } from './server/api/auth.routes';
import { fileRoutes } from './server/api/files.routes';
import { AuthService } from './server/auth/service';
import { createAdminUser } from './server/bootstrap';
import { config } from './server/config';
import { connect } from './server/db/db';
import { migrate } from './server/db/migrate';
import { FileRepository } from './server/files/repository';
import { FileService } from './server/files/service';
import { csrfMiddleware, ensureCsrfCookie } from './server/middleware/csrf';
import { createRenderer } from './server/render';
import { UserRepository } from './server/users/repository';
import { UserService } from './server/users/service';
import { webRoutes } from './server/web.routes';

const browserDistFolder = join(import.meta.dirname, '../browser');

/**
 * Hosts are validated by @angular/ssr to block host-header spoofing. The app is
 * self-hosted under whatever domain the operator picks, so the list comes from
 * the environment (`ALLOWED_HOSTS=drop.example,*.example.com`); `*` — the
 * default — accepts any Host, matching how the Go server behaved.
 *
 * Set `TRUST_PROXY_HEADERS=true` when running behind a TLS-terminating proxy
 * such as Fly.io so `X-Forwarded-*` is honoured instead of warned about.
 */
const angularApp = new AngularNodeAppEngine({
  allowedHosts: (process.env['ALLOWED_HOSTS'] || '*').split(',').map((host) => host.trim()),
  trustProxyHeaders: process.env['TRUST_PROXY_HEADERS'] === 'true',
});

async function createApp(): Promise<Express> {
  // Node reads .env itself; a missing file is not an error (as with godotenv).
  try {
    process.loadEnvFile();
  } catch {
    console.log('Error loading .env file');
  }

  const app = express();
  const render = createRenderer(angularApp);

  const db = await connect();
  await migrate(db);

  const users = new UserService(new UserRepository(db));
  const auth = new AuthService(users);
  const files = new FileService(new FileRepository(db), config.storageDir);

  await createAdminUser(users);

  app.disable('x-powered-by');
  app.use(cookieParser());
  app.use(ensureCsrfCookie());

  // Uploads are streamed to disk by multer, so only small bodies land here.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  /** `/static` keeps serving the logo and favicon from their original path. */
  const staticDir = resolve(config.staticDir);
  if (existsSync(staticDir)) {
    app.use('/static', express.static(staticDir, { maxAge: '1h', redirect: false }));
  }

  /** Built browser bundles. */
  app.use(
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: false,
      redirect: false,
    }),
  );

  const api = express.Router();
  api.use(csrfMiddleware());
  api.use('/auth', authRoutes(auth));
  api.use('/files', fileRoutes(files, render));
  app.use('/api', api);

  app.use(webRoutes(files, render));

  /** Anything left over is "nothing to see here". */
  app.use((req: Request, res: Response, next: NextFunction) => {
    render(req, res, { page: 'error' }, 404).catch(next);
  });

  return app;
}

/**
 * Built lazily so that merely importing this module — which the CLI does while
 * building — never opens the database or touches the filesystem.
 */
let appPromise: Promise<Express> | undefined;
function getApp(): Promise<Express> {
  return (appPromise ??= createApp());
}

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const app = await getApp();
  const port = config.port;
  app.listen(port, (error?: Error) => {
    if (error) throw error;
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(
  async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const app = await getApp();
    app(req as Request, res as Response, next as NextFunction);
  },
);
