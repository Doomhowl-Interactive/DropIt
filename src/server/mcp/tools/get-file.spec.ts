import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from '../../../testing/db';
import { callTool, structuredOf, testContext, textOf } from '../../../testing/mcp';
import { FileRepository } from '../../files/repository';
import { FileService } from '../../files/service';
import type { McpToolContext } from '../types';
import { getFileTool } from './get-file';
import { uploadFileTool } from './upload-file';

describe('get_file', () => {
  let storageDir: string;
  let files: FileService;
  let ctx: McpToolContext;

  beforeEach(async () => {
    storageDir = join(mkdtempSync(join(tmpdir(), 'dropit-mcp-')), 'uploads');
    files = new FileService(new FileRepository(await createTestDb()), storageDir);
    ctx = testContext(files);
  });

  afterEach(() => rmSync(storageDir, { recursive: true, force: true }));

  const upload = async (args: Record<string, unknown>): Promise<FileRecord> => {
    const result = await callTool(uploadFileTool, args, ctx);
    return files.getFileById(String(structuredOf(result)['id']));
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

  it('refuses deleted and unknown ids', async () => {
    const deleted = await upload({ filename: 'gone.txt', content: 'x', encoding: 'utf8' });
    await files.deleteFileById(deleted.id);
    expect((await callTool(getFileTool, { id: deleted.id }, ctx)).isError).toBe(true);

    expect((await callTool(getFileTool, { id: 'nope' }, ctx)).isError).toBe(true);
  });

  it('refuses a file larger than the inline limit, pointing at the download link', async () => {
    const record = await upload({ filename: 'big.txt', content: 'hello', encoding: 'utf8' });

    process.env['MCP_MAX_UPLOAD_BYTES'] = '2';
    try {
      const result = await callTool(getFileTool, { id: record.id }, ctx);
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain(`/api/files/download/${record.id}`);
    } finally {
      delete process.env['MCP_MAX_UPLOAD_BYTES'];
    }
  });

  it('reports a file whose bytes have vanished from disk', async () => {
    const record = await upload({ filename: 'note.txt', content: 'hello', encoding: 'utf8' });
    rmSync(record.path);

    const result = await callTool(getFileTool, { id: record.id }, ctx);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Could not read');
  });
});
