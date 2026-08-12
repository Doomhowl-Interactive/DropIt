import cookieParser from 'cookie-parser';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../testing/db';
import { cookieValue, listen, type TestServer } from '../../testing/http';
import { generateJwt, verifyJwt } from '../auth/jwt';
import { AuthService } from '../auth/service';
import { UserRepository } from '../users/repository';
import { UserService } from '../users/service';
import { authRoutes } from './auth.routes';

const ENV = ['JWT_SECRET', 'USE_HTTPS', 'DOMAIN'] as const;

describe('auth routes', () => {
  let saved: Record<string, string | undefined>;
  let server: TestServer;
  let users: UserService;

  const startServer = async () => {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/auth', authRoutes(new AuthService(users)));
    server = await listen(app);
  };

  const login = (body: unknown) =>
    server.fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
    for (const key of ENV) delete process.env[key];
    process.env['JWT_SECRET'] = 'test-secret';

    users = new UserService(new UserRepository(await createTestDb()));
    await users.createUser('admin', 'Hunter2!x', 'admin');
    await users.createUser('bram', 'Hunter2!x', 'user');

    await startServer();
  });

  afterEach(async () => {
    await server.close();
    for (const key of ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key]!;
    }
  });

  describe('POST /login', () => {
    it('returns a token for valid credentials', async () => {
      const response = await login({ username: 'admin', password: 'Hunter2!x' });

      expect(response.status).toBe(200);
      const { token } = (await response.json()) as { token: string };
      expect(verifyJwt(token)).toMatchObject({ username: 'admin', role: 'admin' });
    });

    it('sets an HttpOnly, SameSite=Strict auth_token cookie lasting a day', async () => {
      const response = await login({ username: 'admin', password: 'Hunter2!x' });
      const [header] = response.headers.getSetCookie();

      expect(header).toContain('HttpOnly');
      expect(header).toContain('SameSite=Strict');
      expect(header).toContain('Path=/');
      expect(header).toContain('Max-Age=86400');
      expect(header).not.toContain('Secure');
      expect(header).not.toContain('Domain=');
    });

    it('sets the cookie Secure and scoped to DOMAIN when configured', async () => {
      process.env['USE_HTTPS'] = 'true';
      process.env['DOMAIN'] = 'drop.example';

      const [header] = (
        await login({ username: 'admin', password: 'Hunter2!x' })
      ).headers.getSetCookie();

      expect(header).toContain('Secure');
      expect(header).toContain('Domain=drop.example');
    });

    it('logs in a non-admin too, with their own role', async () => {
      const response = await login({ username: 'bram', password: 'Hunter2!x' });
      const { token } = (await response.json()) as { token: string };

      expect(verifyJwt(token)).toMatchObject({ role: 'user' });
    });

    it('answers 401 for a wrong password', async () => {
      const response = await login({ username: 'admin', password: 'wrong' });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid credentials' });
      expect(response.headers.getSetCookie()).toHaveLength(0);
    });

    it('answers 401 for an unknown user', async () => {
      expect((await login({ username: 'nobody', password: 'Hunter2!x' })).status).toBe(401);
    });

    it.each([
      ['a missing username', { password: 'Hunter2!x' }],
      ['a missing password', { username: 'admin' }],
      ['an empty username', { username: '', password: 'Hunter2!x' }],
      ['an empty password', { username: 'admin', password: '' }],
      ['a non-string username', { username: 42, password: 'Hunter2!x' }],
      ['a non-string password', { username: 'admin', password: null }],
      ['an empty body', {}],
    ])('answers 400 for %s', async (_label, body) => {
      const response = await login(body);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' });
    });

    it('answers 400 when no body is sent at all', async () => {
      const response = await server.fetch('/api/auth/login', { method: 'POST' });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /me', () => {
    it('reports the caller identified by the login cookie', async () => {
      const token = cookieValue(
        await login({ username: 'bram', password: 'Hunter2!x' }),
        'auth_token',
      );
      const user = await users.findByUsername('bram');

      const response = await server.fetch('/api/auth/me', {
        headers: { cookie: `auth_token=${token}` },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ user_id: String(user.id), role: 'user' });
    });

    it('answers 401 without a token', async () => {
      expect((await server.fetch('/api/auth/me')).status).toBe(401);
    });
  });

  describe('GET /admin-check', () => {
    const as = (role: string) => ({ cookie: `auth_token=${generateJwt('1', 'someone', role)}` });

    it('greets an admin', async () => {
      const response = await server.fetch('/api/auth/admin-check', { headers: as('admin') });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ message: 'you are an admin' });
    });

    it('answers 403 for a non-admin', async () => {
      expect((await server.fetch('/api/auth/admin-check', { headers: as('user') })).status).toBe(
        403,
      );
    });

    it('answers 401 without a token', async () => {
      expect((await server.fetch('/api/auth/admin-check')).status).toBe(401);
    });
  });

  describe('POST /change-password', () => {
    const changePassword = (body: unknown, token?: string) =>
      server.fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { cookie: `auth_token=${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

    it('changes the password for the authenticated user', async () => {
      const token = cookieValue(
        await login({ username: 'bram', password: 'Hunter2!x' }),
        'auth_token',
      );

      const response = await changePassword(
        { oldPassword: 'Hunter2!x', newPassword: 'NewPass1!x' },
        token,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ message: 'password changed' });

      // The old password no longer works, the new one does.
      expect((await login({ username: 'bram', password: 'Hunter2!x' })).status).toBe(401);
      expect((await login({ username: 'bram', password: 'NewPass1!x' })).status).toBe(200);
    });

    it('answers 400 when the old password is wrong', async () => {
      const token = cookieValue(
        await login({ username: 'bram', password: 'Hunter2!x' }),
        'auth_token',
      );

      const response = await changePassword(
        { oldPassword: 'wrong', newPassword: 'NewPass1!x' },
        token,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Old password is incorrect' });
    });

    it('answers 400 for a weak new password', async () => {
      const token = cookieValue(
        await login({ username: 'bram', password: 'Hunter2!x' }),
        'auth_token',
      );

      const response = await changePassword(
        { oldPassword: 'Hunter2!x', newPassword: 'short' },
        token,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'New password is invalid' });
    });

    it.each([
      ['a missing oldPassword', { newPassword: 'NewPass1!x' }],
      ['a missing newPassword', { oldPassword: 'Hunter2!x' }],
      ['an empty oldPassword', { oldPassword: '', newPassword: 'NewPass1!x' }],
      ['an empty newPassword', { oldPassword: 'Hunter2!x', newPassword: '' }],
      ['a non-string oldPassword', { oldPassword: 42, newPassword: 'NewPass1!x' }],
      ['a non-string newPassword', { oldPassword: 'Hunter2!x', newPassword: null }],
      ['an empty body', {}],
    ])('answers 400 for %s', async (_label, body) => {
      const token = cookieValue(
        await login({ username: 'bram', password: 'Hunter2!x' }),
        'auth_token',
      );

      const response = await changePassword(body, token);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' });
    });

    it('answers 401 without a token', async () => {
      expect(
        (await changePassword({ oldPassword: 'Hunter2!x', newPassword: 'NewPass1!x' })).status,
      ).toBe(401);
    });
  });
});
