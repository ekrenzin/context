import { topicFor, type CtxMqttClient } from "ctx-mqtt";
import type {
  SessionsPage,
  ProfileData,
  StatsOverview,
  TunnelState,
  AgentSchedulerState,
  UpdateStatus,
  SkillsSyncStatus,
} from "./types.js";

/**
 * Orchestrates CC event sources and publishes to MQTT topics.
 * Follows the SGC Manager pattern: sources fire callbacks,
 * Manager publishes to the broker.
 */
export interface Manager {
  onSessionsChanged(page: SessionsPage): void;
  onProfileChanged(profile: ProfileData): void;
  onStatsChanged(stats: StatsOverview): void;
  onTunnelsChanged(tunnels: TunnelState["tunnels"]): void;
  onAgentsChanged(state: AgentSchedulerState): void;
  onIntelChanged(): void;
  onUpdateStatus(status: UpdateStatus): void;
  onSkillsSyncChanged(status: SkillsSyncStatus): void;
  close(): void;
}

export function createManager(mqttClient: CtxMqttClient): Manager {
  return {
    onSessionsChanged(page) {
      mqttClient.publish(topicFor("sessions"), page, true);
    },

    onProfileChanged(profile) {
      mqttClient.publish(topicFor("profile"), profile, true);
    },

    onStatsChanged(stats) {
      mqttClient.publish(topicFor("stats"), stats, true);
    },

    onTunnelsChanged(tunnels) {
      mqttClient.publish(topicFor("tunnels"), tunnels, true);
    },

    onAgentsChanged(state) {
      mqttClient.publish(topicFor("agents"), state, true);
    },

    onIntelChanged() {
      mqttClient.publish(topicFor("intel"), { ts: new Date().toISOString() });
    },

    onUpdateStatus(status) {
      mqttClient.publish(topicFor("updates"), status, true);
    },

    onSkillsSyncChanged(status) {
      mqttClient.publish(topicFor("skills-sync"), status, true);
    },

    close() {
      mqttClient.publish(
        topicFor("status"),
        { status: "offline", pid: process.pid },
        true,
      );
    },
  };
}
