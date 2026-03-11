import { topicFor } from "ctx-mqtt";

export type WSMessage = Record<string, unknown>;

export interface ServiceDefinition {
  label: string;
  command: string;
  cwd: string;
  isBackground: boolean;
}

export interface DashboardTestCase {
  name: string;
  command: string;
  watchCommand?: string;
  cwd: string;
}

export const WILDCARD_TOPIC = topicFor("#");
export const CMD_TOPIC = topicFor("vscode/cmd");
export const STATUS_TOPIC = topicFor("vscode/status");
export const SERVICE_TERMINAL_GROUP = "ctx-services";
