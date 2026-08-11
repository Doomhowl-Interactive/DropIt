import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../testing/db';
import { UserRepository } from '../users/repository';
import { UserService } from '../users/service';
import { verifyJwt } from './jwt';
import { AuthService, InvalidCredentialsError } from './service';

describe('AuthService', () => {
  const saved = process.env['JWT_SECRET'];
  let users: UserService;
  let auth: AuthService;

  beforeEach(async () => {
    process.env['JWT_SECRET'] = 'test-secret';
    users = new UserService(new UserRepository(await createTestDb()));
    auth = new AuthService(users);
    await users.createUser('admin', 'Hunter2!x', 'admin');
  });

  afterEach(() => {
    if (saved === undefined) delete process.env['JWT_SECRET'];
    else process.env['JWT_SECRET'] = saved;
  });

  it('issues a token carrying the user id, name and role', async () => {
    const token = await auth.login('admin', 'Hunter2!x');
    const user = await users.findByUsername('admin');

    expect(verifyJwt(token)).toMatchObject({
      user_id: String(user.id),
      username: 'admin',
      role: 'admin',
    });
  });

  it('rejects a wrong password', async () => {
    await expect(auth.login('admin', 'wrong')).rejects.toThrow(InvalidCredentialsError);
  });

  it('reports an unknown user the same way as a wrong password', async () => {
    const unknown = await auth.login('nobody', 'Hunter2!x').catch((err) => err);
    const wrong = await auth.login('admin', 'wrong').catch((err) => err);

    expect(unknown).toBeInstanceOf(InvalidCredentialsError);
    expect(unknown.message).toBe(wrong.message);
  });

  it('rejects an empty password', async () => {
    await expect(auth.login('admin', '')).rejects.toThrow(InvalidCredentialsError);
  });

  it('does not log in a soft-deleted user', async () => {
    const user = await users.findByUsername('admin');
    await users.deleteUser(0, user.id);

    await expect(auth.login('admin', 'Hunter2!x')).rejects.toThrow(InvalidCredentialsError);
  });

  it('propagates a lookup failure that is not "user not found"', async () => {
    const broken = {
      findByUsername: () => Promise.reject(new Error('database is locked')),
    } as unknown as UserService;

    await expect(new AuthService(broken).login('admin', 'Hunter2!x')).rejects.toThrow(
      'database is locked',
    );
  });
});
