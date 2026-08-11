import { describe, expect, it } from 'vitest';

import { MCP_RESOURCES } from '../resources';
import { MCP_TOOLS } from './index';

/**
 * Guards the registry contract rather than any one tool: a new entry that
 * forgets a description or reuses a name would otherwise only show up as a
 * confused model at runtime.
 */
describe('MCP registries', () => {
  it('gives every tool a unique, snake_case name', () => {
    const names = MCP_TOOLS.map((tool) => tool.name);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('describes every tool and its inputs', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.config.title.length, tool.name).toBeGreaterThan(0);
      expect(tool.config.description.length, tool.name).toBeGreaterThan(20);
      expect(Object.keys(tool.config.inputSchema).length, tool.name).toBeGreaterThan(0);
    }
  });

  it('backs every declared structured output with a schema', () => {
    // Clients ignore `structuredContent` unless the tool advertises an
    // outputSchema, so the two have to be declared together.
    for (const tool of MCP_TOOLS) {
      if (tool.config.outputSchema) {
        expect(Object.keys(tool.config.outputSchema).length, tool.name).toBeGreaterThan(0);
      }
    }
  });

  it('gives every resource a unique name and a templated uri', () => {
    const names = MCP_RESOURCES.map((resource) => resource.name);
    expect(new Set(names).size).toBe(names.length);

    for (const resource of MCP_RESOURCES) {
      expect(resource.uriTemplate, resource.name).toMatch(/\{\w+\}/);
    }
  });
});
