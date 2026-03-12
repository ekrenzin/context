import { z } from "zod";

const serviceComponent = z.object({
  type: z.literal("service"),
  port: z.number(),
  entrypoint: z.string(),
  dependencies: z.array(z.string()),
  mqttTopics: z.array(z.string()),
});

const viewComponent = z.object({
  type: z.literal("view"),
  componentPath: z.string(),
});

const ruleComponent = z.object({
  type: z.literal("rule"),
  name: z.string(),
  content: z.string(),
});

const skillComponent = z.object({
  type: z.literal("skill"),
  name: z.string(),
  content: z.string(),
});

const memoryComponent = z.object({
  type: z.literal("memory"),
  category: z.string(),
  name: z.string(),
  content: z.string(),
});

const mqttComponent = z.object({
  type: z.literal("mqtt"),
  topics: z.object({
    publish: z.array(z.string()),
    subscribe: z.array(z.string()),
  }),
});

const minimalComponent = z.object({ type: z.string() }).passthrough();

export const solutionComponentSchema = z.union([
  z.discriminatedUnion("type", [
    serviceComponent,
    viewComponent,
    ruleComponent,
    skillComponent,
    memoryComponent,
    mqttComponent,
  ]),
  minimalComponent,
]);

export type SolutionComponent = z.infer<typeof solutionComponentSchema>;

export const solutionSchema = z.object({
  id: z.string(),
  name: z.string(),
  problem: z.string(),
  project_id: z.string().nullable(),
  status: z.enum(["building", "active", "stopped", "error"]),
  components: z.array(solutionComponentSchema),
  usage_count: z.number(),
  last_used_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Solution = z.infer<typeof solutionSchema>;
