import fs from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import { getSetting, setSetting } from "../db/index.js";

const DEFAULT_CONFIG = {
  name: "Context",
  subtitle: "Command Center",
  accentGradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
  borderRadius: 10,
  dark: {
    primary: "#60a5fa",
    secondary: "#818cf8",
    success: "#4ade80",
    warning: "#fbbf24",
    error: "#f87171",
    background: "#0f172a",
    surface: "#1e293b",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
  },
  light: {
    primary: "#2563eb",
    secondary: "#4f46e5",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    textSecondary: "#475569",
  },
};

type BrandingConfig = typeof DEFAULT_CONFIG;

function merge(partial: Record<string, unknown>): BrandingConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    dark: { ...DEFAULT_CONFIG.dark, ...(partial.dark as Record<string, string> ?? {}) },
    light: { ...DEFAULT_CONFIG.light, ...(partial.light as Record<string, string> ?? {}) },
  };
}

function loadFromDb(): BrandingConfig | null {
  const raw = getSetting("branding");
  if (!raw) return null;
  try {
    return merge(JSON.parse(raw));
  } catch {
    return null;
  }
}

function loadFromFile(root: string): BrandingConfig {
  const candidates = [
    path.join(root, "tools", "command-center", "branding.json"),
    path.join(root, "branding.json"),
  ];
  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return merge(JSON.parse(raw));
    } catch {
      continue;
    }
  }
  return DEFAULT_CONFIG;
}

export function registerBrandingRoutes(app: FastifyInstance, root: string): void {
  app.get("/api/branding", async () => {
    return loadFromDb() ?? loadFromFile(root);
  });

  app.put<{ Body: Partial<BrandingConfig> }>("/api/branding", async (req) => {
    const current = loadFromDb() ?? loadFromFile(root);
    const merged = merge({ ...current, ...req.body });
    setSetting("branding", JSON.stringify(merged));
    return merged;
  });

  app.post("/api/branding/reload", async () => {
    return loadFromDb() ?? loadFromFile(root);
  });
}
