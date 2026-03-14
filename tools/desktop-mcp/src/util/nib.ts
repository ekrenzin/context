import { execFile } from "node:child_process";
import { resolve } from "node:path";

const NIB_BIN = resolve(
  import.meta.dirname,
  "../../node_modules/.bin/nib",
);

export interface NibResult {
  nib: string;
  ok: boolean;
  command: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export async function nib(
  args: string[],
  timeoutMs = 30_000,
): Promise<NibResult> {
  return new Promise((res, rej) => {
    execFile(NIB_BIN, args, { timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) {
        rej(new Error(`nib failed: ${err.message}\n${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim()) as NibResult;
        res(result);
      } catch {
        rej(new Error(`nib returned non-JSON: ${stdout}\n${stderr}`));
      }
    });
  });
}

export function nibError(result: NibResult): string {
  if (result.ok) return "";
  return result.error?.message ?? "Unknown nib error";
}
