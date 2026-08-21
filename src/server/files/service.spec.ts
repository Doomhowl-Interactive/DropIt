import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../testing/db';
import { FileNotFoundError, FileRepository } from './repository';
import { FileService, type ImportFileRecord } from './service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('FileService', () => {
  let storageDir: string;
  let repo: FileRepository;
  let service: FileService;

  beforeEach(async () => {
    storageDir = join(mkdtempSync(join(tmpdir(), 'dropit-svc-')), 'uploads');
    repo = new FileRepository(await createTestDb());
    service = new FileService(repo, storageDir);
  });

  afterEach(() => {
    rmSync(storageDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  const register = (overrides: Record<string, unknown> = {}) => {
    const { folderId, folderPath } = service.createUploadFolder();
    const path = join(folderPath, folderId);
    writeFileSync(path, 'contents');

    return service.registerUpload({
      folderId,
      originalName: 'report.pdf',
      path,
      size: 8,
      ...overrides,
    });
  };

  it('creates the storage root on construction', () => {
    expect(existsSync(storageDir)).toBe(true);
  });

  describe('createUploadFolder', () => {
    it('returns the storage root and a unique upload id', () => {
      const { folderId, folderPath } = service.createUploadFolder();

      expect(folderId).toMatch(UUID);
      expect(folderPath).toBe(storageDir);
      expect(existsSync(folderPath)).toBe(true);
    });

    it('never hands out the same upload id twice', () => {
      const a = service.createUploadFolder();
      const b = service.createUploadFolder();
      expect(a.folderId).not.toBe(b.folderId);
    });
  });

  describe('registerUpload', () => {
    it('stores the record with fresh deletion and view keys', async () => {
      const record = await register();

      expect(record.deletionId).toMatch(UUID);
      expect(record.viewId).toMatch(UUID);
      expect(record.deletionId).not.toBe(record.viewId);
      await expect(repo.getById(record.id)).resolves.toMatchObject({ filename: 'report.pdf' });
    });

    it('starts at zero downloads, undeleted and never-expiring', async () => {
      const record = await register();

      expect(record.downloadCount).toBe(0);
      expect(record.deleted).toBe(false);
      expect(record.expiresAt).toBeNull();
      expect(record.deleteAfterDownload).toBe(false);
    });

    it('keeps an explicit expiry and burn-after-reading flag', async () => {
      const expiresAt = new Date('2026-09-01T00:00:00.000Z');
      const record = await register({ expiresAt, deleteAfterDownload: true });

      expect(record.expiresAt).toEqual(expiresAt);
      await expect(repo.getById(record.id)).resolves.toMatchObject({
        expiresAt,
        deleteAfterDownload: true,
      });
    });
  });

  describe('downloadFile', () => {
    it('returns the record and books the hit', async () => {
      const { id } = await register();

      await expect(service.downloadFile(id)).resolves.toMatchObject({ id });
      await expect(repo.getById(id)).resolves.toMatchObject({ downloadCount: 1 });
    });

    it('throws for an unknown id', async () => {
      await expect(service.downloadFile('nope')).rejects.toThrow(FileNotFoundError);
    });

    it('throws for a soft-deleted file without counting the attempt', async () => {
      const { id } = await register();
      await service.deleteFileById(id);

      await expect(service.downloadFile(id)).rejects.toThrow(FileNotFoundError);
      await expect(repo.getById(id)).resolves.toMatchObject({ downloadCount: 0 });
    });

    it('throws once the expiry has passed', async () => {
      const { id } = await register({ expiresAt: new Date(Date.now() - 1000) });
      await expect(service.downloadFile(id)).rejects.toThrow(FileNotFoundError);
    });

    it('treats an expiry exactly at now as expired', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-11T12:00:00.000Z'));

      const { id } = await register({ expiresAt: new Date('2026-08-11T12:00:00.000Z') });
      await expect(service.downloadFile(id)).rejects.toThrow(FileNotFoundError);
    });

    it('still serves a file whose expiry is in the future', async () => {
      const { id } = await register({ expiresAt: new Date(Date.now() + 60_000) });
      await expect(service.downloadFile(id)).resolves.toMatchObject({ id });
    });

    it('soft-deletes a burn-after-reading file once served', async () => {
      const { id } = await register({ deleteAfterDownload: true });

      await expect(service.downloadFile(id)).resolves.toMatchObject({ id });
      await expect(repo.getById(id)).resolves.toMatchObject({ deleted: true, downloadCount: 1 });
      await expect(service.downloadFile(id)).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('deleteFileById', () => {
    it('soft-deletes and returns the record', async () => {
      const { id } = await register();

      await expect(service.deleteFileById(id)).resolves.toMatchObject({ id, deleted: true });
      await expect(repo.getById(id)).resolves.toMatchObject({ deleted: true });
    });

    it('throws for an unknown id', async () => {
      await expect(service.deleteFileById('nope')).rejects.toThrow(FileNotFoundError);
    });

    it('throws when the file is already deleted', async () => {
      const { id } = await register();
      await service.deleteFileById(id);

      await expect(service.deleteFileById(id)).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('deleteFileByDeletionId', () => {
    it('soft-deletes via the private deletion key', async () => {
      const { id, deletionId } = await register();

      await expect(service.deleteFileByDeletionId(deletionId)).resolves.toMatchObject({ id });
      await expect(repo.getById(id)).resolves.toMatchObject({ deleted: true });
    });

    it('throws for an unknown deletion key', async () => {
      await expect(service.deleteFileByDeletionId('nope')).rejects.toThrow(FileNotFoundError);
    });

    it('throws when the file is already deleted', async () => {
      const { deletionId } = await register();
      await service.deleteFileByDeletionId(deletionId);

      await expect(service.deleteFileByDeletionId(deletionId)).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('forceDelete', () => {
    it('removes the file from disk and the row from the database', async () => {
      const { id } = await register();
      const record = await repo.getById(id);
      expect(existsSync(record.path)).toBe(true);

      await expect(service.forceDelete(id)).resolves.toMatchObject({ id });

      expect(existsSync(record.path)).toBe(false);
      await expect(repo.getById(id)).rejects.toThrow(FileNotFoundError);
    });

    it('works on an already soft-deleted file', async () => {
      const { id } = await register();
      await service.deleteFileById(id);

      await expect(service.forceDelete(id)).resolves.toMatchObject({ id });
      await expect(repo.getById(id)).rejects.toThrow(FileNotFoundError);
    });

    it('throws for an unknown id', async () => {
      await expect(service.forceDelete('nope')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('read-through accessors', () => {
    it('exposes lookups by id, deletion id and view id', async () => {
      const record = await register();

      await expect(service.getFileById(record.id)).resolves.toMatchObject({ id: record.id });
      await expect(service.getFileByDeletionId(record.deletionId)).resolves.toMatchObject({
        id: record.id,
      });
      await expect(service.getFileByViewId(record.viewId)).resolves.toMatchObject({
        id: record.id,
      });
    });

    it('lists all files', async () => {
      await register();
      await register();
      await expect(service.getAllFiles()).resolves.toHaveLength(2);
    });

    it('paginates', async () => {
      await register();
      await register();

      const { files, total } = await service.getPaginatedFiles(1, 0);
      expect(files).toHaveLength(1);
      expect(total).toBe(2);
    });
  });

  describe('importFiles', () => {
    const incoming = (overrides: Partial<ImportFileRecord> = {}): ImportFileRecord => ({
      id: 'imported-1',
      deletion_id: 'del-imported-1',
      filename: 'legacy.bin',
      size: 1234,
      download_count: 7,
      deleted: false,
      created_at: '2026-01-02T03:04:05.000Z',
      ...overrides,
    });

    it('inserts a record, minting a new view key and rebuilding the path', async () => {
      await service.importFiles([incoming()]);

      const record = await repo.getById('imported-1');
      expect(record).toMatchObject({
        deletionId: 'del-imported-1',
        filename: 'legacy.bin',
        size: 1234,
        downloadCount: 7,
        deleted: false,
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
      });
      expect(record.viewId).toMatch(UUID);
      expect(record.path).toBe(join(storageDir, 'legacy.bin'));
    });

    it('carries over the expiry and the burn-after-reading flag', async () => {
      await service.importFiles([
        incoming({ expires_at: '2026-12-31T00:00:00.000Z', delete_after_download: true }),
      ]);

      await expect(repo.getById('imported-1')).resolves.toMatchObject({
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        deleteAfterDownload: true,
      });
    });

    it('leaves an existing record untouched', async () => {
      await service.importFiles([incoming()]);
      await service.importFiles([incoming({ filename: 'overwritten.bin', size: 999 })]);

      await expect(repo.getById('imported-1')).resolves.toMatchObject({
        filename: 'legacy.bin',
        size: 1234,
      });
    });

    it('imports several records at once', async () => {
      await service.importFiles([incoming(), incoming({ id: 'imported-2', deletion_id: 'd2' })]);
      await expect(repo.getAll()).resolves.toHaveLength(2);
    });

    it('accepts an empty list', async () => {
      await expect(service.importFiles([])).resolves.toBeUndefined();
      await expect(repo.getAll()).resolves.toEqual([]);
    });

    it('defaults the missing numeric and date fields', async () => {
      const bare = {
        id: 'bare',
        deletion_id: 'd',
        filename: 'x',
      } as unknown as ImportFileRecord;
      await service.importFiles([bare]);

      const record = await repo.getById('bare');
      expect(record.size).toBe(0);
      expect(record.downloadCount).toBe(0);
      expect(record.deleted).toBe(false);
      expect(record.createdAt.getTime()).toBeCloseTo(Date.now(), -4);
    });
  });

  it('reuses an existing storage directory rather than failing', () => {
    mkdirSync(storageDir, { recursive: true });
    expect(() => new FileService(repo, storageDir)).not.toThrow();
  });

  describe('addOrphans', () => {
    const dropOrphan = (filename = 'orphan-1', contents = 'stray bytes') => {
      writeFileSync(join(storageDir, filename), contents);
    };

    it('registers a loose file that has no database row', async () => {
      dropOrphan();

      await expect(service.addOrphans()).resolves.toBe(1);

      const record = await repo.getById('orphan-1');
      expect(record).toMatchObject({
        filename: 'orphan-1',
        path: join(storageDir, 'orphan-1'),
        size: 'stray bytes'.length,
        downloadCount: 0,
        deleted: false,
        expiresAt: null,
        deleteAfterDownload: false,
      });
      expect(record.deletionId).toMatch(UUID);
      expect(record.viewId).toMatch(UUID);
    });

    it('registers several orphans and reports the count', async () => {
      dropOrphan('orphan-1');
      dropOrphan('other.bin');

      await expect(service.addOrphans()).resolves.toBe(2);
      await expect(repo.getAll()).resolves.toHaveLength(2);
    });

    it('takes the file modification time as the creation date', async () => {
      dropOrphan();
      const when = new Date('2026-07-01T12:00:00.000Z');
      utimesSync(join(storageDir, 'orphan-1'), when, when);

      await service.addOrphans();

      await expect(repo.getById('orphan-1')).resolves.toMatchObject({ createdAt: when });
    });

    it('skips files that already have a record', async () => {
      const { id } = await register();
      dropOrphan(id);

      await expect(service.addOrphans()).resolves.toBe(0);
    });

    it('leaves registered files alone while importing others', async () => {
      await register();
      dropOrphan('orphan-1');

      await expect(service.addOrphans()).resolves.toBe(1);
      await expect(repo.getAll()).resolves.toHaveLength(2);
    });

    it('registers loose files directly under the storage root', async () => {
      dropOrphan('loose.txt');

      await expect(service.addOrphans()).resolves.toBe(1);
      await expect(repo.getById('loose.txt')).resolves.toMatchObject({
        path: join(storageDir, 'loose.txt'),
      });
    });

    it('ignores empty directories', async () => {
      mkdirSync(join(storageDir, 'empty'), { recursive: true });

      await expect(service.addOrphans()).resolves.toBe(0);
    });

    it('is idempotent — a second run adds nothing', async () => {
      dropOrphan();

      await expect(service.addOrphans()).resolves.toBe(1);
      await expect(service.addOrphans()).resolves.toBe(0);
    });
  });
});
