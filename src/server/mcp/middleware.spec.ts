import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from '../../testing/db';
import { listen, type TestServer } from '../../testing/http';
import { McpTokenRepository } from './tokens/repository';
import { McpTokenService } from './tokens/service';
import { mcpTokenAuth } from './middleware';

describe('mcpTokenAuth', () => {
  let server: TestServer;
  let tokens: McpTokenService;

  beforeEach(async () => {
    tokens = new McpTokenService(new McpTokenRepository(createTestDb()));

    const app = express();
    app.use(mcpTokenAuth(tokens));
    app.get('/', (req, res) => res.json({ token: req.mcpToken?.name }));

    server = await listen(app);
  });

  afterEach(() => server.close());

  const get = (headers: Record<string, string> = {}) => server.fetch('/', { headers });

  it('lets a valid token through and exposes it on the request', async () => {
    const { secret } = await tokens.issue({ name: 'agent', userId: 1 });

    const response = await get({ authorization: `Bearer ${secret}` });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ token: 'agent' });
  });

  it('answers 401 with a challenge when no token is presented', async () => {
    const response = await get();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('Bearer');
    // Shaped as JSON-RPC, never an HTML redirect: MCP clients are not browsers.
    await expect(response.json()).resolves.toMatchObject({ jsonrpc: '2.0', id: null });
  });

  it('rejects a non-bearer scheme', async () => {
    await expect(get({ authorization: 'Basic abc123' })).resolves.toMatchObject({ status: 401 });
  });

  it('rejects unknown and revoked tokens', async () => {
    await expect(get({ authorization: 'Bearer dropit_mcp_nope' })).resolves.toMatchObject({
      status: 401,
    });

    const { token, secret } = await tokens.issue({ name: 'doomed', userId: 1 });
    await tokens.revoke(token.id);

    await expect(get({ authorization: `Bearer ${secret}` })).resolves.toMatchObject({ status: 401 });
  });
});
