import { config } from '../../config';
import { humanSize } from '../../util';
import { guessMimeType, looksLikeText, readFileBytes, resolveLiveFile } from '../content';
import { defineMcpResource } from '../types';

export const FILE_URI_SCHEME = 'dropit://files/';

/**
 * Exposes stored files as browsable MCP resources, so a client can offer them
 * as attachable context without the model having to call `get_file` first.
 * Only live files are listed — deleted and expired ones are not attachable.
 */
export const fileResource = defineMcpResource({
  name: 'file',
  title: 'Stored file',
  description: 'A file held by Drop.it, addressed by its download id.',
  uriTemplate: `${FILE_URI_SCHEME}{id}`,

  async list(ctx) {
    const records = await ctx.files.getAllFiles();
    const now = Date.now();

    return records
      .filter(
        (record) => !record.deleted && !(record.expiresAt && record.expiresAt.getTime() <= now),
      )
      .map((record) => ({
        uri: `${FILE_URI_SCHEME}${record.id}`,
        name: record.filename,
        description: `${humanSize(record.size)}, ${record.downloadCount} downloads`,
        mimeType: guessMimeType(record.filename),
        size: record.size,
      }));
  },

  async read(uri, variables, ctx) {
    const id = String(Array.isArray(variables['id']) ? variables['id'][0] : variables['id']);
    const record = await resolveLiveFile(ctx.files, id);

    if (record.size > config.mcpMaxUploadBytes) {
      throw new Error(
        `${record.filename} is ${humanSize(record.size)}, too large to inline ` +
          `(limit ${humanSize(config.mcpMaxUploadBytes)}).`,
      );
    }

    const bytes = await readFileBytes(record);
    const mimeType = guessMimeType(record.filename);

    return {
      contents: [
        looksLikeText(bytes)
          ? { uri: uri.href, mimeType, text: bytes.toString('utf8') }
          : { uri: uri.href, mimeType, blob: bytes.toString('base64') },
      ],
    };
  },
});
