import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../testing/db';
import { listen, multipart, type TestServer } from '../../testing/http';
import { fakeRenderer } from '../../testing/render';
import { generateJwt } from '../auth/jwt';
import { FileRepository, type FileRecord } from '../files/repository';
import { FileService } from '../files/service';
import { fileRoutes } from './files.routes';

interface UploadResponse {
  id: string;
  deletion_id: string;
  filename: string;
  size: number;
  view_key: string;
}

describe('file routes', () => {
  const saved = process.env['JWT_SECRET'];
  let storageDir: string;
  let repo: FileRepository;
  let files: FileService;
  let render: ReturnType<typeof fakeRenderer>;
  let server: TestServer;

  const admin = () => ({ cookie: `auth_token=${generateJwt('1', 'admin', 'admin')}` });
  const user = () => ({ cookie: `auth_token=${generateJwt('2', 'bram', 'user')}` });

  /** Registers a file the way an upload would, with real bytes on disk. */
  const store = async (
    contents = 'hello world',
    overrides: Partial<FileRecord> = {},
    filename = 'report.txt',
  ) => {
    const { folderId, folderPath } = files.createUploadFolder();
    const path = join(folderPath, 'blob');
    writeFileSync(path, contents);

    const record = await files.registerUpload({
      folderId,
      originalName: filename,
      path,
      size: contents.length,
    });

    if (Object.keys(overrides).length) {
      Object.assign(record, overrides);
      await repo.delete(record);
      await repo.create(record);
    }
    return record;
  };

  /** A multipart body with one `file` part, plus any extra form fields. */
  const formWith = (
    contents = 'uploaded bytes',
    filename = 'notes.txt',
    fields: Record<string, string> = {},
  ) => multipart([{ field: 'file', filename, contents }], fields);

  const upload = (
    form: ReturnType<typeof multipart>,
    headers: Record<string, string> = admin(),
    target: TestServer = server,
  ) =>
    target.fetch('/api/files/upload', {
      method: 'POST',
      headers: { ...headers, ...form.headers },
      body: form.body,
    });

  beforeEach(async () => {
    process.env['JWT_SECRET'] = 'test-secret';

    storageDir = join(mkdtempSync(join(tmpdir(), 'dropit-routes-')), 'uploads');
    repo = new FileRepository(await createTestDb());
    files = new FileService(repo, storageDir);
    render = fakeRenderer();

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/files', fileRoutes(files, render));
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    rmSync(storageDir, { recursive: true, force: true });
    if (saved === undefined) delete process.env['JWT_SECRET'];
    else process.env['JWT_SECRET'] = saved;
  });

  describe('POST /upload', () => {
    it('stores the file and returns its keys', async () => {
      const response = await upload(formWith('uploaded bytes'));

      expect(response.status).toBe(200);
      const body = (await response.json()) as UploadResponse;
      expect(body.filename).toBe('notes.txt');
      expect(body.size).toBe('uploaded bytes'.length);
      expect(body.id).toBeTruthy();
      expect(body.deletion_id).toBeTruthy();
      expect(body.view_key).toBeTruthy();
    });

    it('never leaks the on-disk path', async () => {
      const body = (await (await upload(formWith())).json()) as Record<string, unknown>;
      expect(body['path']).toBeUndefined();
    });

    it('writes the bytes under a per-upload folder', async () => {
      const body = (await (await upload(formWith('uploaded bytes'))).json()) as UploadResponse;
      const record = await repo.getById(body.id);

      expect(record.path.startsWith(join(storageDir, body.id))).toBe(true);
      expect(existsSync(record.path)).toBe(true);
    });

    it('stores no expiry when no duration is given', async () => {
      const body = (await (await upload(formWith())).json()) as UploadResponse;
      await expect(repo.getById(body.id)).resolves.toMatchObject({ expiresAt: null });
    });

    it('turns a positive duration into an expiry that many seconds out', async () => {
      const form = formWith('uploaded bytes', 'notes.txt', { duration: '3600' });

      const before = Date.now();
      const body = (await (await upload(form)).json()) as UploadResponse;
      const record = await repo.getById(body.id);

      expect(record.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 3600_000);
      expect(record.expiresAt!.getTime()).toBeLessThan(Date.now() + 3601_000);
    });

    it.each(['-1', '0', 'forever', ''])('treats duration %o as no expiry', async (duration) => {
      const form = formWith('uploaded bytes', 'notes.txt', { duration });

      const body = (await (await upload(form)).json()) as UploadResponse;
      await expect(repo.getById(body.id)).resolves.toMatchObject({ expiresAt: null });
    });

    it('preserves a non-ASCII original filename', async () => {
      const body = (await (await upload(formWith('x', 'résumé.txt'))).json()) as UploadResponse;
      expect(body.filename).toBe('résumé.txt');
    });

    it('answers 400 when no file part is present', async () => {
      const response = await upload(multipart([], { duration: '60' }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'missing file' });
    });

    it('answers 401 without a token', async () => {
      expect((await upload(formWith(), {})).status).toBe(401);
    });

    it('answers 403 for a non-admin', async () => {
      expect((await upload(formWith(), user())).status).toBe(403);
    });

    it('answers 500 when the record cannot be persisted', async () => {
      const broken = Object.create(files) as FileService;
      Object.defineProperty(broken, 'registerUpload', {
        value: () => Promise.reject(new Error('database is locked')),
      });

      const app = express();
      app.use(cookieParser());
      app.use('/api/files', fileRoutes(broken, render));
      const failing = await listen(app);

      try {
        const response = await upload(formWith(), admin(), failing);

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'database is locked' });
      } finally {
        await failing.close();
      }
    });
  });

  describe.each(['download', 'view'])('GET /%s/:id', (route) => {
    it('streams the stored bytes', async () => {
      const record = await store('hello world');
      const response = await server.fetch(`/api/files/${route}/${record.id}`);

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe('hello world');
    });

    it('sets an inline disposition and blocks sniffing', async () => {
      const record = await store('hello world');
      const response = await server.fetch(`/api/files/${route}/${record.id}`);

      expect(response.headers.get('content-disposition')).toBe('inline; filename="report.txt"');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('sanitises a filename that would break the header', async () => {
      const record = await store('x', {}, 'we"ird\\name.txt');
      const response = await server.fetch(`/api/files/${route}/${record.id}`);

      expect(response.headers.get('content-disposition')).toBe('inline; filename="weirdname.txt"');
    });

    it('counts the download', async () => {
      const record = await store();
      await server.fetch(`/api/files/${route}/${record.id}`);

      await expect(repo.getById(record.id)).resolves.toMatchObject({ downloadCount: 1 });
    });

    it('renders the 404 page for an unknown id', async () => {
      const response = await server.fetch(`/api/files/${route}/nope`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ page: 'file-not-found' });
    });

    it('renders the 404 page for a deleted file', async () => {
      const record = await store();
      await files.deleteFileById(record.id);

      await expect(
        (await server.fetch(`/api/files/${route}/${record.id}`)).json(),
      ).resolves.toEqual({ page: 'file-not-found' });
    });

    it('renders the 404 page for an expired file', async () => {
      const record = await store('x', { expiresAt: new Date(Date.now() - 1000) });

      await expect(
        (await server.fetch(`/api/files/${route}/${record.id}`)).json(),
      ).resolves.toEqual({ page: 'file-not-found' });
    });

    it('renders the 404 page when the row survives but the bytes are gone', async () => {
      const record = await store();
      rmSync(join(storageDir, record.id), { recursive: true, force: true });

      const response = await server.fetch(`/api/files/${route}/${record.id}`);
      await expect(response.json()).resolves.toEqual({ page: 'file-not-found' });
    });

    it('is public — no token needed', async () => {
      const record = await store();
      expect((await server.fetch(`/api/files/${route}/${record.id}`)).status).toBe(200);
    });
  });

  describe('GET /delete/:del_id', () => {
    it('soft-deletes the file and renders the confirmation page', async () => {
      const record = await store();
      const response = await server.fetch(`/api/files/delete/${record.deletionId}`, {
        headers: admin(),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ page: 'deleted' });
      await expect(repo.getById(record.id)).resolves.toMatchObject({ deleted: true });
    });

    it('renders the 404 page for an unknown deletion key', async () => {
      const response = await server.fetch('/api/files/delete/nope', { headers: admin() });
      await expect(response.json()).resolves.toEqual({ page: 'file-not-found' });
    });

    it('renders the 404 page when the file is already deleted', async () => {
      const record = await store();
      await files.deleteFileById(record.id);

      const response = await server.fetch(`/api/files/delete/${record.deletionId}`, {
        headers: admin(),
      });
      await expect(response.json()).resolves.toEqual({ page: 'file-not-found' });
    });

    it('requires an admin', async () => {
      const record = await store();

      expect((await server.fetch(`/api/files/delete/${record.deletionId}`)).status).toBe(401);
      expect(
        (await server.fetch(`/api/files/delete/${record.deletionId}`, { headers: user() })).status,
      ).toBe(403);
    });
  });

  describe('dashboard endpoints', () => {
    it.each([
      ['GET', '/api/files/dashboard/'],
      ['GET', '/api/files/dashboard/export'],
      ['POST', '/api/files/dashboard/import'],
      ['POST', '/api/files/dashboard/orphans'],
    ])('%s %s requires an admin', async (method, path) => {
      expect((await server.fetch(path, { method })).status).toBe(401);
      expect((await server.fetch(path, { method, headers: user() })).status).toBe(403);
    });

    describe('GET /dashboard/ and /dashboard/export', () => {
      it('list every file', async () => {
        await store();
        await store();

        for (const path of ['/api/files/dashboard/', '/api/files/dashboard/export']) {
          const response = await server.fetch(path, { headers: admin() });
          expect(response.status, path).toBe(200);
          await expect(response.json()).resolves.toHaveLength(2);
        }
      });

      it('answer 500 when the lookup fails', async () => {
        const broken = Object.create(files) as FileService;
        Object.defineProperty(broken, 'getAllFiles', {
          value: () => Promise.reject(new Error('database is locked')),
        });

        const app = express();
        app.use(cookieParser());
        app.use('/api/files', fileRoutes(broken, render));
        const failing = await listen(app);

        try {
          const response = await failing.fetch('/api/files/dashboard/', { headers: admin() });
          expect(response.status).toBe(500);
          await expect(response.json()).resolves.toEqual({ error: 'database is locked' });
        } finally {
          await failing.close();
        }
      });
    });

    describe('POST /dashboard/import', () => {
      const post = (body: unknown) =>
        server.fetch('/api/files/dashboard/import', {
          method: 'POST',
          headers: { ...admin(), 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

      const incoming = {
        id: 'imported-1',
        deletion_id: 'del-1',
        filename: 'legacy.bin',
        size: 10,
        download_count: 0,
        deleted: false,
        created_at: '2026-01-02T03:04:05.000Z',
      };

      it('imports the records and reports the count', async () => {
        const response = await post([incoming]);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ imported: 1 });
        await expect(repo.getById('imported-1')).resolves.toMatchObject({ filename: 'legacy.bin' });
      });

      it('accepts an empty array', async () => {
        await expect((await post([])).json()).resolves.toEqual({ imported: 0 });
      });

      it('answers 400 when the payload is an object rather than a list', async () => {
        const response = await post({ id: 'x' });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: 'invalid JSON' });
      });

      it('answers 400 when the body is missing entirely', async () => {
        const response = await server.fetch('/api/files/dashboard/import', {
          method: 'POST',
          headers: admin(),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: 'invalid JSON' });
      });

      it.each([
        ['a bare string', '"nope"'],
        ['null', 'null'],
        ['malformed JSON', '{'],
      ])('is rejected by the body parser for %s', async (_label, raw) => {
        const response = await server.fetch('/api/files/dashboard/import', {
          method: 'POST',
          headers: { ...admin(), 'content-type': 'application/json' },
          body: raw,
        });

        expect(response.status).toBe(400);
      });

      it('answers 500 when the import fails', async () => {
        const broken = Object.create(files) as FileService;
        Object.defineProperty(broken, 'importFiles', {
          value: () => Promise.reject(new Error('database is locked')),
        });

        const app = express();
        app.use(cookieParser());
        app.use(express.json());
        app.use('/api/files', fileRoutes(broken, render));
        const failing = await listen(app);

        try {
          const response = await failing.fetch('/api/files/dashboard/import', {
            method: 'POST',
            headers: { ...admin(), 'content-type': 'application/json' },
            body: JSON.stringify([incoming]),
          });

          expect(response.status).toBe(500);
          await expect(response.json()).resolves.toEqual({ error: 'database is locked' });
        } finally {
          await failing.close();
        }
      });
    });

    describe('POST /dashboard/orphans', () => {
      const dropOrphan = (folderId = 'orphan-1', filename = 'stray.bin') => {
        mkdirSync(join(storageDir, folderId), { recursive: true });
        writeFileSync(join(storageDir, folderId, filename), 'stray bytes');
      };

      it('registers loose folders and redirects back to the console', async () => {
        dropOrphan();

        const response = await server.fetch('/api/files/dashboard/orphans', {
          method: 'POST',
          headers: admin(),
        });

        expect(response.status).toBe(303);
        expect(response.headers.get('location')).toBe('/dashboard');
        await expect(repo.getById('orphan-1')).resolves.toMatchObject({
          filename: 'stray.bin',
          path: join(storageDir, 'orphan-1', 'stray.bin'),
        });
      });

      it('redirects even when there is nothing to add', async () => {
        const response = await server.fetch('/api/files/dashboard/orphans', {
          method: 'POST',
          headers: admin(),
        });

        expect(response.status).toBe(303);
        expect(response.headers.get('location')).toBe('/dashboard');
        await expect(repo.getAll()).resolves.toEqual([]);
      });

      it('answers 500 when the scan fails', async () => {
        const broken = Object.create(files) as FileService;
        Object.defineProperty(broken, 'addOrphans', {
          value: () => Promise.reject(new Error('disk is read-only')),
        });

        const app = express();
        app.use(cookieParser());
        app.use('/api/files', fileRoutes(broken, render));
        const failing = await listen(app);

        try {
          const response = await failing.fetch('/api/files/dashboard/orphans', {
            method: 'POST',
            headers: admin(),
          });

          expect(response.status).toBe(500);
          await expect(response.json()).resolves.toEqual({ error: 'disk is read-only' });
        } finally {
          await failing.close();
        }
      });
    });

    describe('POST /dashboard/delete/:id', () => {
      it('soft-deletes and redirects back to the console', async () => {
        const record = await store();
        const response = await server.fetch(`/api/files/dashboard/delete/${record.id}`, {
          method: 'POST',
          headers: admin(),
        });

        expect(response.status).toBe(303);
        expect(response.headers.get('location')).toBe('/dashboard');
        await expect(repo.getById(record.id)).resolves.toMatchObject({ deleted: true });
      });

      it('leaves the bytes on disk', async () => {
        const record = await store();
        await server.fetch(`/api/files/dashboard/delete/${record.id}`, {
          method: 'POST',
          headers: admin(),
        });

        expect(existsSync(record.path)).toBe(true);
      });

      it('answers 404 for an unknown id', async () => {
        const response = await server.fetch('/api/files/dashboard/delete/nope', {
          method: 'POST',
          headers: admin(),
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: 'file not found' });
      });

      it('answers 404 when the file is already deleted', async () => {
        const record = await store();
        await files.deleteFileById(record.id);

        const response = await server.fetch(`/api/files/dashboard/delete/${record.id}`, {
          method: 'POST',
          headers: admin(),
        });
        expect(response.status).toBe(404);
      });
    });

    describe('POST /dashboard/delete/fr/:id', () => {
      it('removes the row and the bytes, then redirects', async () => {
        const record = await store();
        const response = await server.fetch(`/api/files/dashboard/delete/fr/${record.id}`, {
          method: 'POST',
          headers: admin(),
        });

        expect(response.status).toBe(303);
        expect(response.headers.get('location')).toBe('/dashboard');
        expect(existsSync(join(storageDir, record.id))).toBe(false);
        await expect(repo.getAll()).resolves.toEqual([]);
      });

      it('works on an already soft-deleted file', async () => {
        const record = await store();
        await files.deleteFileById(record.id);

        const response = await server.fetch(`/api/files/dashboard/delete/fr/${record.id}`, {
          method: 'POST',
          headers: admin(),
        });
        expect(response.status).toBe(303);
      });

      it('answers 404 for an unknown id', async () => {
        const response = await server.fetch('/api/files/dashboard/delete/fr/nope', {
          method: 'POST',
          headers: admin(),
        });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: 'file not found' });
      });

      it('answers 500 when the hard delete itself fails', async () => {
        const record = await store();
        const broken = Object.create(files) as FileService;
        Object.defineProperty(broken, 'forceDelete', {
          value: () => Promise.reject(new Error('disk is read-only')),
        });

        const app = express();
        app.use(cookieParser());
        app.use('/api/files', fileRoutes(broken, render));
        const failing = await listen(app);

        try {
          const response = await failing.fetch(`/api/files/dashboard/delete/fr/${record.id}`, {
            method: 'POST',
            headers: admin(),
          });

          expect(response.status).toBe(500);
          await expect(response.json()).resolves.toEqual({ error: 'disk is read-only' });
        } finally {
          await failing.close();
        }
      });
    });

    describe.each(['/api/files/dashboard/download', '/api/files/dashboard'])('GET %s/:id', (prefix) => {
      it('streams the file without counting a download', async () => {
        const record = await store('hello world');
        const response = await server.fetch(`${prefix}/${record.id}`, { headers: admin() });

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('hello world');
        await expect(repo.getById(record.id)).resolves.toMatchObject({ downloadCount: 0 });
      });

      it('serves a soft-deleted file, unlike the public route', async () => {
        const record = await store('hello world');
        await files.deleteFileById(record.id);

        const response = await server.fetch(`${prefix}/${record.id}`, { headers: admin() });
        expect(response.status).toBe(200);
      });

      it('answers 404 JSON for an unknown id', async () => {
        const response = await server.fetch(`${prefix}/nope`, { headers: admin() });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: 'file not found' });
      });

      it('requires an admin', async () => {
        const record = await store();
        expect((await server.fetch(`${prefix}/${record.id}`)).status).toBe(401);
        expect((await server.fetch(`${prefix}/${record.id}`, { headers: user() })).status).toBe(403);
      });
    });

    it('renders the 404 page when an admin download finds no bytes on disk', async () => {
      const record = await store();
      rmSync(join(storageDir, record.id), { recursive: true, force: true });

      const response = await server.fetch(`/api/files/dashboard/download/${record.id}`, {
        headers: admin(),
      });
      await expect(response.json()).resolves.toEqual({ page: 'file-not-found' });
    });
  });
});
