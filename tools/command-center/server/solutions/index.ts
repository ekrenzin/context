import { getDb } from "../db/index.js";
import type { Solution, SolutionComponent } from "./schema.js";
import { solutionSchema } from "./schema.js";

export { buildSolution } from "./builder.js";
export type { BuildSolutionOpts, BuildSolutionResult } from "./builder.js";
export type { SolutionComponent } from "./schema.js";
export { SOLUTION_EXAMPLES } from "./examples.js";
export type { SolutionExample } from "./examples.js";

export type CreateSolutionInput = {
  id: string;
  name: string;
  problem: string;
  projectId?: string | null;
  components: Array<{ type: string }>;
  status?: "building" | "active" | "stopped" | "error";
};

export function createSolution(sol: CreateSolutionInput): void {
  const status = sol.status ?? "building";
  const componentsJson = JSON.stringify(sol.components);
  getDb()
    .prepare(
      `INSERT INTO solutions (id, name, problem, project_id, status, components)
       VALUES (@id, @name, @problem, @project_id, @status, @components)`,
    )
    .run({
      id: sol.id,
      name: sol.name,
      problem: sol.problem,
      project_id: sol.projectId ?? null,
      status,
      components: componentsJson,
    });
}

export function getSolution(id: string): Solution | undefined {
  const row = getDb()
    .prepare("SELECT * FROM solutions WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;

  const components = JSON.parse(row.components as string) as SolutionComponent[];
  return solutionSchema.parse({ ...row, components }) as Solution;
}

export function listSolutions(projectId?: string | null): Solution[] {
  let sql = "SELECT * FROM solutions";
  const params: Record<string, unknown> = {};

  if (projectId !== undefined) {
    sql += " WHERE project_id IS " + (projectId === null ? "NULL" : "@project_id");
    if (projectId !== null) params.project_id = projectId;
  }

  sql += " ORDER BY updated_at DESC";

  const rows = getDb()
    .prepare(sql)
    .all(params) as Record<string, unknown>[];

  return rows.map((row) => {
    const components = JSON.parse(row.components as string) as SolutionComponent[];
    return solutionSchema.parse({ ...row, components }) as Solution;
  });
}

export function updateStatus(
  id: string,
  status: "building" | "active" | "stopped" | "error",
): void {
  getDb()
    .prepare("UPDATE solutions SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, id);
}

export function deleteSolution(id: string): void {
  getDb().prepare("DELETE FROM solutions WHERE id = ?").run(id);
}
