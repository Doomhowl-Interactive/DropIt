import type { McpTool } from '../types';
import { getFileTool } from './get-file';
import { listFilesTool } from './list-files';
import { uploadFileTool } from './upload-file';

/**
 * Every tool the MCP endpoint exposes. This array is the extension point:
 * adding a capability means writing one file next to these and appending it
 * here — nothing else in the MCP layer needs to change.
 */
export const MCP_TOOLS: McpTool[] = [uploadFileTool, listFilesTool, getFileTool];

export { getFileTool, listFilesTool, uploadFileTool };
