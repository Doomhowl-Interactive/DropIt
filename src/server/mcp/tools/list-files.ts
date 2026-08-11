import { z } from 'zod';

import { formatTimestamp, humanSize } from '../../util';
import { shareLinks } from '../links';
import { defineMcpTool } from '../types';

const MAX_PAGE_SIZE = 100;

export const listFilesTool = defineMcpTool({
  name: 'list_files',
  title: 'List stored files',

  description:
    'Lists the files held by Drop.it, newest first, with their share links, sizes and expiry. ' +
    'Deleted files are included and flagged so their ids can still be recognised.',

  inputSchema: {
    page: z.number().int().positive().default(1).describe('1-based page number.'),
    page_size: z
      .number()
      .int()
      .positive()
      .max(MAX_PAGE_SIZE)
      .default(20)
      .describe(`Files per page (max ${MAX_PAGE_SIZE}).`),
  },

  outputSchema: {
    page: z.number(),
    page_size: z.number(),
    total: z.number(),
    files: z.array(
      z.object({
        id: z.string(),
        filename: z.string(),
        size: z.number(),
        created_at: z.string(),
        expires_at: z.string().nullable(),
        download_count: z.number(),
        deleted: z.boolean(),
        share_url: z.string(),
      }),
    ),
  },

  annotations: { readOnlyHint: true },

  async handler(args, ctx) {
    const { files: records, total } = await ctx.files.getPaginatedFiles(
      args.page_size,
      (args.page - 1) * args.page_size,
    );

    const files = records.map((record) => ({
      id: record.id,
      filename: record.filename,
      size: record.size,
      created_at: record.createdAt.toISOString(),
      expires_at: record.expiresAt?.toISOString() ?? null,
      download_count: record.downloadCount,
      deleted: record.deleted,
      share_url: shareLinks(record, ctx.origin).share,
    }));

    const lines = records.map((record) => {
      const parts = [
        record.id,
        record.filename,
        humanSize(record.size),
        `${record.downloadCount} downloads`,
        `created ${formatTimestamp(record.createdAt)}`,
        record.expiresAt ? `expires ${formatTimestamp(record.expiresAt)}` : 'never expires',
      ];
      if (record.deleted) parts.push('DELETED');
      return `- ${parts.join(' | ')}`;
    });

    const shown = (args.page - 1) * args.page_size + records.length;

    return {
      content: [
        {
          type: 'text' as const,
          text: records.length
            ? `${lines.join('\n')}\n\nShowing ${shown} of ${total} files (page ${args.page}).`
            : `No files on page ${args.page} (${total} in total).`,
        },
      ],
      structuredContent: { page: args.page, page_size: args.page_size, total, files },
    };
  },
});
