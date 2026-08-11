import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { FileService } from '../server/files/service';
import type { ApiToken } from '../server/tokens/service';
import type { McpTool, McpToolContext } from '../server/mcp/types';

export const TEST_ORIGIN = 'https://drop.test';

export function testToken(overrides: Partial<ApiToken> = {}): ApiToken {
  return {
    id: 'token-1',
    name: 'test',
    tokenHash: 'hash',
    prefix: 'dropit_api_ab',
    userId: 1,
    createdAt: new Date(),
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  };
}

export function testContext(files: FileService): McpToolContext {
  return { files, origin: TEST_ORIGIN, token: testToken() };
}

/**
 * Invokes a tool the way the SDK does — arguments through the declared input
 * schema first, so defaults and coercions are exercised rather than bypassed.
 */
export function callTool(
  tool: McpTool,
  args: Record<string, unknown>,
  ctx: McpToolContext,
): Promise<CallToolResult> {
  const parsed = z.object(tool.config.inputSchema).parse(args);
  return tool.handler(parsed as Record<string, unknown>, ctx);
}

/** The concatenated text blocks of a result, for assertions on the prose. */
export function textOf(result: CallToolResult): string {
  return result.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/** The `structuredContent` of a successful tool result. */
export function structuredOf(result: CallToolResult): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}
