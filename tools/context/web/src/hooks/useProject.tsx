import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { api, type ProjectRecord } from "../lib/api";

interface ProjectContextValue {
  project: ProjectRecord | null;
  loading: boolean;
  reload: () => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  project: null,
  loading: true,
  reload: () => {},
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getProject(projectId)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [projectId]);

  return (
    <ProjectContext.Provider value={{ project, loading, reload: load }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  return useContext(ProjectContext);
}
