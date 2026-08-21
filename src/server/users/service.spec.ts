import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../testing/db';
import { checkPassword } from '../security/password';
import { UserRepository } from './repository';
import {
  CannotDeleteSelfError,
  InvalidPasswordError,
  UserNotFoundError,
  UserService,
} from './service';

describe('UserService', () => {
  let repo: UserRepository;
  let service: UserService;

  beforeEach(async () => {
    repo = new UserRepository(await createTestDb());
    service = new UserService(repo);
  });

  describe('createUser', () => {
    it('stores a bcrypt hash rather than the password', async () => {
      const user = await service.createUser('admin', 'Hunter2!x', 'admin');

      expect(user.passwordHash).not.toBe('Hunter2!x');
      await expect(checkPassword('Hunter2!x', user.passwordHash)).resolves.toBe(true);
    });

    it('keeps the username and role', async () => {
      const user = await service.createUser('bram', 'Hunter2!x', 'user');
      expect(user).toMatchObject({ username: 'bram', role: 'user' });
    });
  });

  describe('updateUser', () => {
    it('persists the change and echoes the user back', async () => {
      const user = await service.createUser('bram', 'Hunter2!x', 'user');
      user.role = 'admin';

      await expect(service.updateUser(user)).resolves.toBe(user);
      await expect(repo.findByUsername('bram')).resolves.toMatchObject({ role: 'admin' });
    });
  });

  describe('changePassword', () => {
    const CURRENT = 'OldPass1';
    let userId: number;

    beforeEach(async () => {
      userId = (await service.createUser('bram', CURRENT, 'user')).id;
    });

    it('replaces the hash with the new password', async () => {
      await service.changePassword(userId, 'NewPass1');

      const user = await repo.findById(userId);
      await expect(checkPassword('NewPass1', user.passwordHash)).resolves.toBe(true);
      await expect(checkPassword(CURRENT, user.passwordHash)).resolves.toBe(false);
    });

    it('accepts a string user id', async () => {
      await expect(service.changePassword(String(userId), 'NewPass1')).resolves.toBeUndefined();
    });

    it('throws for an unknown user', async () => {
      await expect(service.changePassword(999, 'NewPass1')).rejects.toThrow(UserNotFoundError);
    });

    it('rejects a new password identical to the current one', async () => {
      await expect(service.changePassword(userId, CURRENT)).rejects.toThrow(InvalidPasswordError);
    });

    it('rejects a new password shorter than six characters', async () => {
      await expect(service.changePassword(userId, 'Ab1cd')).rejects.toThrow(
        InvalidPasswordError,
      );
    });

    it('rejects a new password with no uppercase letter', async () => {
      await expect(service.changePassword(userId, 'newpass1')).rejects.toThrow(
        InvalidPasswordError,
      );
    });

    it('rejects a new password with no lowercase letter', async () => {
      await expect(service.changePassword(userId, 'NEWPASS1')).rejects.toThrow(
        InvalidPasswordError,
      );
    });

    it('rejects a new password with no digit', async () => {
      await expect(service.changePassword(userId, 'NewPassword')).rejects.toThrow(
        InvalidPasswordError,
      );
    });

    it('accepts a password of exactly six valid characters', async () => {
      await expect(service.changePassword(userId, 'Abc123')).resolves.toBeUndefined();
    });
  });

  describe('deleteUser', () => {
    it('soft-deletes another user', async () => {
      const admin = await service.createUser('admin', 'Hunter2!x', 'admin');
      const target = await service.createUser('bram', 'Hunter2!x', 'user');

      await expect(service.deleteUser(admin.id, target.id)).resolves.toBeUndefined();

      await expect(repo.findById(target.id)).rejects.toThrow(UserNotFoundError);
      await expect(repo.findById(admin.id)).resolves.toMatchObject({ username: 'admin' });
    });

    it('refuses to delete the requester', async () => {
      await expect(service.deleteUser(5, 5)).rejects.toThrow(CannotDeleteSelfError);
    });
  });

  describe('read-through accessors', () => {
    it('finds by username and by id', async () => {
      const user = await service.createUser('bram', 'Hunter2!x', 'user');

      await expect(service.findByUsername('bram')).resolves.toMatchObject({ id: user.id });
      await expect(service.findById(user.id)).resolves.toMatchObject({ username: 'bram' });
    });

    it('propagates UserNotFoundError', async () => {
      await expect(service.findByUsername('nobody')).rejects.toThrow(UserNotFoundError);
      await expect(service.findById(999)).rejects.toThrow(UserNotFoundError);
    });

    it('lists all users', async () => {
      await service.createUser('admin', 'Hunter2!x', 'admin');
      await service.createUser('bram', 'Hunter2!x', 'user');

      await expect(service.getAllUsers()).resolves.toHaveLength(2);
    });
  });
});
