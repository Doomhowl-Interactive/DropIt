import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface Claims {
  user_id?: string;
  username?: string;
  role?: string;
}

/** HS256, 24h lifetime — same shape the Go server issued. */
export function generateJwt(userId: string, username: string, role: string): string {
  return jwt.sign({ user_id: userId, username, role }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '24h',
    notBefore: 0,
  });
}

export function verifyJwt(token: string): Claims | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return typeof decoded === 'string' ? null : (decoded as Claims);
  } catch {
    return null;
  }
}
