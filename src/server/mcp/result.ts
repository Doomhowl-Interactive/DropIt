import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * A failed tool call. MCP reports tool failures in-band — an exception would
 * surface as a protocol error the model cannot read or recover from, so
 * anything the caller could reasonably fix comes back this way instead.
 */
export function toolError(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
