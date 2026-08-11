import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDb } from '../../../testing/db';
import { callTool, structuredOf, testContext, TEST_ORIGIN, textOf } from '../../../testing/mcp';
import { FileRepository } from '../../files/repository';
import { FileService } from '../../files/service';
import type { McpToolContext } from '../types';
import { uploadFileTool } from './upload-file';

describe('upload_file', () => {
  let storageDir: string;
  let files: FileService;
  let ctx: McpToolContext;

  beforeEach(() => {
    storageDir = join(mkdtempSync(join(tmpdir(), 'dropit-mcp-')), 'uploads');
    files = new FileService(new FileRepository(createTestDb()), storageDir);
    ctx = testContext(files);
  });

  afterEach(() => rmSync(storageDir, { recursive: true, force: true }));

  it('stores the bytes and returns working links', async () => {
    const content = Buffer.from('hello drop').toString('base64');
    const result = await callTool(uploadFileTool, { filename: 'note.txt', content }, ctx);

    expect(result.isError).toBeFalsy();

    const structured = structuredOf(result);
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

    const record = await files.getFileById(String(structuredOf(result)['id']));
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

    const record = await files.getFileById(String(structuredOf(result)['id']));

    expect(record.deleteAfterDownload).toBe(true);
    expect(record.expiresAt?.getTime()).toBeGreaterThan(Date.now());
  });

  it('neutralises a traversal filename', async () => {
    const result = await callTool(
      uploadFileTool,
      { filename: '../../etc/passwd', content: 'x', encoding: 'utf8' },
      ctx,
    );

    expect(structuredOf(result)['filename']).toBe('passwd');

    // One upload folder, holding one file, directly under the storage root.
    const folders = readdirSync(storageDir);
    expect(folders).toHaveLength(1);
    expect(readdirSync(join(storageDir, folders[0]!))).toHaveLength(1);
  });

  it('rejects malformed base64 rather than storing a truncated file', async () => {
    const result = await callTool(
      uploadFileTool,
      { filename: 'note.txt', content: 'not*valid*base64' },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('base64');
    expect(readdirSync(storageDir)).toHaveLength(0);
  });

  it('accepts wrapped and url-safe base64', async () => {
    const bytes = Buffer.from([0xfa, 0xff, 0xbe, 0xef, 0x01, 0x02]);
    const wrapped = bytes.toString('base64url').replace(/(.{2})/, '$1\n');

    const result = await callTool(uploadFileTool, { filename: 'b.bin', content: wrapped }, ctx);

    const record = await files.getFileById(String(structuredOf(result)['id']));
    expect(readFileSync(record.path)).toEqual(bytes);
  });

  it('rejects an empty file', async () => {
    const result = await callTool(
      uploadFileTool,
      { filename: 'note.txt', content: '', encoding: 'utf8' },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(readdirSync(storageDir)).toHaveLength(0);
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
      expect(readdirSync(storageDir)).toHaveLength(0);
    } finally {
      delete process.env['MCP_MAX_UPLOAD_BYTES'];
    }
  });

  it('reports a failed upload instead of leaving an orphaned folder', async () => {
    vi.spyOn(files, 'registerUpload').mockRejectedValue(new Error('database is locked'));

    const result = await callTool(
      uploadFileTool,
      { filename: 'note.txt', content: 'x', encoding: 'utf8' },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('database is locked');
    expect(readdirSync(storageDir)).toHaveLength(0);
  });
});
