import { z } from 'zod';

import { config } from '../../config';
import { humanSize } from '../../util';
import { guessMimeType, looksLikeText, resolveLiveFile } from '../content';
import { fileUrl } from '../links';
import { toolError } from '../result';
import { defineMcpTool } from '../types';

export const getFileTool = defineMcpTool({
  name: 'get_file',
  title: 'Read a stored file back',

  description:
    'Returns the contents of a stored file. Text comes back inline; anything else comes back ' +
    'as a base64 resource. Reading a file this way does not count as a download.',

  inputSchema: {
    id: z
      .string()
      .min(1)
      .describe(
        'The file id from list_files or upload_file, or the id from a /api/files/<id> share link.',
      ),
  },

  annotations: { readOnlyHint: true },

  async handler(args, ctx) {
    const record = await resolveLiveFile(ctx.files, args.id).catch(() => null);
    if (!record) {
      return toolError(`No live file with id "${args.id}" — it may be deleted or unknown.`);
    }

    if (record.size > config.mcpMaxUploadBytes) {
      return toolError(
        `${record.filename} is ${humanSize(record.size)}, over the ` +
          `${humanSize(config.mcpMaxUploadBytes)} limit for inline reads. ` +
          `Download it directly instead: ${fileUrl(record, ctx.origin)}`,
      );
    }

    let bytes: Buffer;
    try {
      bytes = await ctx.files.readFileBytes(record);
    } catch (err) {
      return toolError(`Could not read ${record.filename} from storage: ${(err as Error).message}`);
    }

    const uri = `dropit://files/${record.id}`;
    const mimeType = guessMimeType(record.filename);

    if (looksLikeText(bytes)) {
      return { content: [{ type: 'text' as const, text: bytes.toString('utf8') }] };
    }

    return {
      content: [
        {
          type: 'resource' as const,
          resource: { uri, mimeType, blob: bytes.toString('base64') },
        },
      ],
    };
  },
});
