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
  | { page: 'file-not-found' }
  | { page: 'dashboard'; data: DashboardPageData }
  | { page: 'api-tokens'; data: ApiTokensPageData }
  | { page: 'change-password' }
  | { page: 'error' };

export const PAGE_CONTEXT_KEY = 'dropit.pageContext';
