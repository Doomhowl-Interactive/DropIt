import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../testing/db';
import { createAdminUser } from './bootstrap';
import { checkPassword } from './security/password';
import { UserRepository } from './users/repository';
import { UserNotFoundError, UserService } from './users/service';

describe('createAdminUser', () => {
  const saved = process.env['ADMIN_PASSWORD'];
  let users: UserService;
  let log: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env['ADMIN_PASSWORD'];
    users = new UserService(new UserRepository(createTestDb()));
    log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (saved === undefined) delete process.env['ADMIN_PASSWORD'];
    else process.env['ADMIN_PASSWORD'] = saved;
  });

  it('creates an admin account when none exists', async () => {
    await createAdminUser(users);

    await expect(users.findByUsername('admin')).resolves.toMatchObject({
      username: 'admin',
      role: 'admin',
    });
  });

  it('uses ADMIN_PASSWORD when it is set, and does not print it', async () => {
    process.env['ADMIN_PASSWORD'] = 'FromEnv123';
    await createAdminUser(users);

    const admin = await users.findByUsername('admin');
    await expect(checkPassword('FromEnv123', admin.passwordHash)).resolves.toBe(true);
    expect(log).toHaveBeenCalledWith('Admin user created with password from ADMIN_PASSWORD');
    expect(log.mock.calls.flat().join(' ')).not.toContain('FromEnv123');
  });

  it('generates a 16-character random password and prints it once', async () => {
    await createAdminUser(users);

    const printed = log.mock.calls
      .map((args) => String(args[0]))
      .find((line) => line.startsWith('Admin user created with random password: '));

    expect(printed).toBeDefined();
    const password = printed!.replace('Admin user created with random password: ', '');
    expect(password).toHaveLength(16);
    expect(password).toMatch(/^[A-Za-z0-9_-]+$/);

    const admin = await users.findByUsername('admin');
    await expect(checkPassword(password, admin.passwordHash)).resolves.toBe(true);
  });

  it('generates a different password on each run', async () => {
    await createAdminUser(users);
    const other = new UserService(new UserRepository(createTestDb()));
    await createAdminUser(other);

    const printed = log.mock.calls
      .map((args) => String(args[0]))
      .filter((line) => line.startsWith('Admin user created with random password: '));

    expect(printed).toHaveLength(2);
    expect(printed[0]).not.toBe(printed[1]);
  });

  it('skips creation when the admin already exists', async () => {
    await users.createUser('admin', 'Existing1', 'admin');
    await createAdminUser(users);

    const admin = await users.findByUsername('admin');
    await expect(checkPassword('Existing1', admin.passwordHash)).resolves.toBe(true);
    expect(log).toHaveBeenCalledWith('Admin user already exists, skipping creation');
  });

  it('bails out without creating anything when the lookup fails unexpectedly', async () => {
    const createUser = vi.fn();
    const broken = {
      findByUsername: () => Promise.reject(new Error('database is locked')),
      createUser,
    } as unknown as UserService;

    await expect(createAdminUser(broken)).resolves.toBeUndefined();

    expect(createUser).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('Error checking for admin user:', expect.any(Error));
  });

  it('logs rather than throws when creation fails', async () => {
    const broken = {
      findByUsername: () => Promise.reject(new UserNotFoundError()),
      createUser: () => Promise.reject(new Error('disk full')),
    } as unknown as UserService;

    await expect(createAdminUser(broken)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('Error creating admin user:', expect.any(Error));
  });
});
