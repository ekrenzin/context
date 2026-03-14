import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";
import { spawnSession } from "../../terminal/manager.js";

export function register(server: McpServer, deps: McpDeps): void {
  const { root } = deps;

  server.tool(
    "cc_claude_run",
    "Run Claude Code headlessly on a task. Spawns a terminal session where Claude works autonomously. If Claude gets stuck or fails, the terminal action FAB alerts the user. Use this to delegate work to a sub-agent.",
    {
      prompt: z.string().describe("What Claude should do"),
      system: z.string().optional().describe("Additional system prompt context"),
      model: z.string().optional().describe("Model alias (sonnet, opus, haiku) or full model ID"),
      permissionMode: z.enum(["acceptEdits", "bypassPermissions", "default"]).default("acceptEdits")
        .describe("acceptEdits: auto-approve file edits. bypassPermissions: fully autonomous. default: prompt for everything."),
      budget: z.number().optional().describe("Max spend in USD"),
    },
    async ({ prompt, system, model, permissionMode, budget }) => {
      const args: string[] = [
        "--permission-mode", permissionMode,
      ];
      if (system) {
        args.push("--append-system-prompt", system);
      }
      if (model) {
        args.push("--model", model);
      }
      if (budget !== undefined) {
        args.push("--max-budget-usd", String(budget));
      }
      args.push(prompt);

      const session = await spawnSession({ command: "claude", args, cwd: root });

      return {
        content: [{
          type: "text" as const,
          text: [
            `Claude session spawned: ${session.id}`,
            `Prompt: ${prompt.slice(0, 120)}`,
            `Permission mode: ${permissionMode}`,
            `View in Command Center: /terminal?session=${session.id}`,
          ].join("\n"),
        }],
      };
    },
  );
}
