/**
 * Data handed from the Express/SSR layer to the Angular application for the
 * page currently being rendered. It travels twice:
 *
 *  1. server render  -> injected through `REQUEST_CONTEXT`
 *  2. browser hydration -> replayed through `TransferState`
 *
 * Everything in here must stay JSON-serializable.
 */

export interface CompletePageData {
  filename: string;
  downloadId: string;
  deleteId: string;
  /** Absolute origin the visitor reached us on, e.g. `https://drop.example`. */
  origin: string;
}

export interface AdminFileRow {
  id: string;
  filename: string;
  size: string;
  createdAt: string;
  expiresAt: string;
  downloadCount: number;
  deleteAfterDownload: boolean;
  deleted: boolean;
}

export interface AdminPageData {
  files: AdminFileRow[];
  page: number;
  totalPages: number;
  error?: string;
}

export type PageContext =
  | { page: 'index' }
  | { page: 'login'; error?: boolean }
  | { page: 'complete'; data: CompletePageData }
  | { page: 'file-not-found' }
  | { page: 'deleted' }
  | { page: 'admin'; data: AdminPageData }
  | { page: 'error' };

export const PAGE_CONTEXT_KEY = 'dropit.pageContext';
