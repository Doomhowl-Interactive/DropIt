import { Router, type Request, type Response } from 'express';

import { authMiddleware, requireRole } from '../middleware/auth';
import { McpTokenNotFoundError, type McpTokenService } from '../mcp/tokens/service';
import { listTokenRows, toMcpTokenRow } from '../mcp/tokens/view';
import { param } from '../util';

const MAX_NAME_LENGTH = 60;
const MAX_EXPIRY_DAYS = 3650;

/** Admin-only management of the bearer tokens that unlock /mcp. */
export function mcpTokenRoutes(tokens: McpTokenService): Router {
  const router = Router();
  router.use(authMiddleware(), requireRole('admin'));

  router.get('/', async (_req: Request, res: Response) => {
    try {
      res.json(await listTokenRows(tokens));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const name = String(req.body?.['name'] ?? '').trim();
    if (!name || name.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `name must be 1-${MAX_NAME_LENGTH} characters` });
      return;
    }

    const rawDays = req.body?.['expiresInDays'];
    const days = rawDays == null || rawDays === '' ? null : Number(rawDays);
    if (days !== null && (!Number.isFinite(days) || days <= 0 || days > MAX_EXPIRY_DAYS)) {
      res.status(400).json({ error: `expiresInDays must be between 1 and ${MAX_EXPIRY_DAYS}` });
      return;
    }

    try {
      const { token, secret } = await tokens.issue({
        name,
        userId: Number(req.auth?.userId ?? 0),
        expiresAt: days === null ? null : new Date(Date.now() + days * 86_400_000),
      });

      // The only response that ever carries the plaintext secret.
      res.status(201).json({ token: toMcpTokenRow(token), secret });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post('/:id/revoke', async (req: Request, res: Response) => {
    try {
      const token = await tokens.revoke(param(req, 'id'));
      res.json(toMcpTokenRow(token));
    } catch (err) {
      if (err instanceof McpTokenNotFoundError) {
        res.status(404).json({ error: 'token not found' });
        return;
      }
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
