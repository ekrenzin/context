import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { AgentSchedulerState, AgentJobType } from "../lib/api";
import { useMqttTopic } from "./useMqtt";

interface UseAgentsResult {
  state: AgentSchedulerState | null;
  loading: boolean;
  trigger: () => Promise<void>;
  triggerJob: (type: AgentJobType) => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => void;
}

export function useAgents(): UseAgentsResult {
  const [stateLocal, setStateLocal] = useState<AgentSchedulerState | null>(null);
  const [loading, setLoading] = useState(true);

  const mqttState = useMqttTopic<AgentSchedulerState>("ctx/agents");
  const state = mqttState ?? stateLocal;

  const refresh = useCallback(() => {
    api.agents()
      .then(setStateLocal)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (mqttState) setLoading(false);
  }, [mqttState]);

  const trigger = useCallback(async () => {
    await api.triggerAgents().catch(() => {});
  }, []);

  const triggerJob = useCallback(async (type: AgentJobType) => {
    await api.triggerJob(type).catch(() => {});
  }, []);

  const cancel = useCallback(async () => {
    await api.cancelPipeline().catch(() => {});
  }, []);

  return { state, loading, trigger, triggerJob, cancel, refresh };
}
