import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Router, type Request, type Response } from 'express';
import type { IncomingMessage } from 'node:http';

import { config } from '../config';
import { requestOrigin } from '../util';
import type { FileService } from '../files/service';
import { mcpTokenAuth } from './middleware';
import { createMcpServer } from './server';
import type { McpTokenService } from './tokens/service';

export interface McpRouteDeps {
  files: FileService;
  tokens: McpTokenService;
}

/**
 * The MCP endpoint, served over Streamable HTTP.
 *
 * Deliberately **stateless** (`sessionIdGenerator: undefined`): a session map
 * would not survive the app being scaled past one machine — there is no sticky
 * routing — and it leaks entries whenever a client disconnects without sending
 * DELETE. Every tool here is plain request/response, so nothing is lost. If a
 * future tool needs progress notifications or resumability, this file is the
 * only place that has to change.
 */
export function mcpRoutes(deps: McpRouteDeps): Router {
  const router = Router();

  // Uploads arrive base64-encoded inside the JSON-RPC envelope, so this needs
  // its own much larger limit than the app-wide parser.
  router.use(express.json({ limit: config.mcpMaxBody }));
  router.use(mcpTokenAuth(deps.tokens));

  router.post('/', async (req: Request, res: Response) => {
    const server = createMcpServer({
      files: deps.files,
      origin: requestOrigin(req),
      token: req.mcpToken!,
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableDnsRebindingProtection: shouldCheckOrigin(),
      allowedHosts: config.allowedHosts.includes('*') ? undefined : config.allowedHosts,
      allowedOrigins: config.mcpAllowedOrigins.length ? config.mcpAllowedOrigins : undefined,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);

    // Express's `Request` carries this app's own `req.auth` (see
    // middleware/auth.ts), whose shape collides with the SDK's `AuthInfo`. The
    // transport only reads that property to forward it to handlers as
    // `extra.authInfo`, which our tools never consult — they take their caller
    // context explicitly — so dropping it on the way in is safe.
    await transport.handleRequest(req as IncomingMessage, res, req.body);
  });

  // A stateless server opens no server-to-client stream and holds no session,
  // so the GET and DELETE halves of the transport have nothing to do.
  const notAllowed = (_req: Request, res: Response): void => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed: this MCP server is stateless.' },
      id: null,
    });
  };

  router.get('/', notAllowed);
  router.delete('/', notAllowed);

  return router;
}

/** Only worth enabling once there is an actual allow-list to check against. */
function shouldCheckOrigin(): boolean {
  return !config.allowedHosts.includes('*') || config.mcpAllowedOrigins.length > 0;
}
