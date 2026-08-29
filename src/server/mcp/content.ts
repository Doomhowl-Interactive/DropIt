import { extname } from 'node:path';
import { FileNotFoundError, type FileRecord, type FileService } from '../files/service';

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ts': 'text/plain',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

export function guessMimeType(filename: string): string {
  return MIME_TYPES[extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Whether the bytes can be handed back as an MCP text block. Sniffing beats
 * trusting the extension: an agent will happily upload a `.log` or a file with
 * no extension at all.
 */
export function looksLikeText(bytes: Buffer): boolean {
  if (bytes.includes(0)) return false;

  // A lone replacement character means the decode failed somewhere; a genuine
  // U+FFFD in the source would round-trip through the re-encode unchanged.
  const decoded = bytes.toString('utf8');
  return Buffer.byteLength(decoded, 'utf8') === bytes.length;
}

/**
 * Resolves a file by its download id, falling back to its view id — share
 * links carry the download id, but older ones handed out a view id.
 *
 * Deliberately *not* `FileService.downloadFile`: that books a download, which
 * would make an agent merely looking at a file distort the download count.
 * The liveness checks are repeated here instead.
 */
export async function resolveLiveFile(files: FileService, id: string): Promise<FileRecord> {
  const record = await files
    .getFileById(id)
    .catch(() => files.getFileByViewId(id).catch(() => null));

  if (!record) throw new FileNotFoundError();
  if (record.deleted) throw new FileNotFoundError();

  return record;
}
