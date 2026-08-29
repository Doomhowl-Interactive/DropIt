import type { FileRecord } from '../files/service';

/** The public URL that streams a stored file — what a share link points at. */
export function fileUrl(record: FileRecord, origin: string): string {
  return `${origin}/api/files/view/${record.id}`;
}
