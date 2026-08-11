import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../testing/db';
import type { Db } from '../db/db';
import { users } from '../db/schema';
import { UserNotFoundError, UserRepository } from './repository';

describe('UserRepository', () => {
  let db: Db;
  let repo: UserRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new UserRepository(db);
  });

  const seed = () => repo.create({ username: 'admin', passwordHash: 'hash', role: 'admin' });

  describe('create', () => {
    it('inserts the user and returns it with an assigned id', async () => {
      const user = await seed();

      expect(user.id).toBeGreaterThan(0);
      expect(user.username).toBe('admin');
      expect(user.passwordHash).toBe('hash');
      expect(user.role).toBe('admin');
    });

    it('stamps createdAt and updatedAt', async () => {
      const user = await seed();

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.createdAt!.getTime()).toBeCloseTo(Date.now(), -4);
    });

    it('rejects a duplicate username', async () => {
      await seed();
      await expect(seed()).rejects.toThrow();
    });
  });

  describe('findByUsername', () => {
    it('finds an existing user', async () => {
      const created = await seed();
      await expect(repo.findByUsername('admin')).resolves.toMatchObject({ id: created.id });
    });

    it('throws UserNotFoundError when there is no such user', async () => {
      await expect(repo.findByUsername('nobody')).rejects.toThrow(UserNotFoundError);
    });

    it('ignores soft-deleted users', async () => {
      const created = await seed();
      await repo.delete(created.id);

      await expect(repo.findByUsername('admin')).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('findById', () => {
    it('accepts a numeric id', async () => {
      const created = await seed();
      await expect(repo.findById(created.id)).resolves.toMatchObject({ username: 'admin' });
    });

    it('accepts a string id', async () => {
      const created = await seed();
      await expect(repo.findById(String(created.id))).resolves.toMatchObject({ username: 'admin' });
    });

    it('throws for an unknown id', async () => {
      await expect(repo.findById(999)).rejects.toThrow(UserNotFoundError);
    });

    it('ignores soft-deleted users', async () => {
      const created = await seed();
      await repo.delete(created.id);

      await expect(repo.findById(created.id)).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('update', () => {
    it('persists the changed fields', async () => {
      const user = await seed();

      user.username = 'root';
      user.passwordHash = 'new-hash';
      user.role = 'user';
      await repo.update(user);

      await expect(repo.findByUsername('root')).resolves.toMatchObject({
        id: user.id,
        passwordHash: 'new-hash',
        role: 'user',
      });
    });

    it('moves updatedAt forward without touching createdAt', async () => {
      const user = await seed();
      const [before] = await db.select().from(users).where(eq(users.id, user.id));

      await new Promise((done) => setTimeout(done, 5));
      await repo.update(user);

      const [after] = await db.select().from(users).where(eq(users.id, user.id));
      expect(after!.createdAt).toBe(before!.createdAt);
      expect(after!.updatedAt! > before!.updatedAt!).toBe(true);
    });
  });

  describe('getAll', () => {
    it('returns an empty list when there are no users', async () => {
      await expect(repo.getAll()).resolves.toEqual([]);
    });

    it('returns every live user', async () => {
      await seed();
      await repo.create({ username: 'bram', passwordHash: 'h', role: 'user' });

      const all = await repo.getAll();
      expect(all.map((user) => user.username).sort()).toEqual(['admin', 'bram']);
    });

    it('omits soft-deleted users', async () => {
      const admin = await seed();
      await repo.create({ username: 'bram', passwordHash: 'h', role: 'user' });
      await repo.delete(admin.id);

      await expect(repo.getAll()).resolves.toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('soft-deletes by stamping deletedAt, keeping the row', async () => {
      const user = await seed();
      await repo.delete(user.id);

      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      expect(row).toBeDefined();
      expect(row!.deletedAt).toBeTruthy();
    });

    it('is a no-op for an unknown id', async () => {
      await expect(repo.delete(999)).resolves.toBeUndefined();
    });
  });

  it('maps a legacy GORM-formatted timestamp back to a Date', async () => {
    await db.insert(users).values({
      username: 'legacy',
      passwordHash: 'h',
      role: 'user',
      createdAt: '2026-08-11 00:39:09.044218258+02:00',
      updatedAt: null,
    });

    const user = await repo.findByUsername('legacy');
    expect(user.createdAt?.toISOString()).toBe('2026-08-10T22:39:09.044Z');
    expect(user.updatedAt).toBeNull();
  });
});
