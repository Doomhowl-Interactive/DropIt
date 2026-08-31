import mime from 'mime';
import { FileNotFoundError, type FileRecord, type FileService } from '../files/service';

export function guessMimeType(filename: string): string {
  return mime.getType(filename) ?? 'application/octet-stream';
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
 * Resolves a live file by its sole public id.
 *
 * Deliberately *not* `FileService.downloadFile`: that books a download, which
 * would make an agent merely looking at a file distort the download count.
 * The liveness checks are repeated here instead.
 */
export async function resolveLiveFile(files: FileService, id: string): Promise<FileRecord> {
  const record = await files.getFileById(id).catch(() => null);

  if (!record) throw new FileNotFoundError();
  if (record.deleted) throw new FileNotFoundError();

  return record;
}
