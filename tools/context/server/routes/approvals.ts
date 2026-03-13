import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import type { CtxMqttClient } from "ctx-mqtt";
import {
  getApproval,
  listApprovals,
  resolveApproval,
  getProject,
} from "../db/index.js";
import { emitFeedEvent } from "./feed.js";

function applySkillEvolution(rootPath: string, diff: Record<string, unknown>): void {
  const skillName = diff.skillName as string;
  const skillMd = diff.skillMd as string;
  const resources = (diff.resources ?? []) as Array<{ path: string; content: string }>;

  const skillDir = path.join(rootPath, "skills", skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMd, "utf-8");

  for (const r of resources) {
    const target = path.join(skillDir, r.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, r.content, "utf-8");
  }
}

function applyMemoryCandidate(rootPath: string, diff: Record<string, unknown>): void {
  const category = diff.category as string;
  const filename = diff.filename as string;
  const content = diff.content as string;

  const dir = path.join(rootPath, "memory", category);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content, "utf-8");
}

function applyRuleChange(rootPath: string, diff: Record<string, unknown>): void {
  const name = diff.name as string;
  const content = diff.content as string;

  const rulesDir = path.join(rootPath, "rules");
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(path.join(rulesDir, name), content, "utf-8");
}

const APPLY_MAP: Record<string, (root: string, diff: Record<string, unknown>) => void> = {
  skill_evolution: applySkillEvolution,
  memory_candidate: applyMemoryCandidate,
  rule_change: applyRuleChange,
};

export function registerApprovalRoutes(
  app: FastifyInstance,
  mqtt: CtxMqttClient,
): void {
  app.get<{ Params: { id: string } }>(
    "/api/projects/:id/approvals",
    async (req) => {
      const query = req.query as { status?: string };
      return listApprovals({
        project_id: req.params.id,
        status: query.status ?? "pending",
      });
    },
  );

  app.post<{ Params: { id: string; aid: string } }>(
    "/api/projects/:id/approvals/:aid/approve",
    async (req, reply) => {
      const approval = getApproval(req.params.aid);
      if (!approval || approval.project_id !== req.params.id) {
        return reply.code(404).send({ error: "Approval not found" });
      }
      if (approval.status !== "pending") {
        return reply.code(409).send({ error: "Approval already resolved" });
      }

      const project = getProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "Project not found" });

      const diff = JSON.parse(approval.diff);
      const applier = APPLY_MAP[approval.type];
      if (applier) applier(project.root_path, diff);

      resolveApproval(req.params.aid, "approved");

      emitFeedEvent(mqtt, {
        project_id: req.params.id,
        type: "approval_resolved",
        title: `Approved: ${approval.title}`,
        detail: { approvalId: approval.id, action: "approved" },
      });

      return { ok: true };
    },
  );

  app.post<{ Params: { id: string; aid: string } }>(
    "/api/projects/:id/approvals/:aid/reject",
    async (req, reply) => {
      const approval = getApproval(req.params.aid);
      if (!approval || approval.project_id !== req.params.id) {
        return reply.code(404).send({ error: "Approval not found" });
      }
      if (approval.status !== "pending") {
        return reply.code(409).send({ error: "Approval already resolved" });
      }

      resolveApproval(req.params.aid, "rejected");

      emitFeedEvent(mqtt, {
        project_id: req.params.id,
        type: "approval_resolved",
        title: `Rejected: ${approval.title}`,
        detail: { approvalId: approval.id, action: "rejected" },
      });

      return { ok: true };
    },
  );
}
