import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing/db';
import { listen, type TestServer } from '../testing/http';
import { fakeRenderer } from '../testing/render';
import { generateJwt } from './auth/jwt';
import { FileRepository, type FileRecord } from './files/repository';
import { FileService } from './files/service';
import { McpTokenRepository } from './mcp/tokens/repository';
import { McpTokenService } from './mcp/tokens/service';
import type { DashboardPageData, PageContext } from '../app/utils/page-context';
import { webRoutes } from './web.routes';

const ENV = ['JWT_SECRET', 'DOMAIN'] as const;

function makeRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: 'file-1',
    deletionId: 'del-1',
    viewId: 'view-1',
    filename: 'report.pdf',
    path: 'uploads/file-1/report.pdf',
    size: 2048,
    downloadCount: 0,
    deleted: false,
    createdAt: new Date(2026, 7, 11, 10, 30),
    expiresAt: null,
    deleteAfterDownload: false,
    ...overrides,
  };
}

describe('web routes', () => {
  let saved: Record<string, string | undefined>;
  let storageDir: string;
  let repo: FileRepository;
  let files: FileService;
  let render: ReturnType<typeof fakeRenderer>;
  let server: TestServer;

  const adminCookie = () => ({ cookie: `auth_token=${generateJwt('1', 'admin', 'admin')}` });

  beforeEach(async () => {
    saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
    process.env['JWT_SECRET'] = 'test-secret';
    delete process.env['DOMAIN'];

    storageDir = join(mkdtempSync(join(tmpdir(), 'dropit-web-')), 'uploads');
    repo = new FileRepository(await createTestDb());
    files = new FileService(repo, storageDir);
    render = fakeRenderer();

    const app = express();
    app.use(cookieParser());
    app.use(
      webRoutes(files, new McpTokenService(new McpTokenRepository(await createTestDb())), render),
    );
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    rmSync(storageDir, { recursive: true, force: true });
    for (const key of ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key]!;
    }
  });

  const context = (response: Response) => response.json() as Promise<PageContext>;

  it('renders the index page at /', async () => {
    const response = await server.fetch('/');

    expect(response.status).toBe(200);
    await expect(context(response)).resolves.toEqual({ page: 'index' });
  });

  it('renders the login page at /login', async () => {
    await expect(context(await server.fetch('/login'))).resolves.toEqual({ page: 'login' });
  });

  it('answers the /ping health check', async () => {
    const response = await server.fetch('/ping');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: 'hello' });
  });

  describe('GET /f/:id', () => {
    beforeEach(() => repo.create(makeRecord()));

    it('renders the complete page for a known view key', async () => {
      const response = await server.fetch('/f/view-1');

      expect(response.status).toBe(200);
      await expect(context(response)).resolves.toMatchObject({
        page: 'complete',
        data: { filename: 'report.pdf', downloadId: 'file-1', deleteId: 'del-1' },
      });
    });

    it('builds the origin from the request host', async () => {
      const response = await server.fetch('/f/view-1');
      const page = (await context(response)) as Extract<PageContext, { page: 'complete' }>;

      expect(page.data.origin).toBe(server.url);
    });

    it('prefers the X-Forwarded-* headers a proxy set', async () => {
      const response = await server.fetch('/f/view-1', {
        headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'drop.example' },
      });
      const page = (await context(response)) as Extract<PageContext, { page: 'complete' }>;

      expect(page.data.origin).toBe('https://drop.example');
    });

    it('takes the first entry of a comma-separated forwarded chain', async () => {
      const response = await server.fetch('/f/view-1', {
        headers: {
          'x-forwarded-proto': 'https, http',
          'x-forwarded-host': 'drop.example, internal.lan',
        },
      });
      const page = (await context(response)) as Extract<PageContext, { page: 'complete' }>;

      expect(page.data.origin).toBe('https://drop.example');
    });

    it('renders a 404 page for an unknown view key', async () => {
      const response = await server.fetch('/f/nope');

      expect(response.status).toBe(404);
      await expect(context(response)).resolves.toEqual({ page: 'file-not-found' });
    });

    it('still resolves a soft-deleted file, since /f/ only shows the links', async () => {
      await repo.create(makeRecord({ id: 'f2', deletionId: 'd2', viewId: 'v2', deleted: true }));

      await expect(context(await server.fetch('/f/v2'))).resolves.toMatchObject({
        page: 'complete',
      });
    });
  });

  describe('GET /dashboard', () => {
    const dashboardData = async (response: Response) =>
      ((await context(response)) as Extract<PageContext, { page: 'dashboard' }>).data;

    it('requires authentication', async () => {
      const response = await server.fetch('/dashboard');
      expect(response.status).toBe(401);
      expect(render).not.toHaveBeenCalled();
    });

    it('accepts an API token in the Authorization header', async () => {
      const response = await server.fetch('/dashboard', {
        headers: { authorization: `Bearer ${generateJwt('1', 'admin', 'admin')}` },
      });

      expect(response.status).toBe(200);
    });

    it('requires the admin role', async () => {
      const response = await server.fetch('/dashboard', {
        headers: { cookie: `auth_token=${generateJwt('2', 'bram', 'user')}` },
      });
      expect(response.status).toBe(403);
    });

    it('renders an empty first page when there are no files', async () => {
      const response = await server.fetch('/dashboard', { headers: adminCookie() });

      expect(response.status).toBe(200);
      const empty: DashboardPageData = { files: [], page: 1, totalPages: 0 };
      await expect(dashboardData(response)).resolves.toEqual(empty);
    });

    it('formats each row for display', async () => {
      await repo.create(
        makeRecord({
          size: 2048,
          downloadCount: 3,
          deleteAfterDownload: true,
          expiresAt: new Date(2026, 8, 1, 8, 5),
        }),
      );

      const { files: rows } = await dashboardData(
        await server.fetch('/dashboard', { headers: adminCookie() }),
      );

      expect(rows[0]).toEqual({
        id: 'file-1',
        filename: 'report.pdf',
        size: '2.0 KB',
        createdAt: '11/08/26 10:30',
        expiresAt: '01/09/26 08:05',
        downloadCount: 3,
        deleteAfterDownload: true,
        deleted: false,
      });
    });

    it('shows NEVER for a file with no expiry', async () => {
      await repo.create(makeRecord());
      const { files: rows } = await dashboardData(
        await server.fetch('/dashboard', { headers: adminCookie() }),
      );

      expect(rows[0]!.expiresAt).toBe('NEVER');
    });

    it('paginates ten files to a page', async () => {
      for (let i = 0; i < 25; i++) {
        await repo.create(
          makeRecord({
            id: `f${i}`,
            deletionId: `d${i}`,
            viewId: `v${i}`,
            createdAt: new Date(2026, 7, 11, 10, i),
          }),
        );
      }

      const first = await dashboardData(await server.fetch('/dashboard', { headers: adminCookie() }));
      expect(first.files).toHaveLength(10);
      expect(first.totalPages).toBe(3);

      const last = await dashboardData(await server.fetch('/dashboard?page=3', { headers: adminCookie() }));
      expect(last.files).toHaveLength(5);
      expect(last.page).toBe(3);
    });

    it.each([
      ['no page parameter', '/dashboard'],
      ['a non-numeric page', '/dashboard?page=abc'],
      ['page zero', '/dashboard?page=0'],
      ['a negative page', '/dashboard?page=-3'],
      ['an empty page parameter', '/dashboard?page='],
    ])('clamps %s to page 1', async (_label, path) => {
      const { page } = await dashboardData(await server.fetch(path, { headers: adminCookie() }));
      expect(page).toBe(1);
    });

    it('renders the dashboard page with an error and a 500 when the lookup fails', async () => {
      const broken = {
        getPaginatedFiles: () => Promise.reject(new Error('database is locked')),
      } as unknown as FileService;

      const app = express();
      app.use(cookieParser());
      app.use(
        webRoutes(
          broken,
          new McpTokenService(new McpTokenRepository(await createTestDb())),
          render,
        ),
      );
      const failing = await listen(app);

      try {
        const response = await failing.fetch('/dashboard', { headers: adminCookie() });

        expect(response.status).toBe(500);
        await expect(dashboardData(response)).resolves.toEqual({
          files: [],
          page: 1,
          totalPages: 0,
          error: 'database is locked',
        });
      } finally {
        await failing.close();
      }
    });
  });

  describe('GET /logout', () => {
    it('clears the cookie and redirects to the index', async () => {
      const response = await server.fetch('/logout', { headers: adminCookie() });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/');
      expect(response.headers.getSetCookie()[0]).toMatch(/^auth_token=;/);
    });

    it('scopes the cleared cookie to DOMAIN when configured', async () => {
      process.env['DOMAIN'] = 'drop.example';
      const response = await server.fetch('/logout', { headers: adminCookie() });

      expect(response.headers.getSetCookie()[0]).toContain('Domain=drop.example');
    });

    it('is itself behind the admin guard', async () => {
      expect((await server.fetch('/logout')).status).toBe(401);
    });
  });
});
