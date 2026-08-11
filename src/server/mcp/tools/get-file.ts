import { z } from 'zod';

import { config } from '../../config';
import { humanSize } from '../../util';
import { guessMimeType, looksLikeText, readFileBytes, resolveLiveFile } from '../content';
import { shareLinks } from '../links';
import { toolError } from '../result';
import { defineMcpTool } from '../types';

export const getFileTool = defineMcpTool({
  name: 'get_file',
  title: 'Read a stored file back',

  description:
    'Returns the contents of a stored file. Text comes back inline; anything else comes back ' +
    'as a base64 resource. Reading a file this way does not count as a download and will not ' +
    'consume a delete-after-download file.',

  inputSchema: {
    id: z
      .string()
      .min(1)
      .describe('The file id from list_files or upload_file, or the id from a /f/<id> share link.'),
  },

  annotations: { readOnlyHint: true },

  async handler(args, ctx) {
    const record = await resolveLiveFile(ctx.files, args.id).catch(() => null);
    if (!record) {
      return toolError(
        `No live file with id "${args.id}" — it may be deleted, expired or unknown.`,
      );
    }

    if (record.size > config.mcpMaxUploadBytes) {
      return toolError(
        `${record.filename} is ${humanSize(record.size)}, over the ` +
          `${humanSize(config.mcpMaxUploadBytes)} limit for inline reads. ` +
          `Download it directly instead: ${shareLinks(record, ctx.origin).download}`,
      );
    }

    let bytes: Buffer;
    try {
      bytes = await readFileBytes(record);
    } catch (err) {
      return toolError(`Could not read ${record.filename} from disk: ${(err as Error).message}`);
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
