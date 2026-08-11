import cookieParser from 'cookie-parser';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookieValue, listen, type TestServer } from '../../testing/http';
import { csrfMiddleware, ensureCsrfCookie } from './csrf';

/** Mounts the full cookie -> csrf pipeline, echoing the token handlers see. */
function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.use(ensureCsrfCookie());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(csrfMiddleware());
  app.all('/echo', (req, res) => res.json({ seen: req.cookies?.['csrf_token'] ?? null }));
  return app;
}

describe('csrf middleware', () => {
  const saved = process.env['USE_HTTPS'];
  let server: TestServer;

  beforeEach(async () => {
    delete process.env['USE_HTTPS'];
    server = await listen(buildApp());
  });

  afterEach(async () => {
    await server.close();
    if (saved === undefined) delete process.env['USE_HTTPS'];
    else process.env['USE_HTTPS'] = saved;
  });

  describe('ensureCsrfCookie', () => {
    it('issues a token when the request carries none', async () => {
      const response = await server.fetch('/echo');
      expect(cookieValue(response, 'csrf_token')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('makes the new token visible to handlers in the same request', async () => {
      const response = await server.fetch('/echo');
      const issued = cookieValue(response, 'csrf_token');

      await expect(response.json()).resolves.toEqual({ seen: issued });
    });

    it('marks the cookie SameSite=Strict, readable by scripts, and site-wide', async () => {
      const [header] = (await server.fetch('/echo')).headers.getSetCookie();

      expect(header).toContain('SameSite=Strict');
      expect(header).toContain('Path=/');
      expect(header).not.toContain('HttpOnly');
      expect(header).not.toContain('Secure');
    });

    it('marks the cookie Secure when USE_HTTPS is on', async () => {
      process.env['USE_HTTPS'] = 'true';
      const [header] = (await server.fetch('/echo')).headers.getSetCookie();

      expect(header).toContain('Secure');
    });

    it('leaves an existing token alone', async () => {
      const response = await server.fetch('/echo', { headers: { cookie: 'csrf_token=existing' } });

      expect(response.headers.getSetCookie()).toHaveLength(0);
      await expect(response.json()).resolves.toEqual({ seen: 'existing' });
    });

    it('issues a different token to each fresh visitor', async () => {
      const first = cookieValue(await server.fetch('/echo'), 'csrf_token');
      const second = cookieValue(await server.fetch('/echo'), 'csrf_token');

      expect(first).not.toBe(second);
    });
  });

  describe('csrfMiddleware', () => {
    const authed = (extra: Record<string, string> = {}) => ({
      cookie: 'auth_token=jwt; csrf_token=token123',
      ...extra,
    });

    it('skips safe methods', async () => {
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        const response = await server.fetch('/echo', { method, headers: authed() });
        expect(response.status, method).toBe(200);
      }
    });

    it('skips requests that are not cookie-authenticated', async () => {
      const response = await server.fetch('/echo', {
        method: 'POST',
        headers: { cookie: 'csrf_token=token123' },
      });
      expect(response.status).toBe(200);
    });

    it('skips bearer-token clients, which are not cookie-driven', async () => {
      const response = await server.fetch('/echo', {
        method: 'POST',
        headers: authed({ authorization: 'Bearer abc' }),
      });
      expect(response.status).toBe(200);
    });

    it('accepts a matching X-CSRF-Token header', async () => {
      const response = await server.fetch('/echo', {
        method: 'POST',
        headers: authed({ 'x-csrf-token': 'token123' }),
      });
      expect(response.status).toBe(200);
    });

    it('accepts a matching _csrf form field', async () => {
      const response = await server.fetch('/echo', {
        method: 'POST',
        headers: authed({ 'content-type': 'application/x-www-form-urlencoded' }),
        body: '_csrf=token123',
      });
      expect(response.status).toBe(200);
    });

    it('rejects a missing token', async () => {
      const response = await server.fetch('/echo', { method: 'POST', headers: authed() });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'bad csrf token' });
    });

    it('rejects a mismatched token', async () => {
      const response = await server.fetch('/echo', {
        method: 'POST',
        headers: authed({ 'x-csrf-token': 'wrong' }),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'bad csrf token' });
    });

    it('rejects when the csrf cookie is absent but the auth cookie is not', async () => {
      // ensureCsrfCookie would have minted one, so this pipeline leaves it out.
      const bare = express();
      bare.use(cookieParser());
      bare.use(csrfMiddleware());
      bare.post('/echo', (_req, res) => res.json({ ok: true }));

      const unguarded = await listen(bare);
      try {
        const response = await unguarded.fetch('/echo', {
          method: 'POST',
          headers: { cookie: 'auth_token=jwt', 'x-csrf-token': 'token123' },
        });

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({ error: 'missing csrf cookie' });
      } finally {
        await unguarded.close();
      }
    });

    it('accepts a same-origin Origin header', async () => {
      const response = await server.fetch('/echo', {
        method: 'POST',
        headers: authed({ 'x-csrf-token': 'token123', origin: server.url }),
      });
      expect(response.status).toBe(200);
    });

    it('rejects a cross-origin request before even looking at the token', async () => {
      const response = await server.fetch('/echo', {
        method: 'POST',
        headers: authed({ 'x-csrf-token': 'token123', origin: 'https://evil.example' }),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'csrf origin blocked' });
    });

    it('guards PUT and DELETE alongside POST', async () => {
      for (const method of ['PUT', 'DELETE', 'PATCH']) {
        const response = await server.fetch('/echo', { method, headers: authed() });
        expect(response.status, method).toBe(403);
      }
    });
  });
});
