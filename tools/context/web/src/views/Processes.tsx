import { useState, useEffect } from "react";
import { Box, Stack } from "@mui/material";
import { useMqttTopic } from "../hooks/useMqtt";
import { topicFor } from "ctx-mqtt/topics";
import { ServerOriginCard, type ServerProcess } from "./system/ServerOriginCard";
import { MqttStatusCard } from "./system/MqttStatusCard";
import { AutoCommitCard, type AutoCommitStatus } from "./system/AutoCommitCard";
import { UpdateCheckerCard, type UpdateStatus } from "./system/UpdateCheckerCard";
import { SkillsSyncCard, type SkillsSyncStatus } from "./system/SkillsSyncCard";
import { AgentSchedulerCard, type AgentSchedulerState } from "./system/AgentSchedulerCard";

export default function Processes() {
  const agents = useMqttTopic<AgentSchedulerState>(topicFor("agents"));
  const skillsSync = useMqttTopic<SkillsSyncStatus>(topicFor("skills-sync"));
  const updates = useMqttTopic<UpdateStatus>(topicFor("updates"));
  const autoCommit = useMqttTopic<AutoCommitStatus>(topicFor("auto-commit/status"));
  const [serverProcess, setServerProcess] = useState<ServerProcess | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchHealth() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.process) setServerProcess(data.process);
        }
      } catch { /* ignore */ }
    }
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <Box sx={{ pt: 1, maxWidth: 720, mx: "auto" }}>
      <Stack spacing={2}>
        <ServerOriginCard info={serverProcess} />
        <MqttStatusCard />
        <AutoCommitCard status={autoCommit} />
        <UpdateCheckerCard status={updates} />
        <SkillsSyncCard status={skillsSync} />
        <AgentSchedulerCard state={agents} />
      </Stack>
    </Box>
  );
}
