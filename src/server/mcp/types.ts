import type {
  CallToolResult,
  ReadResourceResult,
  Resource,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';
import type { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import type { z, ZodRawShape } from 'zod';

import type { FileService } from '../files/service';
import type { McpToken } from './tokens/service';

/**
 * Everything a tool or resource handler is allowed to reach. New dependencies
 * belong here — never injected into individual tool modules — so that adding a
 * tool stays a matter of writing one file.
 */
export interface McpToolContext {
  files: FileService;
  /** Absolute origin the MCP request arrived on, for building share links. */
  origin: string;
  /** The token the caller authenticated with. */
  token: McpToken;
}

/**
 * A tool as the registry stores it. The input-schema type is erased so that
 * tools with different schemas can share one array; `defineMcpTool` is what
 * keeps the handler strongly typed on the way in.
 */
export interface McpTool {
  name: string;
  config: {
    title: string;
    description: string;
    inputSchema: ZodRawShape;
    outputSchema?: ZodRawShape;
    annotations?: ToolAnnotations;
  };
  handler: (args: Record<string, unknown>, ctx: McpToolContext) => Promise<CallToolResult>;
}

export interface McpToolInput<Shape extends ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  /**
   * Declare this whenever the tool returns `structuredContent` — clients only
   * look at structured output for tools that advertise a schema for it.
   */
  outputSchema?: ZodRawShape;
  annotations?: ToolAnnotations;
  handler: (args: z.infer<z.ZodObject<Shape>>, ctx: McpToolContext) => Promise<CallToolResult>;
}

/**
 * Declares a tool. Handler arguments are inferred from `inputSchema`, so a
 * tool file never restates its own parameter types.
 */
export function defineMcpTool<Shape extends ZodRawShape>(input: McpToolInput<Shape>): McpTool {
  return {
    name: input.name,
    config: {
      title: input.title,
      description: input.description,
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      annotations: input.annotations,
    },
    // The SDK validates against `inputSchema` before dispatching, so by the
    // time we get here the args really are the shape's output type.
    handler: (args, ctx) => input.handler(args as z.infer<z.ZodObject<Shape>>, ctx),
  };
}

/**
 * A templated resource. The SDK's `ResourceTemplate` has to be constructed per
 * request because its list callback closes over the caller's context, so the
 * registry stores the ingredients and `createMcpServer` does the assembling —
 * a resource file never touches SDK plumbing.
 */
export interface McpResource {
  name: string;
  title: string;
  description: string;
  mimeType?: string;
  /** RFC 6570 URI template, e.g. `dropit://files/{id}`. */
  uriTemplate: string;
  list: (ctx: McpToolContext) => Promise<Resource[]>;
  read: (uri: URL, variables: Variables, ctx: McpToolContext) => Promise<ReadResourceResult>;
}

export function defineMcpResource(resource: McpResource): McpResource {
  return resource;
}
