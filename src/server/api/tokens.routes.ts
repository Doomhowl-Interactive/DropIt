import { Router, type Request, type Response } from 'express';

import { authMiddleware, requireRole, type AuthDeps } from '../middleware/auth';
import { ApiTokenNotFoundError, type ApiTokenService } from '../tokens/service';
import { listTokenRows, toApiTokenRow } from '../tokens/view';
import { param, parseBody } from '../util';
import {
  ApiTokenRowSchema,
  ApiTokensListResponseSchema,
  CreateApiTokenRequestSchema,
  CreatedApiTokenSchema,
} from '../../shared/types';

/** Admin-only management of long-lived API bearer tokens. */
export function tokenRoutes(tokens: ApiTokenService, auth: AuthDeps = {}): Router {
  const router = Router();
  router.use(authMiddleware(auth), requireRole('admin'));

  router.get('/', async (_req: Request, res: Response) => {
    try {
      res.json(ApiTokensListResponseSchema.parse(await listTokenRows(tokens)));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const body = parseBody(res, CreateApiTokenRequestSchema, req.body);
    if (!body) return;

    try {
      const { token, secret } = await tokens.issue({
        name: body.name,
        userId: Number(req.auth?.userId ?? 0),
      });

      // The only response that ever carries the plaintext secret.
      res.status(201).json(CreatedApiTokenSchema.parse({ token: toApiTokenRow(token), secret }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const token = await tokens.revoke(param(req, 'id'));
      res.json(ApiTokenRowSchema.parse(toApiTokenRow(token)));
    } catch (err) {
      if (err instanceof ApiTokenNotFoundError) {
        res.status(404).json({ error: 'token not found' });
        return;
      }
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
