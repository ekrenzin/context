import { toJSONSchema, type ZodType } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDef } from "./system-prompt.js";

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface RegisteredTool {
  description: string;
  inputSchema?: unknown;
  enabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => Promise<unknown>;
}

interface InternalMcp {
  _registeredTools: Record<string, RegisteredTool>;
}

export class ToolCatalog {
  private tools = new Map<string, { def: AnthropicTool; handler: RegisteredTool["handler"]; hasSchema: boolean }>();

  build(mcp: McpServer): void {
    this.tools.clear();
    const internal = mcp as unknown as InternalMcp;
    const registered = internal._registeredTools;
    if (!registered) return;

    for (const [name, tool] of Object.entries(registered)) {
      if (!tool.enabled) continue;

      let jsonSchema: Record<string, unknown> = { type: "object", properties: {} };
      if (tool.inputSchema) {
        try {
          jsonSchema = toJSONSchema(tool.inputSchema as ZodType) as Record<string, unknown>;
        } catch {
          // fallback
        }
      }

      this.tools.set(name, {
        def: { name, description: tool.description, input_schema: jsonSchema },
        handler: tool.handler,
        hasSchema: !!tool.inputSchema,
      });
    }
  }

  definitions(): AnthropicTool[] {
    return Array.from(this.tools.values()).map((t) => t.def);
  }

  summaries(): ToolDef[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.def.name,
      description: t.def.description,
    }));
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) return `Tool "${name}" not found`;
    try {
      const extra = {};
      const result = tool.hasSchema
        ? await tool.handler(args, extra)
        : await tool.handler(extra);
      const res = result as { content?: Array<{ text?: string }> };
      if (res?.content?.[0]?.text) return res.content[0].text;
      return JSON.stringify(result);
    } catch (err) {
      return `Tool error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get size(): number {
    return this.tools.size;
  }
}
