import type { FileRecord } from '../files/service';

export interface ShareLinks {
  /** The page a human should be sent to. */
  share: string;
  /** Streams the bytes directly; counts as a download. */
  download: string;
}

/** The URLs the web UI shows on its "file ready" page, for a given origin. */
export function shareLinks(record: FileRecord, origin: string): ShareLinks {
  return {
    share: `${origin}/f/${record.viewId}`,
    download: `${origin}/api/files/download/${record.id}`,
  };
}
