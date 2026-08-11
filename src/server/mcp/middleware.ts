import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { McpToken, McpTokenService } from './tokens/service';

declare module 'express-serve-static-core' {
  interface Request {
    mcpToken?: McpToken;
  }
}

/**
 * Authenticates an MCP client by its bearer token.
 *
 * Unlike `authMiddleware`, a failure never redirects to /login: MCP clients are
 * not browsers, and a 302 to an HTML page is unreadable to them. They get the
 * 401 plus `WWW-Authenticate` that the MCP spec expects, with a JSON-RPC shaped
 * body so a client that does try to parse it gets something sensible.
 */
export function mcpTokenAuth(tokens: McpTokenService): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.get('authorization') ?? '';
    const [scheme, value] = header.split(' ');

    if (scheme !== 'Bearer' || !value) {
      return unauthorized(res, 'A Drop.it MCP token is required.');
    }

    tokens
      .verify(value)
      .then((token) => {
        if (!token) {
          return unauthorized(res, 'This MCP token is unknown, revoked or expired.');
        }
        req.mcpToken = token;
        next();
      })
      .catch(next);
  };
}

function unauthorized(res: Response, message: string): void {
  res.setHeader('WWW-Authenticate', 'Bearer realm="dropit-mcp"');
  res.status(401).json({
    jsonrpc: '2.0',
    error: { code: -32001, message },
    id: null,
  });
}
