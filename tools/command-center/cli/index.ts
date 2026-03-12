#!/usr/bin/env node

import { status } from "./commands/status.js";
import { scan, write } from "./commands/memory.js";
import { scanCommand, analyze } from "./commands/profiler.js";
import { workspaceStatus, syncAdapters } from "./commands/workspace.js";
import { serveMcp } from "./mcp.js";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

function flag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

async function main(): Promise<void> {
  switch (command) {
    case "status":
      await status();
      break;

    case "memory":
      if (subcommand === "scan") {
        await scan(flag("query"), flag("type"), flag("repo"));
      } else if (subcommand === "write") {
        await write({
          type: flag("type") ?? "progress",
          title: flag("title") ?? "untitled",
          body: flag("body") ?? "",
          repo: flag("repo"),
          ticket: flag("ticket"),
        });
      } else {
        console.log("Usage: ctx memory <scan|write>");
      }
      break;

    case "profiler":
      if (subcommand === "scan") {
        await scanCommand();
      } else if (subcommand === "analyze") {
        await analyze(args[2]);
      } else {
        console.log("Usage: ctx profiler <scan|analyze>");
      }
      break;

    case "workspace":
      if (subcommand === "status") {
        await workspaceStatus();
      } else if (subcommand === "sync") {
        await syncAdapters();
      } else {
        console.log("Usage: ctx workspace <status|sync>");
      }
      break;

    case "mcp":
      if (subcommand === "serve") {
        await serveMcp();
      } else {
        console.log("Usage: ctx mcp serve");
      }
      break;

    default:
      console.log("Context CLI");
      console.log("  ctx status              -- app health");
      console.log("  ctx memory scan         -- search memory");
      console.log("  ctx memory write        -- write entry");
      console.log("  ctx profiler scan       -- scan transcripts");
      console.log("  ctx profiler analyze    -- analyze session");
      console.log("  ctx workspace status    -- workspace info");
      console.log("  ctx workspace sync      -- sync IDE adapters");
      console.log("  ctx mcp serve           -- start MCP server");
      break;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
