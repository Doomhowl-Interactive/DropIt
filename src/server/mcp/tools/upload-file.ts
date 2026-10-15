import { basename } from 'node:path';
import { z } from 'zod';

import { config } from '../../config';
import { NotHostableError } from '../../files/service';
import { siteUrl } from '../../sites/host';
import { humanSize, safeFilename } from '../../util';
import { guessMimeType } from '../content';
import { fileUrl } from '../links';
import { toolError } from '../result';
import { defineMcpTool } from '../types';

export const uploadFileTool = defineMcpTool({
  name: 'upload_file',
  title: 'Upload a file to Drop.it',

  description: [
    'Stores a file and returns a shareable link for it.',
    'Text content can be sent as-is with encoding="utf8"; anything else must be base64.',
    'The returned share link is public — anyone holding it can download the file.',
    'Set hosted=true on a .zip (a built website, a dist folder) to also serve its contents',
    'as a site on a subdomain of its own; the returned site_url is public too.',
  ].join(' '),

  inputSchema: {
    filename: z.string().min(1).describe('Name to store the file under, e.g. "report.pdf".'),
    content: z.string().describe('File contents, encoded according to `encoding`.'),
    encoding: z
      .enum(['base64', 'utf8'])
      .default('base64')
      .describe('How `content` is encoded. Use "utf8" only for plain text.'),
    hosted: z
      .boolean()
      .default(false)
      .describe(
        'Serve the contents of a .zip at a subdomain of its own, e.g. to preview a built ' +
          'website. A single top-level folder in the zip becomes the site root, directories ' +
          'serve their index.html, and the site is served from "/", so either base path works.',
      ),
  },

  outputSchema: {
    id: z.string(),
    filename: z.string(),
    size: z.number(),
    share_url: z.string(),
    site_url: z.string().nullable(),
  },

  async handler(args, ctx) {
    // The filename comes from the model: strip any directory part before it can
    // be used to escape the storage directory, then drop header-hostile characters.
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

    try {
      // Storage cleans up after itself when the record cannot be written, so
      // a failed upload never leaves stray bytes behind.
      const record = await ctx.files.storeUpload(
        filename,
        bytes,
        guessMimeType(filename),
        args.hosted,
      );

      const url = fileUrl(record, ctx.origin);
      const site = siteUrl(record, ctx.origin);

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `Uploaded ${record.filename} (${humanSize(record.size)}).`,
              `Share link: ${url}`,
              ...(site ? [`Site: ${site}`] : []),
            ].join('\n'),
          },
        ],
        structuredContent: {
          id: record.id,
          filename: record.filename,
          size: record.size,
          share_url: url,
          site_url: site,
        },
      };
    } catch (err) {
      if (err instanceof NotHostableError) {
        return toolError(`Cannot host ${filename}: ${err.message}.`);
      }
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
