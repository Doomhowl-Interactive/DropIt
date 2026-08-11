import { Router } from 'express';
import { config } from '../config';
import { authMiddleware, requireRole, type AuthDeps } from '../middleware/auth';
import type { AuthService } from '../auth/service';

export function authRoutes(auth: AuthService, authDeps: AuthDeps = {}): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    let token: string;
    try {
      token = await auth.login(username, password);
    } catch (ex) {
      console.warn(ex);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    res.cookie('auth_token', token, {
      path: '/',
      domain: config.domain || undefined,
      maxAge: 3600 * 24 * 1000,
      secure: config.useHttps,
      httpOnly: true,
      sameSite: 'strict',
    });

    res.json({ token });
  });

  const protectedRoutes = Router();
  protectedRoutes.use(authMiddleware(authDeps));

  protectedRoutes.get('/me', (req, res) => {
    res.json({ user_id: req.auth?.userId, role: req.auth?.role });
  });

  protectedRoutes.get('/admin-check', requireRole('admin'), (_req, res) => {
    res.json({ message: 'you are an admin' });
  });

  router.use(protectedRoutes);
  return router;
}
