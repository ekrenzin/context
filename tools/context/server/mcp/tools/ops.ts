import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "../index.js";
import { readTunnelState } from "../../routes/tunnels.js";

export function register(server: McpServer, deps: McpDeps): void {
  const { updateChecker, scheduler, root } = deps;
  server.tool(
    "cc_updates",
    "Check context repo status against origin/main",
    {},
    async () => {
      const status = updateChecker.getStatus();
      const lines = [
        `Branch: ${status.branch}`,
        `State: ${status.state}`,
        `SHA: ${status.sha}`,
        `Ahead: ${status.ahead}, Behind: ${status.behind}`,
        `Dirty: ${status.dirty}`,
        `Last checked: ${status.lastCheckedAt}`,
        status.autoUpdated ? "Auto-updated: yes" : "",
        status.error ? `Error: ${status.error}` : "",
      ].filter(Boolean);
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "cc_updates_pull",
    "Pull latest changes from origin/main (fast-forward only)",
    {},
    async () => {
      const status = await updateChecker.pull();
      if (status.error) {
        return {
          content: [{ type: "text" as const, text: `Pull failed: ${status.error}` }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: `Pulled to ${status.sha}. State: ${status.state}`,
        }],
      };
    },
  );

  server.tool(
    "cc_tunnels",
    "List active Cloudflare tunnels and their status",
    {},
    async () => {
      const state = readTunnelState(root);
      const entries = Object.entries(state.tunnels);
      if (entries.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No active tunnels." }],
        };
      }
      const lines = entries.map(([name, t]) => {
        const status = t.alive ? "alive" : "dead";
        return `${name}: ${t.url} (port ${t.port}, pid ${t.pid}, ${status})`;
      });
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "cc_intel_run",
    "Trigger a competitive intelligence analysis run",
    {
      repo: z.string().describe("Target repo (e.g. app-platform, app-notifier)"),
      depth: z.enum(["quick", "standard", "deep"]).describe("Analysis depth"),
      focus: z.string().optional().describe("Optional focus area"),
    },
    async ({ repo, depth, focus }) => {
      const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const jobId = scheduler.triggerIntelJob({ repo, depth, focus, runId });
      if (!jobId) {
        return {
          content: [{ type: "text" as const, text: "Could not start intel run. Scheduler may be busy." }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: `Intel analysis started: ${repo} (${depth})${focus ? ` -- ${focus}` : ""}. Job ID: ${jobId}`,
        }],
      };
    },
  );
}
