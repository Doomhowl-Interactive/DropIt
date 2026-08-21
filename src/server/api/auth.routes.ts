import { Router } from 'express';
import { config } from '../config';
import { authMiddleware, requireRole, type AuthDeps } from '../middleware/auth';
import { InvalidPasswordError, type AuthService } from '../auth/service';
import { parseBody } from '../util';
import {
  AdminCheckResponseSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  MeResponseSchema,
} from '../../shared/types';
import {
  ChangePasswordRequestSchema,
  ChangePasswordResponseSchema,
} from '../../shared/change-password.types';

export function authRoutes(auth: AuthService, authDeps: AuthDeps = {}): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    const body = parseBody(res, LoginRequestSchema, req.body);
    if (!body) return;
    const { username, password } = body;

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

    res.json(LoginResponseSchema.parse({ token }));
  });

  const protectedRoutes = Router();
  protectedRoutes.use(authMiddleware(authDeps));

  protectedRoutes.get('/me', (req, res) => {
    res.json(MeResponseSchema.parse({ user_id: req.auth?.userId, role: req.auth?.role }));
  });

  protectedRoutes.get('/admin-check', requireRole('admin'), (_req, res) => {
    res.json(AdminCheckResponseSchema.parse({ message: 'you are an admin' }));
  });

  protectedRoutes.post('/change-password', async (req, res) => {
    const body = parseBody(res, ChangePasswordRequestSchema, req.body);
    if (!body) return;
    const { newPassword } = body;

    try {
      await auth.changePassword(req.auth!.userId, newPassword);
    } catch (err) {
      if (err instanceof InvalidPasswordError) {
        res.status(400).json({ error: 'New password is invalid' });
        return;
      }
      throw err;
    }

    res.json(ChangePasswordResponseSchema.parse({ message: 'password changed' }));
  });

  router.use(protectedRoutes);
  return router;
}
