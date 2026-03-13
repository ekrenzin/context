import fs from "fs";
import path from "path";
import type { Manager } from "./manager.js";
import { loadSessions } from "./routes/sessions.js";
import { loadProfile } from "./routes/profile.js";
import { loadStatsOverview } from "./routes/stats.js";
import { readTunnelState } from "./routes/tunnels.js";

interface WatcherHandle {
  close(): void;
}

export function createWatchers(root: string, manager: Manager): WatcherHandle {
  const watchers: fs.FSWatcher[] = [];

  function debounce(fn: () => void, ms: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  const sessionsFile = path.join(
    root,
    "memory",
    "profile",
    "agent-sessions.jsonl",
  );
  const profileFile = path.join(
    root,
    "memory",
    "profile",
    "agent-profile.json",
  );
  const analysesDir = path.join(root, "memory", "profile", "analyses");
  const tunnelFile = path.join(
    root,
    "playground",
    "output",
    "tunnel-state.json",
  );

  const pushSessions = debounce(() => {
    const page = loadSessions(root, 0);
    manager.onSessionsChanged(page);
  }, 300);

  const pushProfile = debounce(() => {
    const profile = loadProfile(root);
    if (profile) {
      manager.onProfileChanged(profile);
    }
  }, 300);

  const pushStats = debounce(() => {
    const stats = loadStatsOverview(root);
    if (stats) {
      manager.onStatsChanged(stats);
    }
  }, 500);

  const pushTunnels = debounce(() => {
    const state = readTunnelState(root);
    manager.onTunnelsChanged(state.tunnels);
  }, 300);

  const INTEL_PREFIXES = [
    "product-analysis",
    "competitor-search",
    "competitor-deepdive",
    "industry-leaders",
    "news-scan",
    "article-analysis",
    "competitive-suggestions",
    "market-analysis",
  ];

  const pushIntel = debounce(() => {
    manager.onIntelChanged();
  }, 500);

  function isIntelDir(name: string | null): boolean {
    return name != null && name.startsWith("intel-");
  }

  function tryWatch(filePath: string, cb: () => void): void {
    try {
      const dir = filePath.endsWith("/") ? filePath : path.dirname(filePath);
      const basename = filePath.endsWith("/") ? null : path.basename(filePath);

      fs.mkdirSync(dir, { recursive: true });
      const watcher = fs.watch(
        dir,
        { persistent: false },
        (_event, filename) => {
          if (!basename || filename === basename) cb();
        },
      );
      watchers.push(watcher);
    } catch {
      setTimeout(() => tryWatch(filePath, cb), 5000);
    }
  }

  tryWatch(sessionsFile, pushSessions);
  tryWatch(profileFile, () => {
    pushProfile();
    pushStats();
  });
  tryWatch(tunnelFile, pushTunnels);

  try {
    fs.mkdirSync(analysesDir, { recursive: true });
    const analysesWatcher = fs.watch(analysesDir, { persistent: false }, () => {
      pushSessions();
      pushStats();
    });
    watchers.push(analysesWatcher);
  } catch {
    /* will be created later */
  }

  const outputDir = path.join(root, "playground", "output");
  const watchedIntelDirs = new Set<string>();

  function watchIntelSubdir(name: string): void {
    if (watchedIntelDirs.has(name)) return;
    watchedIntelDirs.add(name);
    const subdir = path.join(outputDir, name);
    try {
      const w = fs.watch(subdir, { persistent: false }, () => pushIntel());
      watchers.push(w);
    } catch {
      /* dir may vanish */
    }
  }

  try {
    fs.mkdirSync(outputDir, { recursive: true });
    const intelWatcher = fs.watch(
      outputDir,
      { persistent: false },
      (_event, filename) => {
        if (filename && INTEL_PREFIXES.some((p) => filename.startsWith(p))) {
          pushIntel();
        }
        if (isIntelDir(filename)) {
          pushIntel();
          watchIntelSubdir(filename!);
        }
      },
    );
    watchers.push(intelWatcher);

    for (const entry of fs.readdirSync(outputDir)) {
      if (isIntelDir(entry)) {
        const entryPath = path.join(outputDir, entry);
        try {
          if (fs.statSync(entryPath).isDirectory()) watchIntelSubdir(entry);
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    /* will be created later */
  }

  return {
    close() {
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          /* already closed */
        }
      }
    },
  };
}
