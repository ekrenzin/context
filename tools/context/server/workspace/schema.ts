import { z } from "zod";

export const repoSchema = z.object({
  name: z.string(),
  url: z.string().url().optional(),
  path: z.string().optional(),
  branch: z.string().default("main"),
  description: z.string().default(""),
});

export const workspaceSchema = z.object({
  name: z.string().min(1),
  version: z.literal(1).default(1),
  repos: z.array(repoSchema).default([]),
  ides: z.array(z.enum(["cursor", "claude-code", "windsurf", "codex"])).default(["cursor"]),
  appUrl: z.string().url().default("http://127.0.0.1:19470"),
  createdAt: z.string().optional(),
});

export type WorkspaceConfig = z.infer<typeof workspaceSchema>;
export type RepoConfig = z.infer<typeof repoSchema>;
