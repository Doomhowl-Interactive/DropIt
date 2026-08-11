import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from '../../../testing/db';
import { callTool, structuredOf, testContext, TEST_ORIGIN, textOf } from '../../../testing/mcp';
import { FileRepository } from '../../files/repository';
import { FileService } from '../../files/service';
import type { McpToolContext } from '../types';
import { listFilesTool } from './list-files';
import { uploadFileTool } from './upload-file';

describe('list_files', () => {
  let storageDir: string;
  let files: FileService;
  let ctx: McpToolContext;

  beforeEach(() => {
    storageDir = join(mkdtempSync(join(tmpdir(), 'dropit-mcp-')), 'uploads');
    files = new FileService(new FileRepository(createTestDb()), storageDir);
    ctx = testContext(files);
  });

  afterEach(() => rmSync(storageDir, { recursive: true, force: true }));

  const upload = (filename: string) =>
    callTool(uploadFileTool, { filename, content: 'body', encoding: 'utf8' }, ctx);

  it('reports an empty drop', async () => {
    const result = await callTool(listFilesTool, {}, ctx);

    expect(structuredOf(result)['total']).toBe(0);
    expect(textOf(result)).toContain('No files');
  });

  it('lists files with their share links and totals', async () => {
    await upload('one.txt');
    await upload('two.txt');

    const result = await callTool(listFilesTool, {}, ctx);
    const structured = structuredOf(result);
    const rows = structured['files'] as Record<string, unknown>[];

    expect(structured['total']).toBe(2);
    expect(structured['page']).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]!['share_url']).toMatch(new RegExp(`^${TEST_ORIGIN}/f/`));
    expect(rows[0]!['download_count']).toBe(0);
    expect(rows[0]!['deleted']).toBe(false);
    expect(textOf(result)).toContain('Showing 2 of 2 files');
  });

  it('paginates', async () => {
    await upload('one.txt');
    await upload('two.txt');
    await upload('three.txt');

    const page2 = await callTool(listFilesTool, { page: 2, page_size: 2 }, ctx);
    const structured = structuredOf(page2);

    expect(structured['total']).toBe(3);
    expect(structured['page_size']).toBe(2);
    expect(structured['files']).toHaveLength(1);
  });

  it('flags deleted files rather than hiding them', async () => {
    const uploaded = await upload('gone.txt');
    await files.deleteFileById(String(structuredOf(uploaded)['id']));

    const result = await callTool(listFilesTool, {}, ctx);

    expect((structuredOf(result)['files'] as Record<string, unknown>[])[0]!['deleted']).toBe(true);
    expect(textOf(result)).toContain('DELETED');
  });

  // The cap is enforced by the input schema, before the handler ever runs.
  it('rejects a page size past the cap', () => {
    expect(() => callTool(listFilesTool, { page_size: 1000 }, ctx)).toThrow(/100/);
  });
});
