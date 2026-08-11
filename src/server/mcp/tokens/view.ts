import type { McpTokenRow } from '../../../app/utils/page-context';
import { formatTimestamp } from '../../util';
import type { McpToken, McpTokenService } from './service';

/**
 * The only shape a token is ever allowed to leave the server in — note the
 * absence of `tokenHash`. Shared by the SSR page data and the JSON API so the
 * Angular page can treat both identically.
 */
export function toMcpTokenRow(token: McpToken): McpTokenRow {
  return {
    id: token.id,
    name: token.name,
    prefix: token.prefix,
    createdAt: token.createdAt ? formatTimestamp(token.createdAt) : 'UNKNOWN',
    lastUsedAt: token.lastUsedAt ? formatTimestamp(token.lastUsedAt) : 'NEVER',
    expiresAt: token.expiresAt ? formatTimestamp(token.expiresAt) : 'NEVER',
    revoked: token.revokedAt !== null,
  };
}

/** Every token, newest first — the order both the page and the API return. */
export async function listTokenRows(tokens: McpTokenService): Promise<McpTokenRow[]> {
  const all = await tokens.list();
  return all
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .map(toMcpTokenRow);
}
