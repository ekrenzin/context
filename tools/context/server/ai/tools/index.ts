/**
 * Local AI tool registry.
 *
 * Tools are executed by the TypeScript runtime, not the model.
 * The model emits JSON tool calls; this registry validates and dispatches them.
 */

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolResult {
  ok: boolean;
  output?: string;
  error?: string;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

const registry = new Map<string, RegisteredTool>();

export function registerTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  handler: ToolHandler,
): void {
  registry.set(name, {
    definition: {
      type: "function",
      function: { name, description, parameters },
    },
    handler,
  });
}

export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(registry.values()).map((t) => t.definition);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tool = registry.get(name);
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }
  try {
    return await tool.handler(args);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function hasTools(): boolean {
  return registry.size > 0;
}

// Auto-register built-in tools (dynamic imports to avoid circular TDZ issues)
export async function loadBuiltinTools(): Promise<void> {
  await import("./web-fetch.js");
  await import("./web-search.js");
  await import("./file-read.js");
  await import("./grep.js");
  await import("./glob.js");
}
