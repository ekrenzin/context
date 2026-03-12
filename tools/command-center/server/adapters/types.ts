export interface IdeAdapter {
  name: string;
  detect(root: string): boolean;
  sync(root: string): SyncResult;
  launch(root: string): LaunchResult;
}

export interface SyncResult {
  filesWritten: string[];
  filesRemoved: string[];
}

export interface LaunchResult {
  method: "open" | "terminal" | "pty";
  value: string;
  label: string;
  args?: string[];
}
