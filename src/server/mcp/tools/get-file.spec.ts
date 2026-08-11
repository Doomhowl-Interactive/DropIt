import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileRepository } from '../../files/repository';
import { FileService, type FileRecord } from '../../files/service';
import { testDb, testStorageDir } from '../../testing/db';
import { callTool, testContext, textOf } from '../../testing/mcp';
import type { McpToolContext } from '../types';
import { getFileTool } from './get-file';
import { uploadFileTool } from './upload-file';

describe('get_file', () => {
  let storage: ReturnType<typeof testStorageDir>;
  let files: FileService;
  let ctx: McpToolContext;

  beforeEach(() => {
    storage = testStorageDir();
    files = new FileService(new FileRepository(testDb()), storage.path);
    ctx = testContext(files);
  });

  afterEach(() => storage.cleanup());

  const upload = async (args: Record<string, unknown>): Promise<FileRecord> => {
    const result = await callTool(uploadFileTool, args, ctx);
    const id = String((result.structuredContent as Record<string, unknown>)['id']);
    return files.getFileById(id);
  };

  it('returns text files inline', async () => {
    const record = await upload({ filename: 'note.txt', content: 'hello', encoding: 'utf8' });

    const result = await callTool(getFileTool, { id: record.id }, ctx);

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe('hello');
  });

  it('returns binary files as a base64 resource', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    const record = await upload({ filename: 'logo.png', content: bytes.toString('base64') });

    const result = await callTool(getFileTool, { id: record.id }, ctx);
    const block = result.content[0] as { type: string; resource: Record<string, unknown> };

    expect(block.type).toBe('resource');
    expect(block.resource['mimeType']).toBe('image/png');
    expect(Buffer.from(String(block.resource['blob']), 'base64')).toEqual(bytes);
  });

  it('resolves a share-link view id as well as a download id', async () => {
    const record = await upload({ filename: 'note.txt', content: 'hello', encoding: 'utf8' });

    const result = await callTool(getFileTool, { id: record.viewId }, ctx);
    expect(textOf(result)).toBe('hello');
  });

  // The whole reason this tool does not route through FileService.downloadFile.
  it('does not count as a download', async () => {
    const record = await upload({ filename: 'note.txt', content: 'hello', encoding: 'utf8' });

    await callTool(getFileTool, { id: record.id }, ctx);
    await callTool(getFileTool, { id: record.id }, ctx);

    expect((await files.getFileById(record.id)).downloadCount).toBe(0);
  });

  it('does not consume a delete-after-download file', async () => {
    const record = await upload({
      filename: 'once.txt',
      content: 'hello',
      encoding: 'utf8',
      delete_after_download: true,
    });

    await callTool(getFileTool, { id: record.id }, ctx);

    expect((await files.getFileById(record.id)).deleted).toBe(false);
    expect(textOf(await callTool(getFileTool, { id: record.id }, ctx))).toBe('hello');
  });

  it('refuses deleted, expired and unknown ids', async () => {
    const deleted = await upload({ filename: 'gone.txt', content: 'x', encoding: 'utf8' });
    await files.deleteFileById(deleted.id);
    expect((await callTool(getFileTool, { id: deleted.id }, ctx)).isError).toBe(true);

    // Registered directly so the expiry is already in the past — the tool only
    // takes a positive `expires_in_seconds`, and waiting one out is not a test.
    const { folderId, folderPath } = files.createUploadFolder();
    const expired = await files.registerUpload({
      folderId,
      originalName: 'stale.txt',
      path: `${folderPath}/stale.txt`,
      size: 1,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect((await callTool(getFileTool, { id: expired.id }, ctx)).isError).toBe(true);

    expect((await callTool(getFileTool, { id: 'nope' }, ctx)).isError).toBe(true);
  });
});
