import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyJwt, type Claims } from '../auth/jwt';

export interface AuthInfo {
  userId: string;
  username: string;
  role: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthInfo;
  }
}

/**
 * Reads the JWT from an `Authorization: Bearer` header, falling back to the
 * auth_token cookie.
 *
 * An explicitly presented API token takes precedence: a stale or expired
 * browser cookie must not mask it. Either source may still fall through to the
 * other if it fails to verify.
 */
export function authMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const claims = verify(bearerToken(req)) ?? verify(req.cookies?.['auth_token']);
    if (!claims) return abortUnauthorized(req, res);

    req.auth = {
      userId: claims.user_id ?? '',
      username: claims.username ?? '',
      role: claims.role ?? '',
    };
    next();
  };
}

/** The token from `Authorization: Bearer <token>`, or empty if absent. */
function bearerToken(req: Request): string {
  const [scheme, value] = (req.get('authorization') ?? '').split(' ');
  return scheme === 'Bearer' && value ? value : '';
}

function verify(token: unknown): Claims | null {
  return typeof token === 'string' && token ? verifyJwt(token) : null;
}

export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.auth?.role;
    if (!role || !roles.includes(role)) return abortForbidden(req, res);
    next();
  };
}

function wantsHtml(req: Request): boolean {
  return (req.get('accept') ?? '').includes('text/html');
}

function abortUnauthorized(req: Request, res: Response): void {
  if (wantsHtml(req)) {
    res.redirect(302, '/login');
  } else {
    res.status(401).json({ error: 'unauthorized' });
  }
}

function abortForbidden(req: Request, res: Response): void {
  if (wantsHtml(req)) {
    res.redirect(302, '/');
  } else {
    res.status(403).json({ error: 'forbidden' });
  }
}
