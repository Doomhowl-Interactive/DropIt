/**
 * Data handed from the Express/SSR layer to the Angular application for the
 * page currently being rendered. It travels twice:
 *
 *  1. server render  -> injected through `REQUEST_CONTEXT`
 *  2. browser hydration -> replayed through `TransferState`
 *
 * Everything in here must stay JSON-serializable.
 */

import type { ApiTokenRow, CreatedApiToken, DashboardFileRow } from '../../shared/types';

export type { ApiTokenRow, CreatedApiToken, DashboardFileRow };

export interface CompletePageData {
  filename: string;
  downloadId: string;
  deleteId: string;
  /** Absolute origin the visitor reached us on, e.g. `https://drop.example`. */
  origin: string;
}

export interface DashboardPageData {
  files: DashboardFileRow[];
  page: number;
  totalPages: number;
  error?: string;
}

export interface ApiTokensPageData {
  tokens: ApiTokenRow[];
  /** Absolute URL of the MCP endpoint, ready to paste into a client config. */
  endpoint: string;
  error?: string;
}

export type PageContext =
  | { page: 'index' }
  | { page: 'login'; error?: boolean }
  | { page: 'complete'; data: CompletePageData }
  | { page: 'file-not-found' }
  | { page: 'deleted' }
  | { page: 'dashboard'; data: DashboardPageData }
  | { page: 'api-tokens'; data: ApiTokensPageData }
  | { page: 'change-password' }
  | { page: 'error' };

export const PAGE_CONTEXT_KEY = 'dropit.pageContext';
