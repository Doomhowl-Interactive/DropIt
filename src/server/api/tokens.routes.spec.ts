import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from '../../testing/db';
import { listen, type TestServer } from '../../testing/http';
import { generateJwt } from '../auth/jwt';
import { ApiTokenRepository } from '../tokens/repository';
import { ApiTokenService } from '../tokens/service';
import { tokenRoutes } from './tokens.routes';

describe('token routes', () => {
  let server: TestServer;
  let tokens: ApiTokenService;
  let adminAuth: Record<string, string>;
  let userAuth: Record<string, string>;

  beforeEach(async () => {
    process.env['JWT_SECRET'] = 'test-secret';

    tokens = new ApiTokenService(new ApiTokenRepository(await createTestDb()));

    const app = express();
    app.use(express.json());
    app.use('/api/tokens', tokenRoutes(tokens));
    server = await listen(app);

    adminAuth = { authorization: `Bearer ${generateJwt('1', 'admin', 'admin')}` };
    userAuth = { authorization: `Bearer ${generateJwt('2', 'bram', 'user')}` };
  });

  afterEach(async () => {
    await server.close();
    delete process.env['JWT_SECRET'];
  });

  const create = (body: unknown, headers = adminAuth) =>
    server.fetch('/api/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  it('issues a token and returns the secret exactly once', async () => {
    const response = await create({ name: 'agent' });
    expect(response.status).toBe(201);

    const created = (await response.json()) as { token: Record<string, unknown>; secret: string };
    expect(created.secret).toMatch(/^dropit_api_/);
    expect(created.token['name']).toBe('agent');
    expect(created.token).not.toHaveProperty('tokenHash');

    const listed = await (await server.fetch('/api/tokens', { headers: adminAuth })).json();
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(created.secret);
  });

  it('rejects a missing name', async () => {
    await expect(create({ name: '  ' })).resolves.toMatchObject({ status: 400 });
    await expect(create({ name: 'x'.repeat(80) })).resolves.toMatchObject({ status: 400 });
  });

  it('revokes a token', async () => {
    const created = (await (await create({ name: 'doomed' })).json()) as {
      token: { id: string };
      secret: string;
    };

    const response = await server.fetch(`/api/tokens/${created.token.id}/revoke`, {
      method: 'POST',
      headers: adminAuth,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ revoked: true });
    await expect(tokens.verify(created.secret)).resolves.toBeNull();
  });

  it('404s when revoking a token that does not exist', async () => {
    const response = await server.fetch('/api/tokens/nope/revoke', {
      method: 'POST',
      headers: adminAuth,
    });

    expect(response.status).toBe(404);
  });

  it('is admin-only', async () => {
    await expect(server.fetch('/api/tokens')).resolves.toMatchObject({ status: 401 });
    await expect(server.fetch('/api/tokens', { headers: userAuth })).resolves.toMatchObject({
      status: 403,
    });
    await expect(create({ name: 'agent' }, userAuth)).resolves.toMatchObject({ status: 403 });
  });
});
