import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { z } from 'zod';

import { config } from '../../config';
import { humanSize, safeFilename } from '../../util';
import { shareLinks } from '../links';
import { toolError } from '../result';
import { defineMcpTool } from '../types';

export const uploadFileTool = defineMcpTool({
  name: 'upload_file',
  title: 'Upload a file to Drop.it',

  description: [
    'Stores a file and returns a shareable link for it.',
    'Text content can be sent as-is with encoding="utf8"; anything else must be base64.',
    'The returned share link is public — anyone holding it can download the file.',
    'The deletion link is admin-only and will not work from an MCP client.',
  ].join(' '),

  inputSchema: {
    filename: z.string().min(1).describe('Name to store the file under, e.g. "report.pdf".'),
    content: z.string().describe('File contents, encoded according to `encoding`.'),
    encoding: z
      .enum(['base64', 'utf8'])
      .default('base64')
      .describe('How `content` is encoded. Use "utf8" only for plain text.'),
    expires_in_seconds: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Delete the file automatically after this many seconds. Omit to keep it forever.'),
    delete_after_download: z
      .boolean()
      .default(false)
      .describe('Delete the file as soon as it has been downloaded once.'),
  },

  outputSchema: {
    id: z.string(),
    filename: z.string(),
    size: z.number(),
    share_url: z.string(),
    download_url: z.string(),
    expires_at: z.string().nullable(),
  },

  async handler(args, ctx) {
    // The filename comes from the model: strip any directory part before it can
    // be used to escape the upload folder, then drop header-hostile characters.
    const filename = safeFilename(basename(args.filename));

    let bytes: Buffer;
    try {
      bytes = decode(args.content, args.encoding);
    } catch (err) {
      return toolError(`Could not decode content as ${args.encoding}: ${(err as Error).message}`);
    }

    if (bytes.length === 0) {
      return toolError('Refusing to store an empty file.');
    }
    if (bytes.length > config.mcpMaxUploadBytes) {
      return toolError(
        `File is ${humanSize(bytes.length)}, over the ${humanSize(config.mcpMaxUploadBytes)} limit.`,
      );
    }

    const { folderId, folderPath } = ctx.files.createUploadFolder();
    const path = join(folderPath, randomUUID() + extname(filename));

    try {
      await writeFile(path, bytes);

      const expiresAt = args.expires_in_seconds
        ? new Date(Date.now() + args.expires_in_seconds * 1000)
        : null;

      const record = await ctx.files.registerUpload({
        folderId,
        originalName: filename,
        path,
        size: bytes.length,
        expiresAt,
        deleteAfterDownload: args.delete_after_download,
      });

      const links = shareLinks(record, ctx.origin);

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `Uploaded ${record.filename} (${humanSize(record.size)}).`,
              `Share link: ${links.share}`,
              `Direct download: ${links.download}`,
              expiresAt ? `Expires: ${expiresAt.toISOString()}` : 'Never expires.',
              args.delete_after_download ? 'Deletes itself after the first download.' : '',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        structuredContent: {
          id: record.id,
          filename: record.filename,
          size: record.size,
          share_url: links.share,
          download_url: links.download,
          expires_at: expiresAt?.toISOString() ?? null,
        },
      };
    } catch (err) {
      // Never leave an orphaned folder behind when the record was not written.
      await rm(folderPath, { recursive: true, force: true }).catch(() => undefined);
      return toolError(`Upload failed: ${(err as Error).message}`);
    }
  },
});

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * `Buffer.from(x, 'base64')` silently discards anything it doesn't recognise,
 * so a typo in a large payload would be stored as a subtly truncated file.
 * Validate the alphabet up front instead.
 */
function decode(content: string, encoding: 'base64' | 'utf8'): Buffer {
  if (encoding === 'utf8') return Buffer.from(content, 'utf8');

  // Tolerate wrapped lines and the URL-safe alphabet; agents produce both.
  const normalized = content.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!BASE64.test(normalized) || normalized.replace(/=+$/, '').length % 4 === 1) {
    throw new Error('not valid base64');
  }

  return Buffer.from(normalized, 'base64');
}
