import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface NavEntry {
  path: string;
  search: string;
  timestamp: number;
}

const MAX_HISTORY = 20;
const DEBOUNCE_MS = 300;
const EXCLUDED_PATHS = ["/terminal"];

function shouldExclude(path: string): boolean {
  return EXCLUDED_PATHS.some((p) => path.startsWith(p));
}

async function persistNav(current: NavEntry, history: NavEntry[]): Promise<void> {
  try {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "nav.current": JSON.stringify(current),
        "nav.history": JSON.stringify(history),
      }),
    });
  } catch {
    // silent -- navigation persistence is best-effort
  }
}

export async function fetchNavState(): Promise<{
  current: NavEntry | null;
  history: NavEntry[];
}> {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    const current = data["nav.current"] ? JSON.parse(data["nav.current"]) : null;
    const history = data["nav.history"] ? JSON.parse(data["nav.history"]) : [];
    return { current, history };
  } catch {
    return { current: null, history: [] };
  }
}

export function useNavHistory() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stack, setStack] = useState<NavEntry[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initializedRef = useRef(false);

  // Hydrate from persisted state once
  useEffect(() => {
    fetchNavState().then(({ history }) => {
      if (history.length > 0) {
        setStack(history);
      }
      initializedRef.current = true;
    });
  }, []);

  // Track route changes
  useEffect(() => {
    if (!initializedRef.current) return;
    if (shouldExclude(location.pathname)) return;

    setStack((prev) => {
      const top = prev[prev.length - 1];
      const newPath = location.pathname;
      const newSearch = location.search;

      // Deduplicate consecutive identical routes
      if (top && top.path === newPath && top.search === newSearch) {
        return prev;
      }

      const entry: NavEntry = { path: newPath, search: newSearch, timestamp: Date.now() };
      const next = [...prev, entry];
      if (next.length > MAX_HISTORY) next.shift();

      // Debounced persist
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        persistNav(entry, next);
      }, DEBOUNCE_MS);

      return next;
    });
  }, [location.pathname, location.search]);

  const canGoBack = stack.length > 1;

  const goBack = useCallback(() => {
    if (stack.length <= 1) return false;

    const next = stack.slice(0, -1);
    const target = next[next.length - 1];
    setStack(next);

    // Persist and navigate
    persistNav(target, next);
    navigate(target.path + target.search);
    return true;
  }, [stack, navigate]);

  return { canGoBack, goBack };
}
