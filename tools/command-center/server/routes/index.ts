import type { FastifyInstance } from "fastify";
import { registerSessionRoutes } from "./sessions.js";
import { registerProfileRoutes } from "./profile.js";
import { registerStatsRoutes } from "./stats.js";
import { registerTunnelRoutes } from "./tunnels.js";
import { registerRepoRoutes } from "./repos.js";
import { registerConfigRoutes } from "./config.js";
import { registerIdentityRoutes } from "./identity.js";
import { registerSkillRoutes } from "./skills.js";
import { registerSessionMapRoutes } from "./session-map.js";
import { registerAgentRoutes } from "./agents.js";
import { registerIntelRoutes } from "./intel.js";
import { registerPlatformRoutes } from "./platform.js";
import { registerUpdateRoutes } from "./updates.js";
import { registerEnvRoutes } from "./env.js";
import { registerLogRoutes } from "./logs.js";
import { registerMqttCredentialRoutes } from "./mqtt-credentials.js";
import { registerExternalSkillRoutes } from "./external-skills.js";

import type { AgentScheduler } from "../agent-scheduler.js";
import type { UpdateChecker } from "../update-checker.js";
import type { SkillsSyncer } from "../skills-syncer.js";
import type { CtxMqttClient } from "ctx-mqtt";

export function registerRoutes(
  app: FastifyInstance,
  root: string,
  scheduler: AgentScheduler,
  transcriptDir: string,
  updateChecker: UpdateChecker,
  skillsSyncer: SkillsSyncer,
  mqttClient: CtxMqttClient,
): void {
  registerSessionRoutes(app, root, transcriptDir);
  registerProfileRoutes(app, root);
  registerStatsRoutes(app, root);
  registerTunnelRoutes(app, root);
  registerRepoRoutes(app, root);
  registerConfigRoutes(app, root);
  registerIdentityRoutes(app);
  registerSkillRoutes(app, root);
  registerSessionMapRoutes(app, root, transcriptDir);
  registerAgentRoutes(app, scheduler, root);
  registerIntelRoutes(app, root);
  registerPlatformRoutes(app, root);
  registerUpdateRoutes(app, updateChecker);
  registerExternalSkillRoutes(app, skillsSyncer);
  registerEnvRoutes(app, root);
  registerLogRoutes(app, mqttClient);
  registerMqttCredentialRoutes(app);
}
