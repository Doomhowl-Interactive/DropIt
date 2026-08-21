import type { ApiTokenRow } from '../../shared/types';
import { formatTimestamp } from '../util';
import type { ApiToken, ApiTokenService } from './service';

/**
 * The only shape a token is ever allowed to leave the server in — note the
 * absence of `tokenHash`. Shared by the SSR page data and the JSON API so the
 * Angular page can treat both identically.
 */
export function toApiTokenRow(token: ApiToken): ApiTokenRow {
  return {
    id: token.id,
    name: token.name,
    prefix: token.prefix,
    createdAt: token.createdAt ? formatTimestamp(token.createdAt) : 'UNKNOWN',
    lastUsedAt: token.lastUsedAt ? formatTimestamp(token.lastUsedAt) : 'NEVER',
    revoked: token.revokedAt !== null,
  };
}

/** Every token, newest first — the order both the page and the API return. */
export async function listTokenRows(tokens: ApiTokenService): Promise<ApiTokenRow[]> {
  const all = await tokens.list();
  return all
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .map(toApiTokenRow);
}
