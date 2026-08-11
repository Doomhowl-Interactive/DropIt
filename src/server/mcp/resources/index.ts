import type { McpResource } from '../types';
import { fileResource } from './file-resource';

/** Every resource the MCP endpoint exposes. Same extension point as MCP_TOOLS. */
export const MCP_RESOURCES: McpResource[] = [fileResource];

export { fileResource };
