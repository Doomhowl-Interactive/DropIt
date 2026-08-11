import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyJwt, type Claims } from '../auth/jwt';
import type { ApiToken, ApiTokenService } from '../tokens/service';
import type { UserService } from '../users/service';

export interface AuthInfo {
  userId: string;
  username: string;
  role: string;
}

/** Optional services that unlock long-lived API token bearer auth. */
export interface AuthDeps {
  tokens?: Pick<ApiTokenService, 'verify'>;
  users?: Pick<UserService, 'findById'>;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthInfo;
    /** Set when the caller authenticated with a long-lived API token. */
    apiToken?: ApiToken;
  }
}

/**
 * Reads credentials from an `Authorization: Bearer` header, falling back to the
 * auth_token cookie.
 *
 * An explicitly presented bearer credential takes precedence: a stale or expired
 * browser cookie must not mask it. Bearer values are tried as a session JWT
 * first, then (when `deps` is wired) as a long-lived API token. Either source
 * may still fall through to the other if it fails to verify.
 */
export function authMiddleware(deps: AuthDeps = {}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void authenticate(req, deps)
      .then((ok) => {
        if (!ok) return abortUnauthorized(req, res);
        next();
      })
      .catch(next);
  };
}

async function authenticate(req: Request, deps: AuthDeps): Promise<boolean> {
  const bearer = bearerToken(req);

  if (bearer) {
    const claims = verify(bearer);
    if (claims) {
      setAuthFromClaims(req, claims);
      return true;
    }

    if (await tryApiToken(req, bearer, deps)) return true;
  }

  const cookieClaims = verify(req.cookies?.['auth_token']);
  if (cookieClaims) {
    setAuthFromClaims(req, cookieClaims);
    return true;
  }

  return false;
}

async function tryApiToken(req: Request, secret: string, deps: AuthDeps): Promise<boolean> {
  if (!deps.tokens || !deps.users) return false;

  const token = await deps.tokens.verify(secret);
  if (!token) return false;

  try {
    const user = await deps.users.findById(token.userId);
    req.auth = {
      userId: String(user.id),
      username: user.username,
      role: user.role,
    };
    req.apiToken = token;
    return true;
  } catch {
    return false;
  }
}

function setAuthFromClaims(req: Request, claims: Claims): void {
  req.auth = {
    userId: claims.user_id ?? '',
    username: claims.username ?? '',
    role: claims.role ?? '',
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
