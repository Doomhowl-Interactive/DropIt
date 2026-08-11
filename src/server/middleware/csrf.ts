import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from '../config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Issues the csrf_token cookie when missing.
 *
 * SameSite=Strict limits cross-site sending; HttpOnly must stay false so page
 * scripts can read the value back out and echo it in a header or form field.
 */
export function ensureCsrfCookie(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.cookies?.['csrf_token']) {
      const token = randomBytes(32).toString('base64url');
      res.cookie('csrf_token', token, {
        path: '/',
        secure: config.useHttps,
        httpOnly: false,
        sameSite: 'strict',
      });
      // Make it visible to handlers within this same request.
      req.cookies = { ...req.cookies, csrf_token: token };
    }
    next();
  };
}

/**
 * Double-submit cookie check on unsafe methods for cookie-authenticated calls.
 *
 * - safe methods are skipped
 * - `Authorization: Bearer` clients are skipped (they are not cookie-driven)
 * - only enforced once an auth_token cookie is in play
 */
export function csrfMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();
    if ((req.get('authorization') ?? '').startsWith('Bearer ')) return next();
    if (!req.cookies?.['auth_token']) return next();

    const origin = req.get('origin');
    if (origin && !origin.includes(req.get('host') ?? '')) {
      res.status(403).json({ error: 'csrf origin blocked' });
      return;
    }

    const cookieToken = req.cookies['csrf_token'];
    if (!cookieToken) {
      res.status(403).json({ error: 'missing csrf cookie' });
      return;
    }

    const requestToken = req.get('x-csrf-token') || req.body?.['_csrf'];
    if (!requestToken || requestToken !== cookieToken) {
      res.status(403).json({ error: 'bad csrf token' });
      return;
    }

    next();
  };
}
