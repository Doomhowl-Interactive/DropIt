import bcrypt from 'bcryptjs';

/** Cost 10 matches bcrypt.DefaultCost used by the previous Go implementation. */
const COST = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function checkPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash).catch(() => false);
}
