import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import { MCP_RESOURCES } from './resources';
import { MCP_TOOLS } from './tools';
import type { McpToolContext } from './types';

export const MCP_SERVER_NAME = 'dropit';
export const MCP_SERVER_VERSION = '1.0.0';

export const MCP_INSTRUCTIONS = [
  'Drop.it stores files and hands back links that can be shared with anyone.',
  'Use upload_file to store something and get its share link, list_files to see what is already',
  'stored, and get_file to read a file back. Share links are public — treat them as such.',
].join(' ');

/**
 * Builds a server exposing everything in the registries. Cheap to call: the
 * stateless transport creates one of these per request so that each call runs
 * with its own caller context.
 */
export function createMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: MCP_INSTRUCTIONS },
  );

  for (const tool of MCP_TOOLS) {
    // `args` is validated against `tool.config.inputSchema` by the SDK before
    // dispatch; the registry erases that type so tools can share one array.
    server.registerTool(tool.name, tool.config, (args: Record<string, unknown>) =>
      tool.handler(args, ctx),
    );
  }

  for (const resource of MCP_RESOURCES) {
    const template = new ResourceTemplate(resource.uriTemplate, {
      list: async () => ({ resources: await resource.list(ctx) }),
    });

    server.registerResource(
      resource.name,
      template,
      {
        title: resource.title,
        description: resource.description,
        ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
      },
      (uri, variables) => resource.read(uri, variables, ctx),
    );
  }

  return server;
}
