import { useState, useEffect } from "react";
import { api } from "./api";

/**
 * Resolves the default terminal cwd from the `default_terminal_project`
 * setting. Returns undefined while loading or if no project is configured.
 */
export function useDefaultCwd(): string | undefined {
  const [cwd, setCwd] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => r.json())
      .then(async (settings: Record<string, string>) => {
        const projectId = settings.default_terminal_project;
        if (cancelled || !projectId) return;
        const project = await api.getProject(projectId);
        if (!cancelled && project.root_path) {
          setCwd(project.root_path);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return cwd;
}
