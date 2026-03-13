import { apiGet, apiPost } from "../client.js";

interface WorkspaceStatus {
  exists: boolean;
  name?: string;
  repos: number;
  ides: string[];
}

export async function workspaceStatus(): Promise<void> {
  const data = await apiGet<WorkspaceStatus>("/api/workspace/status");

  if (!data.exists) {
    console.log("No workspace configured. Run the onboarding wizard in the app.");
    return;
  }

  console.log(`Workspace: ${data.name}`);
  console.log(`  Repos: ${data.repos}`);
  console.log(`  IDEs: ${data.ides.join(", ")}`);
}

export async function syncAdapters(): Promise<void> {
  const result = await apiPost<Record<string, { filesWritten: string[] }>>("/api/workspace/sync");

  for (const [ide, res] of Object.entries(result)) {
    console.log(`${ide}: ${res.filesWritten.length} files synced`);
  }
}
