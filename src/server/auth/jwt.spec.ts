import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateJwt, verifyJwt } from './jwt';

const SECRET = 'test-secret';

describe('jwt', () => {
  const saved = process.env['JWT_SECRET'];

  beforeEach(() => {
    process.env['JWT_SECRET'] = SECRET;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env['JWT_SECRET'];
    else process.env['JWT_SECRET'] = saved;
  });

  it('issues an HS256 token carrying the claims', () => {
    const token = generateJwt('7', 'admin', 'admin');
    const [header] = token.split('.');

    expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toMatchObject({
      alg: 'HS256',
      typ: 'JWT',
    });
    expect(verifyJwt(token)).toMatchObject({ user_id: '7', username: 'admin', role: 'admin' });
  });

  it('sets a 24 hour lifetime', () => {
    const claims = verifyJwt(generateJwt('7', 'admin', 'admin')) as unknown as {
      iat: number;
      exp: number;
    };
    expect(claims.exp - claims.iat).toBe(24 * 60 * 60);
  });

  it('rejects a token signed with a different secret', () => {
    const foreign = jwt.sign({ user_id: '7' }, 'other-secret', { algorithm: 'HS256' });
    expect(verifyJwt(foreign)).toBeNull();
  });

  it('rejects a malformed token', () => {
    expect(verifyJwt('')).toBeNull();
    expect(verifyJwt('not.a.token')).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ user_id: '7' }, SECRET, { algorithm: 'HS256', expiresIn: '-1h' });
    expect(verifyJwt(expired)).toBeNull();
  });

  it('rejects an unsigned "alg: none" token', () => {
    const unsigned = jwt.sign({ user_id: '7' }, '', { algorithm: 'none' });
    expect(verifyJwt(unsigned)).toBeNull();
  });

  it('returns null when the payload is a bare string rather than claims', () => {
    const stringPayload = jwt.sign('plain', SECRET, { algorithm: 'HS256' });
    expect(verifyJwt(stringPayload)).toBeNull();
  });

  it('does not verify against a rotated secret', () => {
    const token = generateJwt('7', 'admin', 'admin');
    process.env['JWT_SECRET'] = 'rotated';
    expect(verifyJwt(token)).toBeNull();
  });
});
