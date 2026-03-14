import type { FastifyInstance } from "fastify";
import { registerSessionRoutes } from "./sessions.js";
import { registerStatsRoutes } from "./stats.js";
import { registerConfigRoutes } from "./config.js";
import { registerAgentRoutes } from "./agents.js";
import { registerLogRoutes } from "./logs.js";
import { registerBrandingRoutes } from "./branding.js";
import { registerUpdateRoutes } from "./updates.js";
import { registerSettingsRoutes } from "./settings.js";
import { registerViewRoutes } from "./views.js";
import { registerProjectRoutes } from "./projects.js";
import { registerApprovalRoutes } from "./approvals.js";
import { registerFeedRoutes } from "./feed.js";
import { registerIntelligenceRoutes } from "./intelligence.js";
import { registerFilesystemRoutes } from "./filesystem.js";
import { registerSolutionRoutes } from "./solutions.js";
import { registerHealthRoutes } from "./health.js";
import { registerOnboardingRoutes } from "./onboarding.js";
import { registerSessionLogRoutes } from "./session-logs.js";
import { registerOllamaRoutes } from "./ollama.js";
import { registerMqttCredentialRoutes } from "./mqtt-credentials.js";
import { registerLocalAiRoutes } from "./local-ai.js";
import { registerCliToolsRoutes } from "./cli-tools.js";
import { registerSkillRoutes } from "./skills.js";
import { registerSessionMapRoutes } from "./session-map.js";
import { registerAutoCommitRoutes } from "./auto-commit.js";
import { registerProposalRoutes } from "./proposals.js";
import { registerPreviewRoutes } from "./preview.js";
import { registerCheckpointRoutes } from "./checkpoints.js";
import { registerAiRoutes } from "./ai.js";
import { registerMcpRegistryRoutes } from "./mcp-registry.js";
import { registerProjectMcpRoutes } from "./project-mcp.js";
import { registerKnowledgeRoutes } from "./knowledge.js";
import { registerAgentEventRoutes } from "./agent-events.js";
import type { McpSync } from "../mcp-sync/index.js";

import type { AgentScheduler } from "../agent-scheduler.js";
import type { AutoCommitService } from "../auto-commit.js";
import type { UpdateChecker } from "../update-checker.js";
import type { CtxMqttClient } from "ctx-mqtt";

export function registerRoutes(
  app: FastifyInstance,
  root: string,
  scheduler: AgentScheduler,
  transcriptDir: string,
  updateChecker: UpdateChecker,
  mqttClient: CtxMqttClient,
  autoCommit: AutoCommitService,
  mcpSync?: McpSync,
): void {
  registerSessionRoutes(app, root, transcriptDir);
  registerStatsRoutes(app, root);
  registerConfigRoutes(app, root);
  registerAgentRoutes(app, scheduler, root);
  registerLogRoutes(app, mqttClient);
  registerBrandingRoutes(app, root);
  registerUpdateRoutes(app, updateChecker);
  registerSettingsRoutes(app);
  registerViewRoutes(app, root);
  registerProjectRoutes(app, root);
  registerApprovalRoutes(app, mqttClient);
  registerFeedRoutes(app);
  registerIntelligenceRoutes(app);
  registerFilesystemRoutes(app);
  registerSolutionRoutes(app, root);
  registerHealthRoutes(app, mqttClient);
  registerOnboardingRoutes(app, root);
  registerSessionLogRoutes(app, root);
  registerOllamaRoutes(app);
  registerMqttCredentialRoutes(app);
  registerLocalAiRoutes(app);
  registerCliToolsRoutes(app);
  registerSkillRoutes(app, root);
  registerSessionMapRoutes(app, root, transcriptDir);
  registerAutoCommitRoutes(app, autoCommit);
  registerProposalRoutes(app, root, mqttClient);
  registerPreviewRoutes(app, mqttClient);
  registerCheckpointRoutes(app, root);
  registerAiRoutes(app);
  registerKnowledgeRoutes(app, root);
  registerAgentEventRoutes(app, mqttClient);
  if (mcpSync) registerMcpRegistryRoutes(app, mcpSync);
  if (mcpSync) registerProjectMcpRoutes(app, mcpSync);
}
