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

export interface DashboardFileRow {
  id: string;
  filename: string;
  size: string;
  createdAt: string;
  expiresAt: string;
  downloadCount: number;
  deleteAfterDownload: boolean;
  deleted: boolean;
}

export interface DashboardPageData {
  files: DashboardFileRow[];
  page: number;
  totalPages: number;
  error?: string;
}

/**
 * An API token as the server is willing to describe it. The secret is shown
 * exactly once, when the token is created, and never lives here.
 */
export interface ApiTokenRow {
  id: string;
  name: string;
  /** Leading characters of the secret, so two tokens can be told apart. */
  prefix: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export interface ApiTokensPageData {
  tokens: ApiTokenRow[];
  /** Absolute URL of the MCP endpoint, ready to paste into a client config. */
  endpoint: string;
  error?: string;
}

/** Response to a token creation — the one and only sighting of `secret`. */
export interface CreatedApiToken {
  token: ApiTokenRow;
  secret: string;
}

export type PageContext =
  | { page: 'index' }
  | { page: 'login'; error?: boolean }
  | { page: 'complete'; data: CompletePageData }
  | { page: 'file-not-found' }
  | { page: 'deleted' }
  | { page: 'dashboard'; data: DashboardPageData }
  | { page: 'api-tokens'; data: ApiTokensPageData }
  | { page: 'error' };

export const PAGE_CONTEXT_KEY = 'dropit.pageContext';
