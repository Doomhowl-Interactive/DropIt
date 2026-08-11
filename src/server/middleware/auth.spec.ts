import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../testing/db';
import { listen, type TestServer } from '../../testing/http';
import { generateJwt } from '../auth/jwt';
import { ApiTokenRepository } from '../tokens/repository';
import { ApiTokenService } from '../tokens/service';
import { UserRepository } from '../users/repository';
import { UserService } from '../users/service';
import { authMiddleware, requireRole, type AuthDeps } from './auth';

const HTML = { accept: 'text/html' };

describe('auth middleware', () => {
  const saved = process.env['JWT_SECRET'];
  let server: TestServer;

  const start = (build: (app: Express) => void) => {
    const app = express();
    app.use(cookieParser());
    build(app);
    return listen(app).then((started) => (server = started));
  };

  beforeEach(() => {
    process.env['JWT_SECRET'] = 'test-secret';
  });

  afterEach(async () => {
    await server?.close();
    if (saved === undefined) delete process.env['JWT_SECRET'];
    else process.env['JWT_SECRET'] = saved;
  });

  describe('authMiddleware', () => {
    beforeEach(() =>
      start((app) => {
        app.get('/protected', authMiddleware(), (req, res) => res.json(req.auth));
      }),
    );

    it('accepts a valid auth_token cookie and exposes the claims', async () => {
      const token = generateJwt('7', 'admin', 'admin');
      const response = await server.fetch('/protected', {
        headers: { cookie: `auth_token=${token}` },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        userId: '7',
        username: 'admin',
        role: 'admin',
      });
    });

    it('accepts a bearer token when there is no cookie', async () => {
      const token = generateJwt('7', 'admin', 'admin');
      const response = await server.fetch('/protected', {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ userId: '7' });
    });

    it('prefers an explicit API token over the cookie', async () => {
      const response = await server.fetch('/protected', {
        headers: {
          cookie: `auth_token=${generateJwt('1', 'cookie-user', 'admin')}`,
          authorization: `Bearer ${generateJwt('2', 'header-user', 'admin')}`,
        },
      });

      await expect(response.json()).resolves.toMatchObject({ username: 'header-user' });
    });

    it('falls back to the cookie when the bearer token does not verify', async () => {
      const response = await server.fetch('/protected', {
        headers: {
          cookie: `auth_token=${generateJwt('1', 'cookie-user', 'admin')}`,
          authorization: 'Bearer garbage',
        },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ username: 'cookie-user' });
    });

    it('lets a valid API token through despite an expired cookie', async () => {
      const expired = jwt.sign(
        { user_id: '1', username: 'cookie-user', role: 'admin' },
        'test-secret',
        {
          algorithm: 'HS256',
          expiresIn: '-1h',
        },
      );

      const response = await server.fetch('/protected', {
        headers: {
          cookie: `auth_token=${expired}`,
          authorization: `Bearer ${generateJwt('2', 'header-user', 'admin')}`,
        },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ username: 'header-user' });
    });

    it('answers 401 when neither the cookie nor the bearer token verifies', async () => {
      const response = await server.fetch('/protected', {
        headers: { cookie: 'auth_token=stale', authorization: 'Bearer garbage' },
      });

      expect(response.status).toBe(401);
    });

    it('defaults missing claims to empty strings', async () => {
      const token = generateJwt('', '', '');
      const response = await server.fetch('/protected', {
        headers: { cookie: `auth_token=${token}` },
      });

      await expect(response.json()).resolves.toEqual({ userId: '', username: '', role: '' });
    });

    it('answers 401 JSON when no token is presented', async () => {
      const response = await server.fetch('/protected');

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    });

    it('answers 401 for an invalid token', async () => {
      const response = await server.fetch('/protected', {
        headers: { cookie: 'auth_token=garbage' },
      });
      expect(response.status).toBe(401);
    });

    it('ignores a non-Bearer authorization scheme', async () => {
      const response = await server.fetch('/protected', {
        headers: { authorization: `Basic ${generateJwt('7', 'admin', 'admin')}` },
      });
      expect(response.status).toBe(401);
    });

    it('ignores a Bearer scheme with no value', async () => {
      const response = await server.fetch('/protected', { headers: { authorization: 'Bearer' } });
      expect(response.status).toBe(401);
    });

    it('redirects a browser to the login page instead of answering 401', async () => {
      const response = await server.fetch('/protected', { headers: HTML });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/login');
    });
  });

  describe('authMiddleware with API tokens', () => {
    let tokens: ApiTokenService;
    let authDeps: AuthDeps;

    beforeEach(async () => {
      const db = await createTestDb();
      tokens = new ApiTokenService(new ApiTokenRepository(db));
      const users = new UserService(new UserRepository(db));
      await users.createUser('admin', 'Adminpass1', 'admin');
      authDeps = { tokens, users };

      await start((app) => {
        app.get('/protected', authMiddleware(authDeps), (req, res) =>
          res.json({ auth: req.auth, tokenName: req.apiToken?.name ?? null }),
        );
        app.get('/admin', authMiddleware(authDeps), requireRole('admin'), (_req, res) =>
          res.json({ ok: true }),
        );
      });
    });

    it('accepts a long-lived API token and loads the owning user', async () => {
      const { secret } = await tokens.issue({ name: 'agent', userId: 1 });

      const response = await server.fetch('/protected', {
        headers: { authorization: `Bearer ${secret}` },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        auth: { userId: '1', username: 'admin', role: 'admin' },
        tokenName: 'agent',
      });
    });

    it('honours the role of the owning user for requireRole', async () => {
      const { secret } = await tokens.issue({ name: 'agent', userId: 1 });

      await expect(
        server.fetch('/admin', { headers: { authorization: `Bearer ${secret}` } }),
      ).resolves.toMatchObject({ status: 200 });
    });

    it('rejects revoked and unknown API tokens', async () => {
      await expect(
        server.fetch('/protected', { headers: { authorization: 'Bearer dropit_api_nope' } }),
      ).resolves.toMatchObject({ status: 401 });

      const { token, secret } = await tokens.issue({ name: 'doomed', userId: 1 });
      await tokens.revoke(token.id);

      await expect(
        server.fetch('/protected', { headers: { authorization: `Bearer ${secret}` } }),
      ).resolves.toMatchObject({ status: 401 });
    });

    it('prefers a bearer API token over a session cookie', async () => {
      const { secret } = await tokens.issue({ name: 'agent', userId: 1 });

      const response = await server.fetch('/protected', {
        headers: {
          cookie: `auth_token=${generateJwt('99', 'cookie-user', 'user')}`,
          authorization: `Bearer ${secret}`,
        },
      });

      await expect(response.json()).resolves.toMatchObject({
        auth: { username: 'admin', role: 'admin' },
        tokenName: 'agent',
      });
    });
  });

  describe('requireRole', () => {
    beforeEach(() =>
      start((app) => {
        app.get('/admin', authMiddleware(), requireRole('admin'), (_req, res) =>
          res.json({ ok: true }),
        );
        app.get('/staff', authMiddleware(), requireRole('admin', 'moderator'), (_req, res) =>
          res.json({ ok: true }),
        );
      }),
    );

    const as = (role: string) => ({ cookie: `auth_token=${generateJwt('7', 'someone', role)}` });

    it('lets the required role through', async () => {
      expect((await server.fetch('/admin', { headers: as('admin') })).status).toBe(200);
    });

    it('accepts any of several allowed roles', async () => {
      expect((await server.fetch('/staff', { headers: as('admin') })).status).toBe(200);
      expect((await server.fetch('/staff', { headers: as('moderator') })).status).toBe(200);
    });

    it('answers 403 JSON for the wrong role', async () => {
      const response = await server.fetch('/admin', { headers: as('user') });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
    });

    it('answers 403 when the role claim is empty', async () => {
      expect((await server.fetch('/admin', { headers: as('') })).status).toBe(403);
    });

    it('redirects a browser to the index page instead of answering 403', async () => {
      const response = await server.fetch('/admin', { headers: { ...as('user'), ...HTML } });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/');
    });
  });

  it('answers 403 when requireRole runs without authMiddleware having set req.auth', async () => {
    await start((app) => {
      app.get('/admin', requireRole('admin'), (_req, res) => res.json({ ok: true }));
    });

    expect((await server.fetch('/admin')).status).toBe(403);
  });

  it('answers 401 when cookie-parser is not installed and no header is sent', async () => {
    const app = express();
    app.get('/protected', authMiddleware(), (_req, res) => res.json({ ok: true }));
    server = await listen(app);

    expect((await server.fetch('/protected')).status).toBe(401);
  });
});
