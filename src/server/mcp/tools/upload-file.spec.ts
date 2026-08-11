import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileRepository } from '../../files/repository';
import { FileService } from '../../files/service';
import { testDb, testStorageDir } from '../../testing/db';
import { callTool, testContext, TEST_ORIGIN, textOf } from '../../testing/mcp';
import type { McpToolContext } from '../types';
import { uploadFileTool } from './upload-file';

describe('upload_file', () => {
  let storage: ReturnType<typeof testStorageDir>;
  let files: FileService;
  let ctx: McpToolContext;

  beforeEach(() => {
    storage = testStorageDir();
    files = new FileService(new FileRepository(testDb()), storage.path);
    ctx = testContext(files);
  });

  afterEach(() => storage.cleanup());

  it('stores the bytes and returns working links', async () => {
    const content = Buffer.from('hello drop').toString('base64');
    const result = await callTool(uploadFileTool, { filename: 'note.txt', content }, ctx);

    expect(result.isError).toBeFalsy();

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured['filename']).toBe('note.txt');
    expect(structured['size']).toBe(10);
    expect(structured['share_url']).toMatch(new RegExp(`^${TEST_ORIGIN}/f/`));
    expect(structured['expires_at']).toBeNull();

    const record = await files.getFileById(String(structured['id']));
    expect(readFileSync(record.path, 'utf8')).toBe('hello drop');
    expect(textOf(result)).toContain(String(structured['share_url']));
  });

  it('accepts plain text without base64 encoding', async () => {
    const result = await callTool(
      uploadFileTool,
      { filename: 'note.txt', content: 'plain', encoding: 'utf8' },
      ctx,
    );

    const id = String((result.structuredContent as Record<string, unknown>)['id']);
    const record = await files.getFileById(id);
    expect(readFileSync(record.path, 'utf8')).toBe('plain');
  });

  it('honours an expiry and the delete-after-download flag', async () => {
    const result = await callTool(
      uploadFileTool,
      {
        filename: 'note.txt',
        content: 'x',
        encoding: 'utf8',
        expires_in_seconds: 60,
        delete_after_download: true,
      },
      ctx,
    );

    const id = String((result.structuredContent as Record<string, unknown>)['id']);
    const record = await files.getFileById(id);

    expect(record.deleteAfterDownload).toBe(true);
    expect(record.expiresAt?.getTime()).toBeGreaterThan(Date.now());
  });

  it('neutralises a traversal filename', async () => {
    const result = await callTool(
      uploadFileTool,
      { filename: '../../etc/passwd', content: 'x', encoding: 'utf8' },
      ctx,
    );

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured['filename']).toBe('passwd');

    // One upload folder, holding one file, directly under the storage root.
    const folders = readdirSync(storage.path);
    expect(folders).toHaveLength(1);
    expect(readdirSync(`${storage.path}/${folders[0]}`)).toHaveLength(1);
  });

  it('rejects malformed base64 rather than storing a truncated file', async () => {
    const result = await callTool(
      uploadFileTool,
      { filename: 'note.txt', content: 'not*valid*base64' },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('base64');
    expect(readdirSync(storage.path)).toHaveLength(0);
  });

  it('rejects an empty file', async () => {
    const result = await callTool(
      uploadFileTool,
      { filename: 'note.txt', content: '', encoding: 'utf8' },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(readdirSync(storage.path)).toHaveLength(0);
  });

  it('rejects a file over the configured limit', async () => {
    process.env['MCP_MAX_UPLOAD_BYTES'] = '8';
    try {
      const result = await callTool(
        uploadFileTool,
        { filename: 'big.bin', content: 'x'.repeat(64), encoding: 'utf8' },
        ctx,
      );

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('limit');
      expect(readdirSync(storage.path)).toHaveLength(0);
    } finally {
      delete process.env['MCP_MAX_UPLOAD_BYTES'];
    }
  });
});
