import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgentScheduler } from "../../agent-scheduler.js";
import type { AgentJobType } from "../../types.js";

const JOB_TYPES: AgentJobType[] = [
  "profile-scan",
  "session-analysis",
  "codebase-scan",
  "memory-synthesis",
  "skill-evolution",
  "agent-synthesis",
];

function formatJob(j: { id: string; type: string; status: string; detail?: string; durationMs?: number }) {
  const dur = j.durationMs ? ` (${(j.durationMs / 1000).toFixed(1)}s)` : "";
  const detail = j.detail ? ` -- ${j.detail}` : "";
  return `[${j.status}] ${j.type} (${j.id})${dur}${detail}`;
}

export function registerSchedulerTools(
  server: McpServer,
  scheduler: AgentScheduler,
): void {
  server.tool(
    "cc_scheduler_status",
    "Get the current agent scheduler state including recent jobs",
    {},
    async () => {
      const state = scheduler.getState();
      const lines = [
        `Running: ${state.running}`,
        `Last checked: ${state.lastCheckedAt || "never"}`,
        `Next run: ${state.nextRunAt}`,
        `Interval: ${state.intervalMs / 1000}s`,
        "",
        `Recent jobs (${state.jobs.length}):`,
        ...state.jobs.slice(0, 15).map(formatJob),
      ];
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "cc_scheduler_run",
    "Trigger a specific agent scheduler job by type",
    {
      type: z.enum(JOB_TYPES as [AgentJobType, ...AgentJobType[]]).describe(
        "Job type to run",
      ),
    },
    async ({ type }) => {
      const queued = scheduler.triggerJob(type);
      if (!queued) {
        return {
          content: [{
            type: "text" as const,
            text: "Scheduler is already running a job. Wait for it to finish.",
          }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: `Triggered ${type}. Use cc_scheduler_status to monitor progress.`,
        }],
      };
    },
  );

  server.tool(
    "cc_scheduler_run_pipeline",
    "Trigger the full agent scheduler pipeline (profile scan -> analysis -> synthesis)",
    {},
    async () => {
      scheduler.trigger();
      return {
        content: [{
          type: "text" as const,
          text: "Full pipeline triggered. Use cc_scheduler_status to monitor progress.",
        }],
      };
    },
  );

  server.tool(
    "cc_scheduler_cancel",
    "Cancel the currently running scheduler pipeline",
    {},
    async () => {
      scheduler.cancel();
      return {
        content: [{ type: "text" as const, text: "Cancel requested." }],
      };
    },
  );
}
