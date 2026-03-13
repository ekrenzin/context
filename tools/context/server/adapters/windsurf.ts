import fs from "fs";
import path from "path";
import type { IdeAdapter, SyncResult, LaunchResult } from "./types.js";

export const windsurfAdapter: IdeAdapter = {
  name: "windsurf",

  detect(root: string): boolean {
    return fs.existsSync(path.join(root, ".windsurfrules"));
  },

  sync(root: string): SyncResult {
    const rulesDir = path.join(root, "rules");
    if (!fs.existsSync(rulesDir)) return { filesWritten: [], filesRemoved: [] };

    const sections: string[] = [];

    for (const file of fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md")).sort()) {
      const content = fs.readFileSync(path.join(rulesDir, file), "utf-8").trim();
      if (content) sections.push(content);
    }

    const outputPath = path.join(root, ".windsurfrules");
    const output = [
      "# Windsurf Rules",
      "# Auto-generated from canonical workspace. Do not edit directly.",
      "",
      ...sections,
    ].join("\n\n") + "\n";

    fs.writeFileSync(outputPath, output, "utf-8");
    return { filesWritten: [outputPath], filesRemoved: [] };
  },

  launch(root: string): LaunchResult {
    return {
      method: "open",
      value: root,
      label: "Open in Windsurf",
    };
  },
};
