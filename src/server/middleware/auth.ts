import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyJwt } from '../auth/jwt';

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

/** Reads the JWT from the auth_token cookie, falling back to a bearer header. */
export function authMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    let token = req.cookies?.['auth_token'] ?? '';

    if (!token) {
      const header = req.get('authorization') ?? '';
      const [scheme, value] = header.split(' ');
      if (scheme === 'Bearer' && value) token = value;
    }

    if (!token) return abortUnauthorized(req, res);

    const claims = verifyJwt(token);
    if (!claims) return abortUnauthorized(req, res);

    req.auth = {
      userId: claims.user_id ?? '',
      username: claims.username ?? '',
      role: claims.role ?? '',
    };
    next();
  };
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
