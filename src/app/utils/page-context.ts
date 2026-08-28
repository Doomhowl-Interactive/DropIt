/**
 * Data handed from the Express/SSR layer to the Angular application for the
 * page currently being rendered. It travels twice:
 *
 *  1. server render  -> injected through `REQUEST_CONTEXT`
 *  2. browser hydration -> replayed through `TransferState`
 *
 * Everything in here must stay JSON-serializable.
 */

import type { ApiTokenRow, CreatedApiToken } from '../../shared/types';

export type { ApiTokenRow, CreatedApiToken };

export interface CompletePageData {
  filename: string;
  downloadId: string;
  /** Absolute origin the visitor reached us on, e.g. `https://drop.example`. */
  origin: string;
}

export interface ApiTokensPageData {
  /** Absolute URL of the MCP endpoint, ready to paste into a client config. */
  endpoint: string;
}

export type PageContext =
  | { page: 'index' }
  | { page: 'login'; error?: boolean }
  | { page: 'complete'; data: CompletePageData }
  | { page: 'file-not-found' }
  | { page: 'dashboard' }
  | { page: 'api-tokens'; data: ApiTokensPageData }
  | { page: 'change-password' }
  | { page: 'error' };

export const PAGE_CONTEXT_KEY = 'dropit.pageContext';
