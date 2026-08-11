import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../testing/db';
import type { Db } from '../db/db';
import { fileRecords } from '../db/schema';
import { FileNotFoundError, FileRepository, type FileRecord } from './repository';

function makeRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: 'file-1',
    deletionId: 'del-1',
    viewId: 'view-1',
    filename: 'report.pdf',
    path: 'uploads/file-1/report.pdf',
    size: 2048,
    downloadCount: 0,
    deleted: false,
    createdAt: new Date('2026-08-11T10:00:00.000Z'),
    expiresAt: null,
    deleteAfterDownload: false,
    ...overrides,
  };
}

describe('FileRepository', () => {
  let db: Db;
  let repo: FileRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new FileRepository(db);
  });

  describe('create / getById', () => {
    it('round-trips every field', async () => {
      const record = makeRecord({
        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
        deleteAfterDownload: true,
        downloadCount: 3,
      });
      await repo.create(record);

      await expect(repo.getById('file-1')).resolves.toEqual(record);
    });

    it('stores a null expiry as null', async () => {
      await repo.create(makeRecord());
      await expect(repo.getById('file-1')).resolves.toMatchObject({ expiresAt: null });
    });

    it('throws FileNotFoundError for an unknown id', async () => {
      await expect(repo.getById('nope')).rejects.toThrow(FileNotFoundError);
    });

    it('rejects a duplicate id', async () => {
      await repo.create(makeRecord());
      await expect(repo.create(makeRecord())).rejects.toThrow();
    });
  });

  describe('lookup by secondary keys', () => {
    beforeEach(() => repo.create(makeRecord()));

    it('finds by deletion id', async () => {
      await expect(repo.getByDeletionId('del-1')).resolves.toMatchObject({ id: 'file-1' });
    });

    it('finds by view id', async () => {
      await expect(repo.getByViewId('view-1')).resolves.toMatchObject({ id: 'file-1' });
    });

    it('throws for an unknown deletion id', async () => {
      await expect(repo.getByDeletionId('nope')).rejects.toThrow(FileNotFoundError);
    });

    it('throws for an unknown view id', async () => {
      await expect(repo.getByViewId('nope')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('getAll', () => {
    it('is empty to begin with', async () => {
      await expect(repo.getAll()).resolves.toEqual([]);
    });

    it('returns every record, deleted ones included', async () => {
      await repo.create(makeRecord());
      await repo.create(makeRecord({ id: 'file-2', deletionId: 'd2', viewId: 'v2', deleted: true }));

      await expect(repo.getAll()).resolves.toHaveLength(2);
    });
  });

  describe('getPaginated', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await repo.create(
          makeRecord({
            id: `file-${i}`,
            deletionId: `del-${i}`,
            viewId: `view-${i}`,
            createdAt: new Date(Date.UTC(2026, 7, 11, 10, i)),
          }),
        );
      }
    });

    it('reports the unpaginated total alongside the page', async () => {
      const { files, total } = await repo.getPaginated(2, 0);
      expect(total).toBe(5);
      expect(files).toHaveLength(2);
    });

    it('orders newest first', async () => {
      const { files } = await repo.getPaginated(5, 0);
      expect(files.map((file) => file.id)).toEqual([
        'file-4',
        'file-3',
        'file-2',
        'file-1',
        'file-0',
      ]);
    });

    it('applies the offset', async () => {
      const { files } = await repo.getPaginated(2, 2);
      expect(files.map((file) => file.id)).toEqual(['file-2', 'file-1']);
    });

    it('returns an empty page past the end', async () => {
      const { files, total } = await repo.getPaginated(10, 50);
      expect(files).toEqual([]);
      expect(total).toBe(5);
    });
  });

  describe('incrementDownload', () => {
    it('bumps the counter in the database and on the record', async () => {
      const record = makeRecord();
      await repo.create(record);

      await repo.incrementDownload(record);

      expect(record.downloadCount).toBe(1);
      await expect(repo.getById('file-1')).resolves.toMatchObject({ downloadCount: 1 });
    });

    it('accumulates across calls', async () => {
      const record = makeRecord();
      await repo.create(record);

      await repo.incrementDownload(record);
      await repo.incrementDownload(record);

      await expect(repo.getById('file-1')).resolves.toMatchObject({ downloadCount: 2 });
    });
  });

  describe('markDeleted', () => {
    it('sets the flag but keeps the row', async () => {
      const record = makeRecord();
      await repo.create(record);

      await repo.markDeleted(record);

      expect(record.deleted).toBe(true);
      await expect(repo.getById('file-1')).resolves.toMatchObject({ deleted: true });
    });
  });

  describe('delete', () => {
    it('removes the row entirely', async () => {
      const record = makeRecord();
      await repo.create(record);

      await repo.delete(record);

      await expect(repo.getById('file-1')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('row mapping', () => {
    it('substitutes defaults for the nullable legacy columns', async () => {
      await db.insert(fileRecords).values({ id: 'legacy' });

      await expect(repo.getById('legacy')).resolves.toEqual({
        id: 'legacy',
        deletionId: '',
        viewId: '',
        filename: '',
        path: '',
        size: 0,
        downloadCount: 0,
        deleted: false,
        createdAt: new Date(0),
        expiresAt: null,
        deleteAfterDownload: false,
      });
    });

    it('parses a GORM-formatted createdAt', async () => {
      await db
        .insert(fileRecords)
        .values({ id: 'legacy', createdAt: '2026-08-11 00:39:09.044218258+02:00' });

      const record = await repo.getById('legacy');
      expect(record.createdAt.toISOString()).toBe('2026-08-10T22:39:09.044Z');
    });

    it('falls back to the epoch for an unparseable createdAt', async () => {
      await db.insert(fileRecords).values({ id: 'legacy', createdAt: 'garbage' });

      const record = await repo.getById('legacy');
      expect(record.createdAt).toEqual(new Date(0));
    });

    it('keeps the deleteAfterDownload column default when it is absent', async () => {
      await db.run(`INSERT INTO file_records (id) VALUES ('defaulted')`);

      const [row] = await db.select().from(fileRecords).where(eq(fileRecords.id, 'defaulted'));
      expect(row!.deleteAfterDownload).toBe(false);
    });
  });
});
